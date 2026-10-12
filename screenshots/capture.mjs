#!/usr/bin/env node
/**
 * Takes screenshots of the real app for the website and the app stores. See screenshots/README.md.
 *
 *   node screenshots/capture.mjs [--devices a,b] [--scenes a,b] [--themes light,dark] [--out dir]
 *                                [--website] [--skip-build]
 *
 * Builds the app for the web (SCREENSHOTS=1, see metro.config.js), serves it with a seeded
 * in-memory file system, and drives each scene in headless Chromium with Playwright.
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { parseArgs } from 'node:util';

import { strFromU8, unzipSync } from 'fflate';
import { chromium } from 'playwright';
import sharp from 'sharp';

import { ROOT } from '../scripts/content-lib.mjs';
import { DEVICES, SCENES, WEBSITE, fixture } from './scenes.mjs';

const HERE = path.join(ROOT, 'screenshots');
const BUILD = path.join(HERE, '.build');
const DIST = path.join(BUILD, 'dist');
const FS_DIR = path.join(BUILD, 'fs');
const PACKS = path.join(ROOT, 'docs', 'packs');
const SITE_PACKS = 'https://www.clayson.io/coloring-book/packs/';

const { values: opts } = parseArgs({
  options: {
    devices: { type: 'string' },
    scenes: { type: 'string' },
    themes: { type: 'string', default: 'light' },
    out: { type: 'string', default: path.join(HERE, 'output') },
    website: { type: 'boolean', default: false },
    'skip-build': { type: 'boolean', default: false },
  },
});

const list = (s, all) => (s ? s.split(',').map((x) => x.trim()) : all);
const log = (...a) => console.log(...a);

function run(cmd, args, env = {}) {
  execFileSync(cmd, args, { cwd: ROOT, stdio: 'inherit', env: { ...process.env, ...env } });
}

function build() {
  if (!fs.existsSync(path.join(PACKS, 'index.json'))) run('npm', ['run', 'packs']);
  log('Building the web version of the app…');
  run('npx', ['expo', 'export', '--platform', 'web', '--output-dir', DIST], { SCREENSHOTS: '1' });
  fs.copyFileSync(path.join(ROOT, 'node_modules', 'canvaskit-wasm', 'bin', 'full', 'canvaskit.wasm'), path.join(DIST, 'canvaskit.wasm'));
}

/**
 * The website's packs, as the app stores them once downloaded: images go to FS_DIR (served at
 * /fs/) and library.json lists them, exactly like LibraryContext.installPack would.
 */
function installedPacks() {
  const catalog = JSON.parse(fs.readFileSync(path.join(PACKS, 'index.json'), 'utf8'));
  fs.rmSync(FS_DIR, { recursive: true, force: true });
  fs.mkdirSync(FS_DIR, { recursive: true });
  const files = {};
  const packs = catalog.packs.map((entry) => {
    const zip = unzipSync(fs.readFileSync(path.join(PACKS, entry.zip)));
    const meta = JSON.parse(strFromU8(zip['_pack.json']));
    const store = (name) => {
      const file = name.replaceAll('/', '__');
      fs.writeFileSync(path.join(FS_DIR, file), zip[name]);
      files[`/document/coloring/library/images/${file}`] = { url: `/fs/${file}` };
      return file;
    };
    const books = entry.books.map((b) => {
      const json = JSON.parse(strFromU8(zip[`${b.id}/_book.json`]));
      return {
        id: b.id,
        title: json.name,
        ...(json.cover ? { cover: store(`${b.id}/${json.cover}`) } : {}),
        pages: json.pages.map((p) => ({ id: p.id, title: p.name, file: store(`${b.id}/${p.path}`) })),
      };
    });
    return { id: meta.id, title: meta.title, version: meta.version, source: 'web', books, removed: [] };
  });
  return { catalog, packs, files };
}

/** seed.json for a scene: the files the app finds on "disk" plus pages to pre-color. */
function makeSeed(scene, installed) {
  const fx = { ...fixture, ...scene.fixture };
  const files = { ...installed.files };
  const text = (p, value) => (files[p] = { text: JSON.stringify(value) });
  text('/document/coloring/users.json', fx.users);
  text('/document/coloring/library/catalog.json', installed.catalog);
  text('/document/coloring/library/library.json', {
    books: [],
    extraPages: {},
    hiddenBooks: [],
    hiddenPages: [],
    packs: fx.packs ? installed.packs : [],
    seenPacks: installed.catalog.packs.map((p) => p.id),
  });
  for (const [userId, pages] of Object.entries(fx.sketchbooks ?? {})) text(`/document/coloring/users/${userId}/sketchbook.json`, pages);

  const pageFile = (bookId, pageId) => {
    for (const pack of installed.packs)
      for (const b of pack.books) if (b.id === bookId) return b.pages.find((p) => p.id === pageId)?.file;
  };
  const colorings = (fx.colorings ?? []).map((c) => {
    const file = pageFile(c.bookId, c.pageId);
    if (!file) throw new Error(`Scene ${scene.name}: no page ${c.bookId}/${c.pageId} in the installed packs`);
    return { ...c, image: `/fs/${file}` };
  });
  return { files, colorings };
}

