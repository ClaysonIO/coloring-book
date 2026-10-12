import { File } from 'expo-file-system';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { bundledBooks, SKETCHBOOK_COVER, SKETCHBOOK_ID, type Book, type Page } from '../content/books';
import type { Catalog, CatalogPack } from '../content/catalog';
import * as lib from './library';
import type { CustomPage, LibraryData } from './library';
import * as packs from './packs';
import type { InstalledPack, Progress } from './packs';
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

  /** The website's packs (the last list seen if it can't be reached right now). */
  catalog: Catalog | null;
  catalogState: 'loading' | 'ready' | 'offline';
  refreshCatalog: () => Promise<void>;
  installedPacks: InstalledPack[];
  /** Website packs that are neither installed nor seen on the "More books" screen yet. */
  newPackCount: number;
  markPacksSeen: () => void;
  /**
   * Downloads (or updates) a website pack; returns how many pictures couldn't be read.
   * Books the user removed from it stay removed unless `restoreRemoved` is set.
   */
  installPack: (pack: CatalogPack, onProgress?: Progress, restoreRemoved?: boolean) => Promise<number>;
  /** Adds the books in a zip file; returns the pack's title and how many pictures couldn't be read. */
  importZip: (uri: string, name: string, onProgress?: Progress) => Promise<{ title: string; books: number; failed: number }>;
  /** Removes every book in a pack, and everyone's coloring in them. */
  removePack: (packId: string) => void;
  /** Ids of packs being updated in the background. */
  updatingPacks: string[];
};

const LibraryContext = createContext<LibraryContextValue | null>(null);

const toPage = (p: CustomPage): Page => ({ id: p.id, title: p.title, image: lib.imageUri(p.file), custom: true });
const toPackPage = (p: CustomPage): Page => ({ id: p.id, title: p.title, image: lib.imageUri(p.file) });
const { titleFrom } = packs;

function deletePackBookImages(book: packs.PackBook) {
  if (book.cover) lib.deleteImage(book.cover);
  book.pages.forEach((p) => lib.deleteImage(p.file));
}

/** Installs and updates run one at a time, so two can't race on library.json. */
let queue: Promise<unknown> = Promise.resolve();
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

/** How often the website is checked for new and updated packs while the app is open. */
const CATALOG_REFRESH_MS = 30 * 60 * 1000;

