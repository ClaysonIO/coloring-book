import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import { bundledBooks, SKETCHBOOK_COVER, SKETCHBOOK_ID, type Book, type Page } from '../content/books';
import * as lib from './library';
import type { CustomPage, LibraryData } from './library';
import * as storage from './storage';
import { useUsers } from './UsersContext';

export type PickedImage = { uri: string; name?: string | null };

type LibraryContextValue = {
  books: Book[];
  getBook: (bookId: string) => Book | undefined;
  getPage: (bookId: string, pageId: string) => Page | undefined;
  createBook: (title: string, cover?: PickedImage) => Promise<string>;
  renameBook: (bookId: string, title: string) => void;
  removeBook: (bookId: string) => void;
  /** Imports images one at a time; returns how many could not be read. */
  addPages: (bookId: string, images: PickedImage[], onProgress?: (done: number) => void) => Promise<number>;
  renamePage: (bookId: string, pageId: string, title: string) => void;
  /** Adds a blank page to the current user's sketchbook. */
  addSketchPage: () => void;
  /** Fixes a sketchbook page's size the first time it is opened. */
  setSketchPageSize: (pageId: string, width: number, height: number) => void;
  removePage: (bookId: string, pageId: string) => void;
  hasRemovedBuiltIns: boolean;
  restoreBuiltIns: () => void;
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

const toPage = (p: CustomPage): Page => ({ id: p.id, title: p.title, image: lib.imageUri(p.file), custom: true });

/** "IMG_1234.HEIC" -> "IMG 1234"; falls back to "Page N". */
function titleFrom(name: string | null | undefined, fallback: string) {
  const base = name?.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim();
  return base || fallback;
}

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { users, currentUser, revision, bumpRevision } = useUsers();
  const [data, setData] = useState<LibraryData>(() => lib.loadLibrary());
  const [sketchVersion, setSketchVersion] = useState(0);
  const userId = currentUser?.id;

  // Re-read after account resets too (they delete the file, which restores the single default page).
  const sketchPages = useMemo(
    () => (userId ? storage.loadSketchbook(userId) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [userId, revision, sketchVersion],
  );
  const saveSketch = useCallback(
    (pages: storage.SketchPage[]) => {
      if (!userId) return;
      storage.saveSketchbook(userId, pages);
      setSketchVersion((v) => v + 1);
    },
    [userId],
  );

  const update = useCallback((fn: (d: LibraryData) => LibraryData) => {
    setData((prev) => {
      const next = fn(prev);
      lib.saveLibrary(next);
      return next;
    });
  }, []);

  const books = useMemo<Book[]>(() => {
    const hiddenPages = new Set(data.hiddenPages);
    const builtIn = bundledBooks
      .filter((b) => !data.hiddenBooks.includes(b.id))
      .map((b) => ({
        ...b,
        pages: [
          ...b.pages.filter((p) => !hiddenPages.has(`${b.id}/${p.id}`)),
          ...(data.extraPages[b.id] ?? []).map(toPage),
        ],
      }));
    const custom = data.books.map<Book>((b) => ({
      id: b.id,
      title: b.title,
      cover: b.cover ? lib.imageUri(b.cover) : undefined,
      pages: b.pages.map(toPage),
      custom: true,
    }));
    const sketchbook: Book = {
      id: SKETCHBOOK_ID,
      title: 'My Sketchbook',
      cover: SKETCHBOOK_COVER,
      pages: sketchPages.map((p) => ({
        id: p.id,
        title: p.title,
        custom: true,
        blank: p.width && p.height ? { width: p.width, height: p.height } : null,
      })),
      sketchbook: true,
    };
    return [...(userId ? [sketchbook] : []), ...builtIn, ...custom];
  }, [data, sketchPages, userId]);

  const getBook = useCallback((bookId: string) => books.find((b) => b.id === bookId), [books]);
  const getPage = useCallback(
    (bookId: string, pageId: string) => getBook(bookId)?.pages.find((p) => p.id === pageId),
    [getBook],
  );

  const createBook = useCallback(
    async (title: string, cover?: PickedImage) => {
      const id = lib.newId();
      const coverFile = cover ? await lib.importImage(cover.uri) : undefined;
      update((d) => ({ ...d, books: [...d.books, { id, title: title.trim(), cover: coverFile, pages: [] }] }));
      return id;
    },
    [update],
  );

  const renameBook = useCallback(
    (bookId: string, title: string) =>
      update((d) => ({ ...d, books: d.books.map((b) => (b.id === bookId ? { ...b, title: title.trim() } : b)) })),
    [update],
  );

  const forgetColoring = useCallback(
    (bookId: string, pageId?: string) => {
      for (const u of users) {
        if (pageId) storage.resetPage(u.id, bookId, pageId);
        else storage.resetBook(u.id, bookId);
      }
      bumpRevision();
    },
    [users, bumpRevision],
  );

  const removeBook = useCallback(
    (bookId: string) => {
      update((d) => {
        const custom = d.books.find((b) => b.id === bookId);
        if (custom) {
          if (custom.cover) lib.deleteImage(custom.cover);
          custom.pages.forEach((p) => lib.deleteImage(p.file));
          return { ...d, books: d.books.filter((b) => b !== custom) };
        }
        (d.extraPages[bookId] ?? []).forEach((p) => lib.deleteImage(p.file));
        const { [bookId]: _removed, ...extraPages } = d.extraPages;
        return { ...d, extraPages, hiddenBooks: [...d.hiddenBooks, bookId] };
      });
      forgetColoring(bookId);
    },
    [update, forgetColoring],
  );

  const addPages = useCallback(
    async (bookId: string, images: PickedImage[], onProgress?: (done: number) => void) => {
      const isCustomBook = data.books.some((b) => b.id === bookId);
      const startCount = getBook(bookId)?.pages.length ?? 0;
      const added: CustomPage[] = [];
      let failed = 0;
      for (const [i, img] of images.entries()) {
        try {
          const file = await lib.importImage(img.uri);
          added.push({ id: lib.newId(), title: titleFrom(img.name, `Page ${startCount + added.length + 1}`), file });
        } catch {
          failed++;
        }
        onProgress?.(i + 1);
      }
      if (added.length) {
        update((d) =>
          isCustomBook
            ? { ...d, books: d.books.map((b) => (b.id === bookId ? { ...b, pages: [...b.pages, ...added] } : b)) }
            : { ...d, extraPages: { ...d.extraPages, [bookId]: [...(d.extraPages[bookId] ?? []), ...added] } },
        );
      }
      return failed;
    },
    [data.books, getBook, update],
  );

  const mapCustomPages = useCallback(
    (bookId: string, fn: (pages: CustomPage[]) => CustomPage[]) =>
      update((d) =>
        d.books.some((b) => b.id === bookId)
          ? { ...d, books: d.books.map((b) => (b.id === bookId ? { ...b, pages: fn(b.pages) } : b)) }
          : { ...d, extraPages: { ...d.extraPages, [bookId]: fn(d.extraPages[bookId] ?? []) } },
      ),
    [update],
  );

  const renamePage = useCallback(
    (bookId: string, pageId: string, title: string) => {
      if (bookId === SKETCHBOOK_ID) {
        saveSketch(sketchPages.map((p) => (p.id === pageId ? { ...p, title: title.trim() } : p)));
        return;
      }
      mapCustomPages(bookId, (pages) => pages.map((p) => (p.id === pageId ? { ...p, title: title.trim() } : p)));
    },
    [mapCustomPages, saveSketch, sketchPages],
  );

  const addSketchPage = useCallback(() => {
    const next = Math.max(0, ...sketchPages.map((p) => Number(/^Page (\d+)$/.exec(p.title)?.[1] ?? 0))) + 1;
    saveSketch([...sketchPages, { id: lib.newId(), title: `Page ${next}` }]);
  }, [sketchPages, saveSketch]);

  const setSketchPageSize = useCallback(
    (pageId: string, width: number, height: number) =>
      saveSketch(sketchPages.map((p) => (p.id === pageId ? { ...p, width, height } : p))),
    [sketchPages, saveSketch],
  );

  const removePage = useCallback(
    (bookId: string, pageId: string) => {
      if (bookId === SKETCHBOOK_ID) {
        saveSketch(sketchPages.filter((p) => p.id !== pageId));
        // Sketchbooks are personal, so only the current user's drawing goes.
        if (userId) storage.resetPage(userId, bookId, pageId);
        bumpRevision();
        return;
      }
      if (getPage(bookId, pageId)?.custom) {
        mapCustomPages(bookId, (pages) =>
          pages.filter((p) => {
            if (p.id !== pageId) return true;
            lib.deleteImage(p.file);
            return false;
          }),
        );
      } else {
        update((d) => ({ ...d, hiddenPages: [...d.hiddenPages, `${bookId}/${pageId}`] }));
      }
      forgetColoring(bookId, pageId);
    },
    [getPage, mapCustomPages, update, forgetColoring, saveSketch, sketchPages, userId, bumpRevision],
  );

  const restoreBuiltIns = useCallback(() => update((d) => ({ ...d, hiddenBooks: [], hiddenPages: [] })), [update]);

  const value = useMemo<LibraryContextValue>(
    () => ({
      books,
      getBook,
      getPage,
      createBook,
      renameBook,
      removeBook,
      addPages,
      renamePage,
      addSketchPage,
      setSketchPageSize,
      removePage,
      hasRemovedBuiltIns: data.hiddenBooks.length > 0 || data.hiddenPages.length > 0,
      restoreBuiltIns,
    }),
    [books, getBook, getPage, createBook, renameBook, removeBook, addPages, renamePage, addSketchPage, setSketchPageSize, removePage, data, restoreBuiltIns],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