function serve(getSeed) {
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.jpg': 'image/jpeg', '.ttf': 'font/ttf', '.ico': 'image/x-icon' };
  const server = http.createServer((req, res) => {
    const url = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    if (url === '/seed.json') {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(JSON.stringify(getSeed()));
    }
    let file = url.startsWith('/fs/') ? path.join(FS_DIR, url.slice(4)) : path.join(DIST, url);
    if (!file.startsWith(BUILD) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    res.writeHead(200, { 'content-type': types[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

/** What scenes can do with the app. Coordinates for drawing are 0–1 across the page. */
function helpers(page) {
  const settle = async (ms = 600) => {
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => Promise.all([...document.images].map((i) => (i.complete ? null : i.decode().catch(() => null)))));
    await page.waitForTimeout(ms);
  };
  const app = {
    page,
    settle,
    /** Taps the control with this accessibility label (or visible text). */
    async tap(label) {
      const byLabel = page.locator(`[aria-label="${label}"]`).first();
      await ((await byLabel.count()) ? byLabel : page.getByText(label, { exact: true }).first()).click();
      await settle();
    },
    async chooseUser(name) {
      await page.getByText(name, { exact: true }).click();
      await settle();
    },
    /** Navigates inside the app, e.g. '/book/church-03-christmas'. */
    async go(href) {
      await page.evaluate((h) => window.__router.push(h), href);
      await settle(1000);
    },
    async back() {
      await page.evaluate(() => window.__router.back());
      await settle();
    },
    async crayon(color) {
      await page.locator(`[aria-label="Color ${color}"]`).click();
      await settle(300);
    },
    async tool(label) {
      await app.tap('Coloring tools');
      await app.tap(label);
      await app.tap('Done');
    },
    /** Screen rectangle of the page being colored (the biggest canvas on screen). */
    async pageBox() {
      const boxes = await Promise.all((await page.locator('canvas').all()).map((c) => c.boundingBox()));
      return boxes.filter(Boolean).sort((a, b) => b.width * b.height - a.width * a.height)[0];
    },
    /** strokes: [{ color?, tool?, points: [[x, y], …] }] */
    async draw(strokes) {
      for (const s of strokes) {
        if (s.tool) await app.tool(s.tool);
        if (s.color) await app.crayon(s.color);
        const box = await app.pageBox();
        const at = ([x, y]) => [box.x + x * box.width, box.y + y * box.height];
        await page.mouse.move(...at(s.points[0]));
        await page.mouse.down();
        for (const p of s.points.slice(1)) await page.mouse.move(...at(p), { steps: 4 });
        await page.mouse.up();
      }
      await settle(1200);
    },
  };
  return app;
}

async function main() {
  const devices = list(opts.devices, Object.keys(DEVICES));
  const scenes = list(opts.scenes, SCENES.map((s) => s.name));
  const themes = list(opts.themes, ['light']);
  for (const d of devices) if (!DEVICES[d]) throw new Error(`Unknown device "${d}". Known: ${Object.keys(DEVICES).join(', ')}`);
  for (const s of scenes) if (!SCENES.some((x) => x.name === s)) throw new Error(`Unknown scene "${s}". Known: ${SCENES.map((x) => x.name).join(', ')}`);

  // --website captures only what the site uses, in every theme it uses.
  const jobs = opts.website
    ? WEBSITE.map((w) => ({ ...w, out: null }))
    : devices.flatMap((device) => themes.flatMap((theme) => scenes.map((scene) => ({ device, theme, scene }))));

  if (!opts['skip-build'] || !fs.existsSync(path.join(DIST, 'index.html'))) build();
  const installed = installedPacks();
  let seed = null;
  const server = await serve(() => seed);
  const origin = `http://127.0.0.1:${server.address().port}`;
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || undefined });

  try {
    for (const job of jobs) {
      const scene = SCENES.find((s) => s.name === job.scene);
      const device = DEVICES[job.device];
      seed = makeSeed(scene, installed);
      const context = await browser.newContext({
        viewport: { width: device.width, height: device.height },
        deviceScaleFactor: device.scale,
        colorScheme: job.theme,
        hasTouch: false,
      });
      const page = await context.newPage();
      page.on('pageerror', (e) => log(`  [${job.scene}] page error: ${e.message}`));
      // The app's "More books" screen reads the website; answer from the local build of docs/packs.
      await page.route(`${SITE_PACKS}**`, (route) => {
        const file = path.join(PACKS, new URL(route.request().url()).pathname.replace('/coloring-book/packs/', ''));
        return fs.existsSync(file) ? route.fulfill({ path: file }) : route.fulfill({ status: 404 });
      });
      // Images the app wrote to its (in-memory) files, e.g. thumbnails of colored pages.
      await page.route('**/__mem/**', async (route) => {
        const file = decodeURIComponent(new URL(route.request().url()).pathname.slice('/__mem'.length));
        const b64 = await page.evaluate((f) => window.__readMemFile(f), file);
        return b64 ? route.fulfill({ body: Buffer.from(b64, 'base64'), contentType: 'image/png' }) : route.fulfill({ status: 404 });
      });
      await page.goto(origin);
      await page.waitForFunction(() => window.__appStarted, null, { timeout: 120_000 });
      const app = helpers(page);
      await app.settle(1000);
      await scene.run(app, { device: job.device, ...device, theme: job.theme });
      await app.settle(800);
      const png = await page.screenshot({ type: 'png' });
      await context.close();

      if (job.file) {
        const out = path.join(ROOT, 'docs', 'images', job.file);
        let img = sharp(png);
        if (job.width) img = img.resize({ width: job.width });
        await (out.endsWith('.png') ? img.png({ compressionLevel: 9 }) : img.jpeg({ quality: 82, mozjpeg: true })).toFile(out);
        log(`✓ ${path.relative(ROOT, out)}`);
      } else {
        const index = String(SCENES.indexOf(scene) + 1).padStart(2, '0');
        const dir = path.join(opts.out, themes.length > 1 ? `${job.device}-${job.theme}` : job.device);
        fs.mkdirSync(dir, { recursive: true });
        const out = path.join(dir, `${index}-${scene.name}.png`);
        fs.writeFileSync(out, png);
        log(`✓ ${path.relative(ROOT, out)}`);
      }
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
