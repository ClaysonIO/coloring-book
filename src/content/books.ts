import { generatedBooks } from './books.generated';

/** A bundled image (`require('…png')`) or a file:// uri for images added in the app. */
export type ImageRef = number | string;

export type Page = {
  id: string;
  title: string;
  image: ImageRef;
  /** Added in the app (can be renamed), as opposed to bundled from ColoringPages/. */
  custom?: boolean;
};

export type Book = {
  id: string;
  title: string;
  /** Optional cover art; falls back to the first page's image. */
  cover?: ImageRef;
  pages: Page[];
  custom?: boolean;
  /** The per-user blank-page book: can't be removed, pages are added blank. */
  sketchbook?: boolean;
};

export const SKETCHBOOK_ID = 'sketchbook';
export const SKETCHBOOK_COVER: number = require('../../assets/sketchbook/cover.png');
export const BLANK_PAGE: number = require('../../assets/sketchbook/blank.png');

/**
 * The bundled library, generated from ColoringPages/ by scripts/build-content.mjs
 * (see the README). Ids are storage keys for saved coloring, so keep folder and
 * file names stable once people have started coloring. Books and pages added in
 * the app are merged in by LibraryContext.
 */
export const bundledBooks: Book[] = generatedBooks;
