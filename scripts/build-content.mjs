#!/usr/bin/env node
/**
 * Turns ColoringPages/ into something the app can bundle.
 *
 *   ColoringPages/<book-folder>/_book.json
 *   ColoringPages/<book-folder>/<images…>
 *
 * Every page and cover (PDF, PNG, JPG, GIF, WebP, SVG, TIFF, BMP, AVIF) is converted to a
 * white-backed PNG of at most MAX_SIZE px under generated/ColoringPages/, and
 * src/content/books.generated.ts is written with a static require() for each one
 * (React Native can only bundle images it can see at build time).
 *
 * Runs automatically on `npm install` and `npm start`; run it by hand with `npm run content`.
 * Unchanged images are skipped, so re-running is cheap.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import * as mupdf from 'mupdf';
import sharp from 'sharp';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'ColoringPages');
const OUT_DIR = path.join(ROOT, 'generated', 'ColoringPages');
const OUT_TS = path.join(ROOT, 'src', 'content', 'books.generated.ts');
const SCRIPT_MTIME = fs.statSync(fileURLToPath(import.meta.url)).mtimeMs;

const MAX_SIZE = 2048;
const COVER_MAX_SIZE = 1024;

/** Formats sharp reads directly. */
const SHARP_EXTS = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.tif', '.tiff', '.avif']);
/** Formats rendered with MuPDF first (multi-page documents, and images sharp can't read). */
const MUPDF_EXTS = new Set(['.pdf', '.xps', '.bmp', '.pnm', '.pbm', '.pgm', '.ppm', '.jxr', '.jp2', '.psd']);
const VECTOR_EXTS = new Set(['.pdf', '.xps', '.svg']);

class ContentError extends Error {}

function slug(s) {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
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

async function convert(file, pageNumber, outFile, maxSize) {
  if (fs.existsSync(outFile)) {
    const outTime = fs.statSync(outFile).mtimeMs;
    if (outTime > fs.statSync(file).mtimeMs && outTime > SCRIPT_MTIME) return false;
  }
  const ext = path.extname(file).toLowerCase();
  let input;
  if (MUPDF_EXTS.has(ext) || pageNumber !== 1) {
    input = sharp(renderWithMupdf(file, pageNumber, maxSize));
  } else if (SHARP_EXTS.has(ext)) {
    input = sharp(file, ext === '.svg' ? { density: 300 } : {});
  } else {
    throw new ContentError(`unsupported file type "${ext}"`);
  }
  fs.mkdirSync(path.dirname(outFile), { recursive: true });
  await input
    .flatten({ background: '#ffffff' })
    .resize({
      width: maxSize,
      height: maxSize,
      fit: 'inside',
      withoutEnlargement: !VECTOR_EXTS.has(ext),
    })
    .png({ compressionLevel: 9 })
    .toFile(outFile);
  return true;
}

function readBookJson(dir) {
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
  return json;
}

const rel = (p) => path.relative(ROOT, p);

async function main() {
  if (!fs.existsSync(SOURCE_DIR)) throw new ContentError(`${rel(SOURCE_DIR)}/ not found`);

  const produced = new Set();
  const books = [];
  let converted = 0;

  const folders = fs
    .readdirSync(SOURCE_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith('.') && !d.name.startsWith('_'))
    .map((d) => d.name)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

  for (const folder of folders) {
    const dir = path.join(SOURCE_DIR, folder);
    const json = readBookJson(dir);
    const bookId = slug(folder);
    if (!bookId) throw new ContentError(`${rel(dir)}: folder name needs at least one letter or digit`);
    if (books.some((b) => b.id === bookId)) throw new ContentError(`${rel(dir)}: two book folders map to id "${bookId}"`);

    const source = (p, what) => {
      const file = path.resolve(dir, p);
      if (!file.startsWith(dir + path.sep)) throw new ContentError(`${rel(dir)}: ${what} "${p}" must be inside the book folder`);
      if (!fs.existsSync(file)) throw new ContentError(`${rel(dir)}: ${what} "${p}" not found`);
      return file;
    };
    const run = async (file, pageNumber, outFile, maxSize, what) => {
      try {
        if (await convert(file, pageNumber, outFile, maxSize)) converted++;
      } catch (e) {
        throw new ContentError(`${rel(file)} (${what}): ${e.message}`);
      }
      produced.add(outFile);
    };

    const book = { id: bookId, title: json.name.trim(), cover: null, pages: [] };

    if (json.cover) {
      const out = path.join(OUT_DIR, bookId, '_cover.png');
      await run(source(json.cover, 'cover'), 1, out, COVER_MAX_SIZE, 'cover');
      book.cover = out;
    }

    for (const p of json.pages) {
      const pageNumber = p.page ?? 1;
      // Page ids key each user's saved coloring, so they come from the file name, not the display name.
      const base = slug(p.id ?? path.basename(p.path, path.extname(p.path)));
      const id = (p.id || pageNumber === 1) ? base : `${base}-p${pageNumber}`;
      if (!id) throw new ContentError(`${rel(dir)}: can't make an id from "${p.path}"; add an "id"`);
      if (book.pages.some((x) => x.id === id)) {
        throw new ContentError(`${rel(dir)}: two pages have id "${id}"; give one of them an "id"`);
      }
      const out = path.join(OUT_DIR, bookId, `${id}.png`);
      await run(source(p.path, 'page'), pageNumber, out, MAX_SIZE, p.name);
      book.pages.push({ id, title: p.name.trim(), image: out });
    }
    books.push(book);
  }

  // Drop images from books or pages that no longer exist.
  const walk = (d) =>
    fs.existsSync(d)
      ? fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]))
      : [];
  for (const f of walk(OUT_DIR)) if (!produced.has(f)) fs.rmSync(f);
  if (fs.existsSync(OUT_DIR)) {
    for (const d of fs.readdirSync(OUT_DIR)) {
      const full = path.join(OUT_DIR, d);
      if (fs.statSync(full).isDirectory() && fs.readdirSync(full).length === 0) fs.rmdirSync(full);
    }
  }

  const req = (file) => `require(${JSON.stringify(path.relative(path.dirname(OUT_TS), file).split(path.sep).join('/'))})`;
  const ts = [
    '// AUTO-GENERATED by scripts/build-content.mjs from ColoringPages/. Do not edit; run `npm run content`.',
    "import type { Book } from './books';",
    '',
    'export const generatedBooks: Book[] = [',
    ...books.flatMap((b) => [
      '  {',
      `    id: ${JSON.stringify(b.id)},`,
      `    title: ${JSON.stringify(b.title)},`,
      ...(b.cover ? [`    cover: ${req(b.cover)},`] : []),
      '    pages: [',
      ...b.pages.map((p) => `      { id: ${JSON.stringify(p.id)}, title: ${JSON.stringify(p.title)}, image: ${req(p.image)} },`),
      '    ],',
      '  },',
    ]),
    '];',
    '',
  ].join('\n');
  if (!fs.existsSync(OUT_TS) || fs.readFileSync(OUT_TS, 'utf8') !== ts) fs.writeFileSync(OUT_TS, ts);

  const pageCount = books.reduce((n, b) => n + b.pages.length, 0);
  console.log(`ColoringPages: ${books.length} book(s), ${pageCount} page(s), ${converted} image(s) converted.`);
}

main().catch((e) => {
  console.error(e instanceof ContentError ? `ColoringPages error: ${e.message}` : e);
  process.exit(1);
});
