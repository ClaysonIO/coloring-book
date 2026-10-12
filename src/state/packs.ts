import { Directory, File, Paths } from 'expo-file-system';
import { strFromU8, unzipSync } from 'fflate';

import { CATALOG_URL, packUrl, parseCatalog, type Catalog, type CatalogPack } from '../content/catalog';
import { deleteImage, importImage, newId, saveImage, type CustomPage } from './library';

/**
 * Book packs: zips holding one or more books, downloaded from the website or picked from Files.
 *
 * A zip from the website (scripts/build-packs.mjs) has a _pack.json at the top and one folder per
 * book with a _book.json listing its pages, the same layout as ColoringPages/. Zips people make
 * themselves can use that layout too, or just hold pictures: each folder of pictures becomes a
 * book named after the folder (pictures at the top level make a book named after the zip).
 */
export type PackBook = { id: string; title: string; cover?: string; pages: CustomPage[] };
export type InstalledPack = {
  /** The website's pack id, or a generated one for a zip without a _pack.json. */
  id: string;
  title: string;
  /** Website packs only; a different version in the catalog means an update is available. */
  version?: string;
  source: 'web' | 'file';
  books: PackBook[];
  /** Books the user removed, so updates don't bring them back. */
  removed: string[];
};

/** What a zip holds, before its images are copied into the library. */
type ParsedBook = { key: string; title: string; cover?: string; pages: { id: string; title: string; entry: string }[] };
type ParsedPack = { id?: string; title: string; version?: string; books: ParsedBook[] };

export type Progress = (message: string) => void;

const MAX_SIZE = 2048;
const IMAGE_EXT = /\.(png|jpe?g|gif|webp|heic|heif|bmp)$/i;

const catalogFile = () => new File(Paths.document, 'coloring', 'library', 'catalog.json');

export function slug(s: string) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** "IMG_1234.HEIC" -> "IMG 1234"; falls back to `fallback`. */
export function titleFrom(name: string | null | undefined, fallback: string) {
  const base = name?.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || fallback;
}

const basename = (p: string) => p.slice(p.lastIndexOf('/') + 1);
const dirname = (p: string) => (p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '');
const naturalSort = (a: string, b: string) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });

/** The catalog saved the last time the website was reached, so the list shows offline. */
export function loadCachedCatalog(): Catalog | null {
  const file = catalogFile();
  if (!file.exists) return null;
  try {
    return parseCatalog(JSON.parse(file.textSync()));
  } catch {
    return null;
  }
}

