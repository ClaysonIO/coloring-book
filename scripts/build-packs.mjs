#!/usr/bin/env node
/**
 * Builds the downloadable book packs for the website from BookPacks/.
 *
 *   BookPacks/<pack-folder>/_pack.json        { "title": "…", "description": "…" }
 *   BookPacks/<pack-folder>/<book-folder>/…   books, same layout as ColoringPages/ (see the README)
 *
 * Writes docs/packs/ (git-ignored; the Website workflow runs this before publishing docs/):
 *
 *   index.json                          the catalog the app and docs/books.html read
 *   <pack>-<version>.zip                the pack, ready for the app to import
 *   <pack>/<book>/_cover.jpg            preview images for the website and the app's
 *   <pack>/<book>/<page>.jpg            "Get more books" screen
 *
 * Inside the zip each book is a folder with a _book.json that lists every page's "id", so ids
 * (which key saved coloring) match what the app would have used had the book been bundled.
 * JPEGs that already fit MAX_SIZE are copied as they are; everything else becomes a PNG.
 *
 * The version is a hash of the zip, so a pack's URL changes whenever its content does and the
 * app knows to update. Run with `npm run packs`.
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

import { zipSync } from 'fflate';
import sharp from 'sharp';

import { COVER_MAX_SIZE, ContentError, MAX_SIZE, ROOT, listFolders, loadImage, readBooks, rel, runMain, slug, withContext } from './content-lib.mjs';

const SOURCE_DIR = path.join(ROOT, 'BookPacks');
const BUNDLED_DIR = path.join(ROOT, 'ColoringPages');
const OUT_DIR = path.join(ROOT, 'docs', 'packs');

const PAGE_THUMB = 240;
const COVER_THUMB = 360;
/** Fixed timestamps keep the zip (and so the version) the same for the same content. */
const ZIP_MTIME = new Date('2000-01-01T00:00:00Z');

/** Returns { data, ext } for a page or cover as it goes into the zip. */
async function packImage(file, pageNumber, maxSize) {
  const ext = path.extname(file).toLowerCase();
  if ((ext === '.jpg' || ext === '.jpeg') && pageNumber === 1) {
    const meta = await sharp(file).metadata();
    const data = fs.readFileSync(file);
    if (Math.max(meta.width, meta.height) <= maxSize) return { data, ext: 'jpg' };
    return { data: await loadImage(file, 1, maxSize).jpeg({ quality: 90 }).toBuffer(), ext: 'jpg' };
  }
  return { data: await loadImage(file, pageNumber, maxSize).png({ compressionLevel: 9 }).toBuffer(), ext: 'png' };
}

async function thumbnail(data, size, outFile) {
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await sharp(data).flatten({ background: '#ffffff' }).resize(size, size, { fit: 'inside' }).jpeg({ quality: 72 }).toFile(outFile);
}

function readPackJson(dir) {
  const jsonPath = path.join(dir, '_pack.json');
  let json;
  try {
    json = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  } catch (e) {
    throw new ContentError(`${rel(jsonPath)}: ${e.code === 'ENOENT' ? 'missing' : `invalid JSON (${e.message})`}`);
  }
  if (typeof json.title !== 'string' || !json.title.trim()) throw new ContentError(`${rel(jsonPath)}: "title" must be a non-empty string`);
  if (json.description !== undefined && typeof json.description !== 'string') {
    throw new ContentError(`${rel(jsonPath)}: "description" must be a string`);
  }
  return { title: json.title.trim(), description: json.description?.trim() ?? '' };
}

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) throw new ContentError(`${rel(SOURCE_DIR)}/ not found`);
  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });

  // Book ids key saved coloring across the whole app, so they must be unique across packs and
  // the bundled books too.
  const usedIds = new Map(readBooks(BUNDLED_DIR).map((b) => [b.id, 'ColoringPages']));
  const catalog = { format: 1, packs: [] };

  for (const folder of listFolders(SOURCE_DIR)) {
    const dir = path.join(SOURCE_DIR, folder);
    const id = slug(folder);
    if (!id) throw new ContentError(`${rel(dir)}: folder name needs at least one letter or digit`);
    const meta = readPackJson(dir);
    const books = readBooks(dir);
    if (books.length === 0) throw new ContentError(`${rel(dir)}: no books`);

    const files = {};
    const entry = { id, title: meta.title, description: meta.description, version: '', zip: '', size: 0, books: [] };
    for (const book of books) {
      if (usedIds.has(book.id)) throw new ContentError(`${rel(dir)}: book id "${book.id}" is also used in ${usedIds.get(book.id)}`);
      usedIds.set(book.id, rel(dir));

      const thumbDir = path.join(OUT_DIR, id, book.id);
      const bookJson = { name: book.title, pages: [] };
      const listed = { id: book.id, title: book.title, cover: '', pages: [] };

      for (const p of book.pages) {
        const img = await withContext(p.file, p.title, () => packImage(p.file, p.pageNumber, MAX_SIZE));
        const name = `${p.id}.${img.ext}`;
        files[`${book.id}/${name}`] = [img.data, { level: 0 }];
        bookJson.pages.push({ id: p.id, name: p.title, path: name });
        await thumbnail(img.data, PAGE_THUMB, path.join(thumbDir, `${p.id}.jpg`));
        listed.pages.push({ id: p.id, title: p.title, thumb: `${id}/${book.id}/${p.id}.jpg` });
      }
      const coverSource = book.cover ?? book.pages[0].file;
      const cover = await withContext(coverSource, 'cover', () => packImage(coverSource, book.cover ? 1 : book.pages[0].pageNumber, COVER_MAX_SIZE));
      if (book.cover) {
        files[`${book.id}/_cover.${cover.ext}`] = [cover.data, { level: 0 }];
        bookJson.cover = `_cover.${cover.ext}`;
      }
      await thumbnail(cover.data, COVER_THUMB, path.join(thumbDir, '_cover.jpg'));
      listed.cover = `${id}/${book.id}/_cover.jpg`;

      files[`${book.id}/_book.json`] = new TextEncoder().encode(`${JSON.stringify(bookJson, null, 2)}\n`);
      entry.books.push(listed);
    }

    // The version is a hash of everything but _pack.json itself (which carries the version).
    const contentZip = zipSync(files, { mtime: ZIP_MTIME });
    entry.version = crypto.createHash('sha256').update(contentZip).digest('hex').slice(0, 12);
    files['_pack.json'] = new TextEncoder().encode(
      `${JSON.stringify({ id, title: meta.title, description: meta.description, version: entry.version }, null, 2)}\n`,
    );
    const zip = zipSync(files, { mtime: ZIP_MTIME });
    entry.zip = `${id}-${entry.version}.zip`;
    entry.size = zip.length;
    fs.writeFileSync(path.join(OUT_DIR, entry.zip), zip);
    catalog.packs.push(entry);

    const pages = entry.books.reduce((n, b) => n + b.pages.length, 0);
    console.log(`BookPacks/${folder}: ${entry.books.length} book(s), ${pages} page(s), ${(zip.length / 1e6).toFixed(1)} MB -> ${rel(path.join(OUT_DIR, entry.zip))}`);
  }

  fs.writeFileSync(path.join(OUT_DIR, 'index.json'), `${JSON.stringify(catalog, null, 2)}\n`);
  console.log(`Wrote ${rel(path.join(OUT_DIR, 'index.json'))} with ${catalog.packs.length} pack(s).`);
}

runMain(main);
