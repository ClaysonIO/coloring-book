import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

import type { InstalledPack } from './packs';

/**
 * Books and pages added in the app, book packs (zips from the website or Files), and built-in
 * books and pages the user removed.
 * Lives next to the user data under <documents>/coloring/library/:
 *   library.json
 *   images/<id>.png
 * Only file names are stored, since the documents path can change between app updates.
 */
export type CustomPage = { id: string; title: string; file: string };
export type CustomBook = { id: string; title: string; cover?: string; pages: CustomPage[] };
export type LibraryData = {
  books: CustomBook[];
  /** Pages added to built-in books, by book id. */
  extraPages: Record<string, CustomPage[]>;
  hiddenBooks: string[];
  /** "<bookId>/<pageId>" of removed built-in (or pack) pages. */
  hiddenPages: string[];
  /** Installed book packs. Pages added to their books go in extraPages, like built-in books. */
  packs: InstalledPack[];
  /** Website packs already shown to the user, so new ones can be pointed out. */
  seenPacks: string[];
};

const MAX_SIZE = 2048;

const libraryDir = () => new Directory(Paths.document, 'coloring', 'library');
const imagesDir = () => new Directory(libraryDir(), 'images');
const libraryFile = () => new File(libraryDir(), 'library.json');

export const emptyLibrary = (): LibraryData => ({
  books: [],
  extraPages: {},
  hiddenBooks: [],
  hiddenPages: [],
  packs: [],
  seenPacks: [],
});

export function newId() {
  return `u${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
}

export function loadLibrary(): LibraryData {
  const file = libraryFile();
  if (!file.exists) return emptyLibrary();
  try {
    return { ...emptyLibrary(), ...(JSON.parse(file.textSync()) as Partial<LibraryData>) };
  } catch {
    return emptyLibrary();
  }
}

export function saveLibrary(data: LibraryData) {
  const dir = libraryDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  libraryFile().write(JSON.stringify(data));
}

export function imageUri(file: string) {
  return new File(imagesDir(), file).uri;
}

export function deleteImage(file: string) {
  const f = new File(imagesDir(), file);
  if (f.exists) f.delete();
}

function ensureImagesDir() {
  const dir = imagesDir();
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

/** Stores an image that is already a PNG/JPEG of a usable size, as is. */
export function saveImage(data: Uint8Array, ext: 'png' | 'jpg'): string {
  const name = `${newId()}.${ext}`;
  new File(ensureImagesDir(), name).write(data);
  return name;
}

/**
 * Copies a picked image into the library as a PNG of at most MAX_SIZE px a side.
 * Decoding goes through the OS, so anything the device can open works (JPG, PNG, HEIC, WebP, GIF…).
 */
export async function importImage(uri: string): Promise<string> {
  let ref = await ImageManipulator.manipulate(uri).renderAsync();
  if (Math.max(ref.width, ref.height) > MAX_SIZE) {
    const size = ref.width >= ref.height ? { width: MAX_SIZE } : { height: MAX_SIZE };
    ref = await ImageManipulator.manipulate(ref).resize(size).renderAsync();
  }
  const result = await ref.saveAsync({ format: SaveFormat.PNG });
  const name = `${newId()}.png`;
  new File(result.uri).moveSync(new File(ensureImagesDir(), name));
  return name;
}