export async function fetchCatalog(): Promise<Catalog> {
  // GitHub Pages lets caches keep files for hours; a unique URL always gets the current list.
  const res = await fetch(`${CATALOG_URL}?t=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error(`The website answered with error ${res.status}.`);
  const catalog = parseCatalog(await res.json());
  if (!catalog) throw new Error('The book list on the website is not readable.');
  const file = catalogFile();
  const dir = new Directory(Paths.document, 'coloring', 'library');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  file.write(JSON.stringify(catalog));
  return catalog;
}

/** Downloads a pack's zip into the cache and returns the file; the caller deletes it. */
export async function downloadPack(pack: CatalogPack, onProgress?: Progress): Promise<File> {
  const target = new File(Paths.cache, `pack-${pack.id}.zip`);
  if (target.exists) target.delete();
  return File.downloadFileAsync(packUrl(pack.zip), target, {
    idempotent: true,
    onProgress: ({ bytesWritten, totalBytes }) => {
      const total = totalBytes > 0 ? totalBytes : pack.size;
      if (total > 0) onProgress?.(`Downloading… ${Math.min(100, Math.round((bytesWritten / total) * 100))}%`);
    },
  });
}

/** Lists a zip's files, skipping folders and macOS/hidden clutter. */
function zipEntries(zip: Uint8Array): string[] {
  const names: string[] = [];
  unzipSync(zip, {
    filter: (f) => {
      if (!f.name.endsWith('/') && !f.name.startsWith('__MACOSX/') && !basename(f.name).startsWith('.')) names.push(f.name);
      return false;
    },
  });
  return names;
}

/** Inflates a single file, so the whole zip never has to be unpacked in memory at once. */
function readEntry(zip: Uint8Array, name: string): Uint8Array {
  const data = unzipSync(zip, { filter: (f) => f.name === name })[name];
  if (!data) throw new Error(`${name} is missing from the zip`);
  return data;
}

function readJson(zip: Uint8Array, name: string): any {
  return JSON.parse(strFromU8(readEntry(zip, name)));
}

/** Resolves "a/b/../c.png" style paths from a _book.json against its folder. */
function joinPath(dir: string, p: string) {
  const parts = (dir ? `${dir}/${p}` : p).split('/');
  const out: string[] = [];
  for (const part of parts) {
    if (part === '..') out.pop();
    else if (part && part !== '.') out.push(part);
  }
  return out.join('/');
}

function parseZip(zip: Uint8Array, zipName: string): ParsedPack {
  const entries = zipEntries(zip);
  const has = new Set(entries);
  const zipTitle = titleFrom(zipName, 'Imported book');

  // _pack.json and _book.json may sit inside a wrapper folder, so take the shallowest.
  const packJsonPath = entries.filter((e) => basename(e) === '_pack.json').sort((a, b) => a.length - b.length)[0];
  const packJson = packJsonPath ? readJson(zip, packJsonPath) : {};
  const pack: ParsedPack = {
    id: typeof packJson.id === 'string' && slug(packJson.id) ? slug(packJson.id) : undefined,
    title: typeof packJson.title === 'string' && packJson.title.trim() ? packJson.title.trim() : zipTitle,
    version: typeof packJson.version === 'string' ? packJson.version : undefined,
    books: [],
  };

  const bookJsons = entries.filter((e) => basename(e) === '_book.json').sort(naturalSort);
  if (bookJsons.length) {
    for (const jsonPath of bookJsons) {
      const dir = dirname(jsonPath);
      let json: any;
      try {
        json = readJson(zip, jsonPath);
      } catch {
        continue;
      }
      if (!Array.isArray(json?.pages)) continue;
      const folderName = basename(dir) || zipTitle;
      const book: ParsedBook = {
        key: slug(folderName) || 'book',
        title: typeof json.name === 'string' && json.name.trim() ? json.name.trim() : titleFrom(folderName, zipTitle),
        pages: [],
      };
      if (typeof json.cover === 'string' && has.has(joinPath(dir, json.cover))) book.cover = joinPath(dir, json.cover);
      for (const p of json.pages) {
        if (!p || typeof p.path !== 'string') continue;
        const entry = joinPath(dir, p.path);
        if (!has.has(entry) || !IMAGE_EXT.test(entry)) continue;
        const id = slug(typeof p.id === 'string' ? p.id : basename(p.path).replace(/\.[^.]+$/, ''));
        const title = typeof p.name === 'string' && p.name.trim() ? p.name.trim() : titleFrom(basename(entry), 'Page');
        book.pages.push({ id: id || 'page', title, entry });
      }
      if (book.pages.length) pack.books.push(book);
    }
  } else {
    // No _book.json: every folder of pictures is a book.
    const byDir = new Map<string, string[]>();
    for (const e of entries.filter((x) => IMAGE_EXT.test(x)).sort(naturalSort)) {
      const d = dirname(e);
      byDir.set(d, [...(byDir.get(d) ?? []), e]);
    }
    for (const [dir, images] of [...byDir].sort(([a], [b]) => naturalSort(a, b))) {
      const title = dir ? titleFrom(basename(dir), zipTitle) : zipTitle;
      pack.books.push({
        key: slug(dir ? basename(dir) : zipTitle) || 'book',
        title,
        pages: images.map((entry, i) => ({
          id: slug(basename(entry).replace(/\.[^.]+$/, '')) || `page-${i + 1}`,
          title: titleFrom(basename(entry), `Page ${i + 1}`),
          entry,
        })),
      });
    }
    // A zip with a single wrapper folder reads better under the zip's own name.
    if (pack.books.length === 1 && !packJsonPath) pack.title = pack.books[0].title;
  }
  return pack;
}

/** Pixel size of a PNG or JPEG from its header, or null if it's another format or needs rotating. */
function headerSize(b: Uint8Array): { width: number; height: number } | null {
  if (b.length > 24 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) {
    const u32 = (i: number) => ((b[i] << 24) | (b[i + 1] << 16) | (b[i + 2] << 8) | b[i + 3]) >>> 0;
    return { width: u32(16), height: u32(20) };
  }
  if (b[0] !== 0xff || b[1] !== 0xd8) return null;
  let i = 2;
  while (i + 9 < b.length) {
    if (b[i] !== 0xff) return null;
    const marker = b[i + 1];
    if (marker === 0xff) {
      i++;
      continue;
    }
    if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      i += 2;
      continue;
    }
    const len = (b[i + 2] << 8) | b[i + 3];
    // Exif may carry a rotation the decoders below wouldn't apply, so let the OS handle those.
    if (marker === 0xe1 && b[i + 4] === 0x45 && b[i + 5] === 0x78 && b[i + 6] === 0x69 && b[i + 7] === 0x66) return null;
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return { height: (b[i + 5] << 8) | b[i + 6], width: (b[i + 7] << 8) | b[i + 8] };
    }
    i += 2 + len;
  }
  return null;
}

/**
 * Copies one image from the zip into the library. PNGs and JPEGs that already fit are stored
 * as they are (website packs are prepared that way, which keeps installs fast); anything else
 * goes through the same resize-to-PNG path as pictures added in the app.
 */
async function storeImage(data: Uint8Array, entry: string): Promise<string> {
  const size = headerSize(data);
  if (size && size.width > 0 && Math.max(size.width, size.height) <= MAX_SIZE) {
    return saveImage(data, data[0] === 0x89 ? 'png' : 'jpg');
  }
  const ext = /\.[^.]+$/.exec(entry)?.[0] ?? '';
  const temp = new File(Paths.cache, `zip-${newId()}${ext}`);
  temp.write(data);
  try {
    return await importImage(temp.uri);
  } finally {
    if (temp.exists) temp.delete();
  }
}

/** Lets the progress text repaint between images. */
const yieldToUi = () => new Promise((r) => setTimeout(r, 0));

/**
 * Reads a pack zip and copies its pictures into the library. Book ids are only provisional:
 * the library makes them unique when it adds the pack. Returns the pack and how many pictures
 * couldn't be read. Throws if the file isn't a zip or holds no pictures.
 */
export async function readPack(
  zipFile: File,
  opts: { zipName: string; source: 'web' | 'file'; skipBooks?: string[]; onProgress?: Progress },
): Promise<{ pack: InstalledPack; failed: number }> {
  opts.onProgress?.('Opening…');
  await yieldToUi();
  const zip = await zipFile.bytes();
  let parsed: ParsedPack;
  try {
    parsed = parseZip(zip, opts.zipName);
  } catch {
    throw new Error("That file isn't a zip file the app can open.");
  }
  const id = parsed.id ?? newId();
  // Website books keep their folder ids, so coloring saved before (or before an update) shows up again.
  const bookId = (key: string) => (parsed.id ? key : `${id}-${key}`);
  const books = parsed.books.filter((b) => !opts.skipBooks?.includes(bookId(b.key)));
  if (!books.length) throw new Error('No pictures were found in that zip file.');

  const total = books.reduce((n, b) => n + b.pages.length, 0);
  let done = 0;
  let failed = 0;
  const stored: string[] = [];
  const store = async (entry: string) => {
    try {
      const file = await storeImage(readEntry(zip, entry), entry);
      stored.push(file);
      return file;
    } catch {
      failed++;
      return undefined;
    }
  };

  const out: PackBook[] = [];
  for (const b of books) {
    const book: PackBook = { id: bookId(b.key), title: b.title, pages: [] };
    if (b.cover) book.cover = await store(b.cover);
    for (const p of b.pages) {
      const file = await store(p.entry);
      let pageId = p.id;
      for (let n = 2; book.pages.some((x) => x.id === pageId); n++) pageId = `${p.id}-${n}`;
      if (file) book.pages.push({ id: pageId, title: p.title, file });
      done++;
      opts.onProgress?.(`Adding pages… ${done} of ${total}`);
      await yieldToUi();
    }
    if (book.pages.length) out.push(book);
  }
  if (!out.length) {
    stored.forEach(deleteImage);
    throw new Error("None of the pictures in that zip file could be read.");
  }
  return {
    pack: { id, title: parsed.title, version: parsed.version, source: opts.source, books: out, removed: opts.skipBooks ?? [] },
    failed,
  };
}