export function LibraryProvider({ children }: { children: ReactNode }) {
  const { users, currentUser, revision, bumpRevision } = useUsers();
  const [data, setData] = useState<LibraryData>(() => lib.loadLibrary());
  const [sketchVersion, setSketchVersion] = useState(0);
  const [catalog, setCatalog] = useState<Catalog | null>(() => packs.loadCachedCatalog());
  const [catalogState, setCatalogState] = useState<'loading' | 'ready' | 'offline'>('loading');
  const [updatingPacks, setUpdatingPacks] = useState<string[]>([]);
  // Async installs read the latest library from here rather than a stale closure.
  const dataRef = useRef(data);
  dataRef.current = data;
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
      dataRef.current = next;
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
    const fromPacks = data.packs.flatMap((pack) =>
      pack.books.map<Book>((b) => ({
        id: b.id,
        title: b.title,
        cover: b.cover ? lib.imageUri(b.cover) : undefined,
        pages: [
          ...b.pages.filter((p) => !hiddenPages.has(`${b.id}/${p.id}`)).map(toPackPage),
          ...(data.extraPages[b.id] ?? []).map(toPage),
        ],
        pack: pack.id,
      })),
    );
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
    return [...(userId ? [sketchbook] : []), ...builtIn, ...fromPacks, ...custom];
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
        const pack = d.packs.find((p) => p.books.some((b) => b.id === bookId));
        if (pack) {
          // Pack books are deleted outright; remembering the id keeps updates from re-adding it.
          const book = pack.books.find((b) => b.id === bookId)!;
          deletePackBookImages(book);
          const rest = pack.books.filter((b) => b !== book);
          return {
            ...d,
            extraPages,
            packs: rest.length
              ? d.packs.map((p) => (p === pack ? { ...p, books: rest, removed: [...p.removed, bookId] } : p))
              : d.packs.filter((p) => p !== pack),
          };
        }
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

  /** Adds or replaces a pack, making its book ids unique across the whole library. */
  const commitPack = useCallback(
    (pack: InstalledPack) =>
      update((d) => {
        const old = d.packs.find((p) => p.id === pack.id);
        const taken = new Set([
          SKETCHBOOK_ID,
          ...bundledBooks.map((b) => b.id),
          ...d.books.map((b) => b.id),
          ...d.packs.filter((p) => p !== old).flatMap((p) => p.books.map((b) => b.id)),
        ]);
        const books = pack.books.map((b) => {
          let id = taken.has(b.id) ? `${pack.id}-${b.id}` : b.id;
          for (let n = 2; taken.has(id); n++) id = `${pack.id}-${b.id}-${n}`;
          taken.add(id);
          return { ...b, id };
        });
        if (old) old.books.forEach(deletePackBookImages);
        const next = { ...pack, books };
        return { ...d, packs: old ? d.packs.map((p) => (p === old ? next : p)) : [...d.packs, next] };
      }),
    [update],
  );

  const installPack = useCallback(
    (entry: CatalogPack, onProgress?: Progress, restoreRemoved = false) =>
      enqueue(async () => {
        const installed = dataRef.current.packs.find((p) => p.id === entry.id);
        const zip = await packs.downloadPack(entry, onProgress);
        try {
          const { pack, failed } = await packs.readPack(zip, {
            zipName: entry.title,
            source: 'web',
            skipBooks: restoreRemoved ? [] : installed?.removed,
            onProgress,
          });
          // The catalog's title and version win over what's in the zip.
          commitPack({ ...pack, id: entry.id, title: entry.title, version: entry.version });
          return failed;
        } finally {
          if (zip.exists) zip.delete();
        }
      }),
    [commitPack],
  );

  const importZip = useCallback(
    (uri: string, name: string, onProgress?: Progress) =>
      enqueue(async () => {
        const file = new File(uri);
        const { pack, failed } = await packs.readPack(file, { zipName: name, source: 'file', onProgress });
        // A zip with a _pack.json replaces the pack with that id (bringing back books removed
        // from it); any other zip is added as new books.
        commitPack(pack);
        return { title: pack.title, books: pack.books.length, failed };
      }),
    [commitPack],
  );

  const removePack = useCallback(
    (packId: string) => {
      const pack = dataRef.current.packs.find((p) => p.id === packId);
      if (!pack) return;
      update((d) => {
        const extraPages = { ...d.extraPages };
        for (const b of pack.books) {
          deletePackBookImages(b);
          (extraPages[b.id] ?? []).forEach((p) => lib.deleteImage(p.file));
          delete extraPages[b.id];
        }
        return { ...d, extraPages, packs: d.packs.filter((p) => p.id !== packId) };
      });
      pack.books.forEach((b) => forgetColoring(b.id));
    },
    [update, forgetColoring],
  );

  const markPacksSeen = useCallback(() => {
    if (!catalog) return;
    const ids = catalog.packs.map((p) => p.id);
    if (ids.every((id) => dataRef.current.seenPacks.includes(id))) return;
    update((d) => ({ ...d, seenPacks: [...new Set([...d.seenPacks, ...ids])] }));
  }, [catalog, update]);

  const lastCheck = useRef(0);
  // Checks can overlap (launch, then opening More Books), so don't queue the same update twice.
  const updating = useRef(new Set<string>());
  const refreshCatalog = useCallback(async () => {
    lastCheck.current = Date.now();
    setCatalogState('loading');
    let fresh: Catalog;
    try {
      fresh = await packs.fetchCatalog();
    } catch {
      setCatalogState('offline');
      return;
    }
    setCatalog(fresh);
    setCatalogState('ready');
    // Installed website packs follow the website: a new version is downloaded in the background.
    for (const installed of dataRef.current.packs) {
      const entry = fresh.packs.find((p) => p.id === installed.id);
      if (!entry || !installed.version || entry.version === installed.version || updating.current.has(entry.id)) continue;
      updating.current.add(entry.id);
      setUpdatingPacks((ids) => [...ids, entry.id]);
      installPack(entry)
        .catch(() => undefined) // Tried again at the next check.
        .finally(() => {
          updating.current.delete(entry.id);
          setUpdatingPacks((ids) => ids.filter((id) => id !== entry.id));
        });
    }
  }, [installPack]);

  // Check the website at launch, and again when the app comes back after a while.
  useEffect(() => {
    refreshCatalog();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && Date.now() - lastCheck.current > CATALOG_REFRESH_MS) refreshCatalog();
    });
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const newPackCount = useMemo(
    () => (catalog?.packs ?? []).filter((p) => !data.seenPacks.includes(p.id) && !data.packs.some((x) => x.id === p.id)).length,
    [catalog, data.seenPacks, data.packs],
  );

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
      catalog,
      catalogState,
      refreshCatalog,
      installedPacks: data.packs,
      newPackCount,
      markPacksSeen,
      installPack,
      importZip,
      removePack,
      updatingPacks,
    }),
    [
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
      data,
      restoreBuiltIns,
      catalog,
      catalogState,
      refreshCatalog,
      newPackCount,
      markPacksSeen,
      installPack,
      importZip,
      removePack,
      updatingPacks,
    ],
  );

  return <LibraryContext.Provider value={value}>{children}</LibraryContext.Provider>;
}

export function useLibrary() {
  const ctx = useContext(LibraryContext);
  if (!ctx) throw new Error('useLibrary must be used inside LibraryProvider');
  return ctx;
}
