/**
 * In-memory stand-in for expo-file-system, used only by the screenshot build (metro.config.js
 * swaps it in when SCREENSHOTS=1 and the platform is web). Files start out as the scene's seed:
 * text files arrive inline, images as URLs the browser can load directly.
 */
const ROOT = 'file:///';
const files = new Map(); // path -> { text?: string, bytes?: Uint8Array, url?: string, mtime: number }
const dirs = new Set();
const encoder = new TextEncoder();
const decoder = new TextDecoder();

/**
 * Files the app wrote get an http URL (the app adds ?v= to thumbnail URIs, which blob: URLs don't
 * allow). capture.mjs answers these requests by reading the bytes back with __readMemFile.
 */
const MEM = '/__mem';
window.__readMemFile = (path) => {
  const entry = files.get(path);
  if (!entry) return null;
  const bytes = entry.bytes ?? encoder.encode(entry.text);
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

const clean = (p) => p.replace(/\/+/g, '/').replace(/\/$/, '');

function join(parts) {
  let path = '';
  for (const part of parts) {
    const s = typeof part === 'string' ? part : part.path;
    if (/^[a-z]+:/i.test(s)) path = s.startsWith(ROOT) ? `/${s.slice(ROOT.length)}` : s;
    else path = `${path}/${s}`;
  }
  return path.startsWith('/') ? clean(path) : path;
}

function addParents(path) {
  for (let p = path.slice(0, path.lastIndexOf('/')); p; p = p.slice(0, p.lastIndexOf('/'))) dirs.add(p);
}

function put(path, entry) {
  files.set(path, { ...entry, mtime: Date.now() });
  addParents(path);
}

/** Loads the scene's files (written by screenshots/capture.mjs) before the app starts. */
export async function loadSeed(url) {
  const res = await fetch(url);
  if (!res.ok) return null;
  const seed = await res.json();
  for (const [path, entry] of Object.entries(seed.files ?? {})) put(clean(path), entry);
  return seed;
}

export class File {
  constructor(...parts) {
    this.path = join(parts);
  }
  get uri() {
    if (!this.path.startsWith('/')) return this.path;
    const entry = files.get(this.path);
    if (entry?.url) return entry.url;
    if (entry?.bytes) return `${location.origin}${MEM}${this.path}`;
    return ROOT + this.path.slice(1);
  }
  get name() {
    return this.path.slice(this.path.lastIndexOf('/') + 1);
  }
  get exists() {
    return files.has(this.path) || !this.path.startsWith('/');
  }
  get size() {
    const entry = files.get(this.path);
    return entry?.bytes?.length ?? (entry?.text ? encoder.encode(entry.text).length : 0);
  }
  info() {
    const entry = files.get(this.path);
    return { exists: !!entry, modificationTime: entry?.mtime, size: this.size, uri: this.uri };
  }
  create() {
    if (!files.has(this.path)) put(this.path, { text: '' });
  }
  delete() {
    files.delete(this.path);
  }
  write(content) {
    put(this.path, typeof content === 'string' ? { text: content } : { bytes: new Uint8Array(content) });
  }
  textSync() {
    const entry = files.get(this.path);
    if (!entry) throw new Error(`No file at ${this.path}`);
    return entry.text ?? decoder.decode(entry.bytes);
  }
  async text() {
    const entry = files.get(this.path);
    if (entry?.url) return (await fetch(entry.url)).text();
    return this.textSync();
  }
  bytesSync() {
    const entry = files.get(this.path);
    if (!entry || entry.url) throw new Error(`Can't read ${this.path} synchronously`);
    return entry.bytes ?? encoder.encode(entry.text);
  }
  async bytes() {
    const url = files.get(this.path)?.url ?? (this.path.startsWith('/') ? null : this.path);
    if (url) return new Uint8Array(await (await fetch(url)).arrayBuffer());
    return this.bytesSync();
  }
  moveSync(dest) {
    const entry = files.get(this.path) ?? { url: this.path };
    files.delete(this.path);
    put(dest.path, entry);
    this.path = dest.path;
  }
  move(dest) {
    this.moveSync(dest);
  }
  copy(dest) {
    put(dest.path, { ...files.get(this.path) });
  }
  static async downloadFileAsync(url, dest, options) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Download failed: ${res.status}`);
    const data = new Uint8Array(await res.arrayBuffer());
    options?.onProgress?.({ bytesWritten: data.length, totalBytes: data.length });
    const file = dest instanceof Directory ? new File(dest, url.slice(url.lastIndexOf('/') + 1).split('?')[0]) : dest;
    file.write(data);
    return file;
  }
}

export class Directory {
  constructor(...parts) {
    this.path = join(parts);
  }
  get uri() {
    return `${ROOT}${this.path.slice(1)}/`;
  }
  get name() {
    return this.path.slice(this.path.lastIndexOf('/') + 1);
  }
  get exists() {
    return dirs.has(this.path);
  }
  create() {
    dirs.add(this.path);
    addParents(this.path);
  }
  delete() {
    const prefix = `${this.path}/`;
    for (const key of [...files.keys()]) if (key.startsWith(prefix)) files.delete(key);
    for (const key of [...dirs]) if (key === this.path || key.startsWith(prefix)) dirs.delete(key);
  }
  list() {
    const prefix = `${this.path}/`;
    const names = new Set();
    for (const key of [...files.keys(), ...dirs]) {
      if (!key.startsWith(prefix)) continue;
      const rest = key.slice(prefix.length);
      const name = rest.split('/')[0];
      if (!names.has(name)) names.add(rest.includes('/') || dirs.has(prefix + name) ? `d:${name}` : `f:${name}`);
    }
    return [...names].map((n) => (n.startsWith('d:') ? new Directory(this, n.slice(2)) : new File(this, n.slice(2))));
  }
}

export const Paths = {
  document: new Directory('/document'),
  cache: new Directory('/cache'),
};
