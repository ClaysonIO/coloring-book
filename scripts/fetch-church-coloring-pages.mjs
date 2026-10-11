#!/usr/bin/env node
/**
 * Downloads the coloring pages from the Church of Jesus Christ's media library into ColoringPages/,
 * one book per grouping on https://www.churchofjesuschrist.org/media/collection/coloring-pages-images
 *
 *   node scripts/fetch-church-coloring-pages.mjs
 *
 * Each grouping becomes ColoringPages/church-<nn>-<name>/ with the largest JPEG the site offers for
 * every page and a _book.json in the site's order. File names come from the site's page URLs, so
 * they stay stable (they key saved coloring). Files already downloaded are skipped; _book.json is
 * rewritten every run. Then run `npm run content` as usual.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE_DIR = path.join(ROOT, 'ColoringPages');
const SITE = 'https://www.churchofjesuschrist.org';
const LANG = 'eng';

/** Groupings on the parent page, in the page's order, with shorter book titles for the app. */
const GROUPS = [
  { uri: 'family-history-coloring-pages-images', folder: 'church-01-family-history', name: 'Family History' },
  { uri: 'coloring-pages-general-images', folder: 'church-02-general', name: 'General' },
  { uri: 'coloring-pages-christmas-images', folder: 'church-03-christmas', name: 'Christmas' },
  {
    uri: 'scripture-stories-coloring-book-book-of-mormon-images',
    folder: 'church-04-book-of-mormon',
    name: 'Book of Mormon Stories',
  },
  {
    uri: 'scripture-stories-coloring-book-pearl-of-great-price-images',
    folder: 'church-05-pearl-of-great-price',
    name: 'Pearl of Great Price Stories',
  },
  { uri: 'general-conference-coloring-pages', folder: 'church-06-general-conference', name: 'General Conference' },
];

const SIZE_ORDER = ['SMALL', 'MEDIUM', 'LARGE'];

async function fetchOk(url) {
  for (let attempt = 1; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (coloring-book content script)' } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (e) {
      if (attempt >= 4) throw new Error(`${url}: ${e.message}`);
      await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
    }
  }
}

const getCollection = async (uri) =>
  (await fetchOk(`${SITE}/media/api/getcollection?offset=0&limit=500&uri=${encodeURIComponent(uri)}&lang=${LANG}`)).json();

async function download(url, file) {
  if (fs.existsSync(file)) return false;
  const buf = Buffer.from(await (await fetchOk(url)).arrayBuffer());
  fs.writeFileSync(`${file}.part`, buf);
  fs.renameSync(`${file}.part`, file);
  return true;
}

/** "/image/girl-eighth-birthday-a65b535?lang=eng" -> "girl-eighth-birthday-a65b535" */
const fileBase = (item) => item.href.split('?')[0].split('/').pop() || item.id;

async function main() {
  let downloaded = 0;
  let total = 0;
  for (const group of GROUPS) {
    const collection = await getCollection(group.uri);
    const items = collection.items.filter((i) => i.type === 'image' && i.downloads?.length);
    const dir = path.join(SOURCE_DIR, group.folder);
    fs.mkdirSync(dir, { recursive: true });

    const pages = [];
    for (const item of items) {
      const best = [...item.downloads].sort(
        (a, b) => SIZE_ORDER.indexOf(a.downloadType) - SIZE_ORDER.indexOf(b.downloadType),
      ).pop();
      const file = `${fileBase(item)}.jpg`;
      if (await download(best.url, path.join(dir, file))) downloaded++;
      pages.push({ name: item.title.trim(), path: file });
    }
    total += pages.length;

    // Use the site's cover for the grouping when it is one of its pages; otherwise the first page.
    const coverId = collection.coverImage?.assetId;
    const coverIndex = items.findIndex((i) => i.id === coverId);
    const book = { name: group.name, ...(coverIndex >= 0 ? { cover: pages[coverIndex].path } : {}), pages };
    fs.writeFileSync(path.join(dir, '_book.json'), `${JSON.stringify(book, null, 2)}\n`);

    // Drop images the site no longer lists.
    const keep = new Set(['_book.json', ...pages.map((p) => p.path)]);
    for (const f of fs.readdirSync(dir)) if (!keep.has(f)) fs.rmSync(path.join(dir, f));

    console.log(`${group.name}: ${pages.length} page(s)`);
  }
  console.log(`Done: ${GROUPS.length} book(s), ${total} page(s), ${downloaded} downloaded.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
