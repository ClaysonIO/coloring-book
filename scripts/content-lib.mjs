/**
 * Shared by build-content.mjs (books bundled in the app, from ColoringPages/) and
 * build-packs.mjs (downloadable book packs for the website, from BookPacks/).
 *
 * A book is a folder with a _book.json (see the README) next to its images.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as mupdf from 'mupdf';
import sharp from 'sharp';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const rel = (p) => path.relative(ROOT, p);

export const MAX_SIZE = 2048;
export const COVER_MAX_SIZE = 1024;

/** Formats sharp reads directly. */
const SHARP_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.tif', '.tiff', '.avif']);
/** Formats rendered with MuPDF first (multi-page documents, and images sharp can't read). */
const MUPDF_EXTS = new Set(['.pdf', '.xps', '.bmp', '.pnm', '.pbm', '.pgm', '.ppm', '.jxr', '.jp2', '.psd']);
const VECTOR_EXTS = new Set(['.pdf', '.xps', '.svg']);

export class ContentError extends Error {}

export function slug(s) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Sub-folders of `dir` that hold books (or packs), sorted so numeric prefixes order them. */
export function listFolders(dir) {
  return fs
    .readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/** Renders one page of a document/image with MuPDF and returns it as a PNG buffer. */
function renderWithMupdf(file, pageNumber, maxSize) {
  const ext = path.extname(file).toLowerCase();
  const data = fs.readFileSync(file);
  const doc = mupdf.Document.openDocument(data, path.basename(file));
  const count = doc.countPages();
  if (pageNumber < 1 || pageNumber > count) {
    throw new ContentError(`page ${pageNumber} requested but the file has ${count} page(s)`);
  }
  const page = doc.loadPage(pageNumber - 1);
  const [x0, y0, x1, y1] = page.getBounds();
  const w = x1 - x0;
  const h = y1 - y0;
  // Vector pages scale to MAX_SIZE; raster images keep their own pixel size (MuPDF reports them at 96 dpi).
  let scale;
  if (VECTOR_EXTS.has(ext)) {
    scale = maxSize / Math.max(w, h);
  } else {
    scale = new mupdf.Image(data).getWidth() / w;
  }
  const pixmap = page.toPixmap(mupdf.Matrix.scale(scale, scale), mupdf.ColorSpace.DeviceRGB, false);
  return Buffer.from(pixmap.asPNG());
}

/**
 * A sharp pipeline for one page of `file`, flattened onto white and fitted inside maxSize.
 * Finish it with .png()/.jpeg() and .toFile()/.toBuffer().
 */
export function loadImage(file, pageNumber, maxSize) {
  const ext = path.extname(file).toLowerCase();
  let input;
  if (MUPDF_EXTS.has(ext) || pageNumber !== 1) {
    input = sharp(renderWithMupdf(file, pageNumber, maxSize));
  } else if (SHARP_EXTS.has(ext)) {
    input = sharp(file, ext === '.svg' ? { density: 300 } : {});
  } else {
    throw new ContentError(`unsupported file type "${ext}"`);
  }
  return input.flatten({ background: '#ffffff' }).resize({
    width: maxSize,
    height: maxSize,
    fit: 'inside',
    withoutEnlargement: !VECTOR_EXTS.has(ext),
  });
}

/**
 * Reads and checks <dir>/_book.json, and works out each page's id. Ids key every user's saved
 * coloring, so they come from file names (or an explicit "id"), never from display names.
 * Returns { id, title, cover?: file, pages: [{ id, title, file, pageNumber }] } with absolute files.
 */
export function readBook(dir) {
  const jsonPath = path.join(dir, '_book.json');
  let json;
  try {
    json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    throw new ContentError(`${rel(jsonPath)}: ${e.code === 'ENOENT' ? 'missing' : `invalid JSON (${e.message})`}`);
  }
  const fail = (msg) => {
    throw new ContentError(`${rel(jsonPath)}: ${msg}`);
  };
  if (typeof json.name !== 'string' || !json.name.trim()) fail('"name" must be a non-empty string');
  if (json.cover !== undefined && typeof json.cover !== 'string') fail('"cover" must be a path string');
  if (!Array.isArray(json.pages) || json.pages.length === 0) fail('"pages" must be a non-empty array');
  json.pages.forEach((p, i) => {
    if (!p || typeof p.name !== 'string' || typeof p.path !== 'string') {
      fail(`pages[${i}] needs a "name" and a "path"`);
    }
    if (p.page !== undefined && !(Number.isInteger(p.page) && p.page >= 1)) {
      fail(`pages[${i}].page must be a whole number starting at 1`);
    }
    if (p.id !== undefined && (typeof p.id !== 'string' || !slug(p.id))) fail(`pages[${i}].id must be a string`);
  });

  const folder = path.basename(dir);
  const id = slug(folder);
  if (!id) throw new ContentError(`${rel(dir)}: folder name needs at least one letter or digit`);
  if (id === 'sketchbook') throw new ContentError(`${rel(dir)}: "sketchbook" is reserved for My Sketchbook; rename the folder`);

  const source = (p, what) => {
    const file = path.resolve(dir, p);
    if (!file.startsWith(dir + path.sep)) throw new ContentError(`${rel(dir)}: ${what} "${p}" must be inside the book folder`);
    if (!fs.existsSync(file)) throw new ContentError(`${rel(dir)}: ${what} "${p}" not found`);
    return file;
  };

  const book = { id, title: json.name.trim(), cover: json.cover ? source(json.cover, 'cover') : undefined, pages: [] };
  for (const p of json.pages) {
    const pageNumber = p.page ?? 1;
    const base = slug(p.id ?? path.basename(p.path, path.extname(p.path)));
    const pageId = p.id || pageNumber === 1 ? base : `${base}-p${pageNumber}`;
    if (!pageId) throw new ContentError(`${rel(dir)}: can't make an id from "${p.path}"; add an "id"`);
    if (book.pages.some((x) => x.id === pageId)) {
      throw new ContentError(`${rel(dir)}: two pages have id "${pageId}"; give one of them an "id"`);
    }
    book.pages.push({ id: pageId, title: p.name.trim(), file: source(p.path, 'page'), pageNumber });
  }
  return book;
}

/** Reads every book folder under `dir`, rejecting duplicate ids. */
export function readBooks(dir) {
  const books = [];
  for (const folder of listFolders(dir)) {
    const book = readBook(path.join(dir, folder));
    if (books.some((b) => b.id === book.id)) {
      throw new ContentError(`${rel(path.join(dir, folder))}: two book folders map to id "${book.id}"`);
    }
    books.push(book);
  }
  return books;
}

/** Runs `fn`, prefixing any error with the file and what it was for. */
export async function withContext(file, what, fn) {
  try {
    return await fn();
  } catch (e) {
    throw new ContentError(`${rel(file)} (${what}): ${e.message}`);
  }
}

export function runMain(main) {
  main().catch((e) => {
    console.error(e instanceof ContentError ? `Content error: ${e.message}` : e);
    process.exit(1);
  });
}
