import { generatedBooks } from './books.generated';

export type Page = {
  id: string;
  title: string;
  /** A bundled image (`require('…png')`). */
  image: number;
};

export type Book = {
  id: string;
  title: string;
  /** Optional cover art; falls back to the first page's image. */
  cover?: number;
  pages: Page[];
};

/**
 * The bundled library, generated from ColoringPages/ by scripts/build-content.mjs
 * (see the README). Ids are storage keys for saved coloring, so keep folder and
 * file names stable once people have started coloring.
 */
export const books: Book[] = generatedBooks;

export function getBook(bookId: string): Book | undefined {
  return books.find((b) => b.id === bookId);
}

export function getPage(bookId: string, pageId: string): Page | undefined {
  return getBook(bookId)?.pages.find((p) => p.id === pageId);
}
