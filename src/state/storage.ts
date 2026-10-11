import { Directory, File, Paths } from 'expo-file-system';

import type { PageLayer } from '../drawing/types';

/**
 * Everything lives under <documents>/coloring:
 *   users.json                                 user list
 *   users/<userId>/<bookId>/<pageId>.json      the page's color layer
 *   users/<userId>/<bookId>/<pageId>.png       thumbnail of the colored page
 * so resetting a page, a book or a user is deleting a file pair or a folder.
 */
export type User = { id: string; name: string; color: string; createdAt: number };

const root = () => new Directory(Paths.document, 'coloring');
const usersFile = () => new File(root(), 'users.json');
const userDir = (userId: string) => new Directory(root(), 'users', userId);
const bookDir = (userId: string, bookId: string) => new Directory(userDir(userId), bookId);
const layerFile = (userId: string, bookId: string, pageId: string) =>
  new File(bookDir(userId, bookId), `${pageId}.json`);
const thumbFile = (userId: string, bookId: string, pageId: string) =>
  new File(bookDir(userId, bookId), `${pageId}.png`);

function ensureDir(dir: Directory) {
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
}

function deleteIfExists(entry: File | Directory) {
  if (entry.exists) entry.delete();
}

export function loadUsers(): User[] {
  const file = usersFile();
  if (!file.exists) return [];
  try {
    return JSON.parse(file.textSync()) as User[];
  } catch {
    return [];
  }
}

export function saveUsers(users: User[]) {
  ensureDir(root());
  usersFile().write(JSON.stringify(users));
}

export function loadLayer(userId: string, bookId: string, pageId: string): PageLayer | null {
  const file = layerFile(userId, bookId, pageId);
  if (!file.exists) return null;
  try {
    return JSON.parse(file.textSync()) as PageLayer;
  } catch {
    return null;
  }
}

export function saveLayer(userId: string, bookId: string, pageId: string, layer: PageLayer) {
  ensureDir(bookDir(userId, bookId));
  layerFile(userId, bookId, pageId).write(JSON.stringify(layer));
}

export function saveThumbnail(userId: string, bookId: string, pageId: string, png: Uint8Array) {
  ensureDir(bookDir(userId, bookId));
  thumbFile(userId, bookId, pageId).write(png);
}

/** file:// uri of the page's thumbnail, with a cache-buster, or null if the page is untouched. */
export function thumbnailUri(userId: string, bookId: string, pageId: string): string | null {
  const file = thumbFile(userId, bookId, pageId);
  if (!file.exists) return null;
  return `${file.uri}?v=${file.info().modificationTime ?? 0}`;
}

export function resetPage(userId: string, bookId: string, pageId: string) {
  deleteIfExists(layerFile(userId, bookId, pageId));
  deleteIfExists(thumbFile(userId, bookId, pageId));
}

export function resetBook(userId: string, bookId: string) {
  deleteIfExists(bookDir(userId, bookId));
}

export function resetUser(userId: string) {
  deleteIfExists(userDir(userId));
}
