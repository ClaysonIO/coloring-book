import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';

import * as storage from './storage';
import type { User } from './storage';

type UsersContextValue = {
  users: User[];
  currentUser: User | null;
  selectUser: (id: string | null) => void;
  addUser: (name: string, color: string) => User;
  deleteUser: (id: string) => void;
  setPin: (id: string, pin: string | null) => void;
  /** Bumped whenever saved coloring changes, so screens showing thumbnails re-read them. */
  revision: number;
  bumpRevision: () => void;
};

const UsersContext = createContext<UsersContextValue | null>(null);

export function UsersProvider({ children }: { children: ReactNode }) {
  const [users, setUsers] = useState<User[]>(() => storage.loadUsers());
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  const addUser = useCallback((name: string, color: string) => {
    const user: User = {
      id: `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`,
      name: name.trim(),
      color,
      createdAt: Date.now(),
    };
    setUsers((prev) => {
      const next = [...prev, user];
      storage.saveUsers(next);
      return next;
    });
    return user;
  }, []);

  const deleteUser = useCallback((id: string) => {
    storage.resetUser(id);
    setUsers((prev) => {
      const next = prev.filter((u) => u.id !== id);
      storage.saveUsers(next);
      return next;
    });
    setCurrentId((cur) => (cur === id ? null : cur));
  }, []);

  const setPin = useCallback((id: string, pin: string | null) => {
    setUsers((prev) => {
      const next = prev.map((u) => {
        if (u.id !== id) return u;
        const { pin: _old, ...rest } = u;
        return pin ? { ...rest, pin } : rest;
      });
      storage.saveUsers(next);
      return next;
    });
  }, []);

  const bumpRevision = useCallback(() => setRevision((r) => r + 1), []);

  const value = useMemo<UsersContextValue>(
    () => ({
      users,
      currentUser: users.find((u) => u.id === currentId) ?? null,
      selectUser: setCurrentId,
      addUser,
      deleteUser,
      setPin,
      revision,
      bumpRevision,
    }),
    [users, currentId, addUser, deleteUser, setPin, revision, bumpRevision],
  );

  return <UsersContext.Provider value={value}>{children}</UsersContext.Provider>;
}

export function useUsers() {
  const ctx = useContext(UsersContext);
  if (!ctx) throw new Error('useUsers must be used inside UsersProvider');
  return ctx;
}
