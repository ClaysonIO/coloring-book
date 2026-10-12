/**
 * The list of book packs on the website, built from BookPacks/ by scripts/build-packs.mjs and
 * published with the site. The app re-reads it to show new packs and to update installed ones,
 * so publishing the website is all it takes to ship new books.
 */
// The site's final address. GitHub Pages serves it on the custom domain; the github.io address
// redirects there over plain HTTP, which Android release builds refuse, so never go through it.
export const SITE_URL = 'https://www.clayson.io/coloring-book/';
export const PACKS_URL = `${SITE_URL}packs/`;
export const CATALOG_URL = `${PACKS_URL}index.json`;

export type CatalogPage = { id: string; title: string; thumb: string };
export type CatalogBook = { id: string; title: string; cover: string; pages: CatalogPage[] };
export type CatalogPack = {
  id: string;
  title: string;
  description: string;
  /** Changes whenever the pack's content does. */
  version: string;
  /** File name of the zip, relative to PACKS_URL. */
  zip: string;
  /** Zip size in bytes. */
  size: number;
  books: CatalogBook[];
};
export type Catalog = { format: number; packs: CatalogPack[] };

/** Absolute URL of a path from the catalog (zips and preview images are relative to it). */
export const packUrl = (path: string) => PACKS_URL + path;

/** Keeps only well-formed packs, so a bad edit on the website can't crash the app. */
export function parseCatalog(json: unknown): Catalog | null {
  if (!json || typeof json !== 'object' || !Array.isArray((json as Catalog).packs)) return null;
  const str = (v: unknown) => typeof v === 'string';
  const packs = (json as Catalog).packs.filter(
    (p) =>
      p &&
      str(p.id) &&
      str(p.title) &&
      str(p.version) &&
      str(p.zip) &&
      Array.isArray(p.books) &&
      p.books.every((b) => b && str(b.id) && str(b.title) && Array.isArray(b.pages)),
  );
  return { format: (json as Catalog).format ?? 1, packs };
}
