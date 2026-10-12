import { Directory, File, Paths } from 'expo-file-system';
import * as SystemUI from 'expo-system-ui';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Appearance, useColorScheme } from 'react-native';

import { palettes, type ColorScheme, type Colors, type ThemePreference } from '../theme';

/**
 * Light or dark, following the device unless the user picks one in Settings. The choice is for the
 * whole device (not per user) and is saved in <documents>/coloring/settings.json. It is also handed
 * to the OS (Appearance.setColorScheme) so alerts, pickers and the keyboard match.
 */
type ThemeValue = {
  scheme: ColorScheme;
  colors: Colors;
  preference: ThemePreference;
  setPreference: (preference: ThemePreference) => void;
};

const ThemeContext = createContext<ThemeValue | null>(null);

const settingsFile = () => new File(Paths.document, 'coloring', 'settings.json');

function loadPreference(): ThemePreference {
  try {
    const file = settingsFile();
    if (!file.exists) return 'system';
    const theme = JSON.parse(file.textSync())?.theme;
    return theme === 'light' || theme === 'dark' ? theme : 'system';
  } catch {
    return 'system';
  }
}

function savePreference(theme: ThemePreference) {
  const dir = new Directory(Paths.document, 'coloring');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  settingsFile().write(JSON.stringify({ theme }));
}

const toAppearance = (p: ThemePreference) => (p === 'system' ? 'unspecified' : p);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const saved = loadPreference();
    // Before the first render, so the app never flashes the other theme.
    if (saved !== 'system') Appearance.setColorScheme(saved);
    return saved;
  });
  const device = useColorScheme();
  const scheme: ColorScheme = preference === 'system' ? (device === 'light' ? 'light' : 'dark') : preference;
  const colors = palettes[scheme];

  useEffect(() => {
    // The root view shows briefly during screen transitions and behind the keyboard.
    SystemUI.setBackgroundColorAsync(colors.background).catch(() => undefined);
  }, [colors.background]);

  const setPreference = useCallback((next: ThemePreference) => {
    Appearance.setColorScheme(toAppearance(next));
    setPreferenceState(next);
    savePreference(next);
  }, []);

  const value = useMemo(() => ({ scheme, colors, preference, setPreference }), [scheme, colors, preference, setPreference]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider');
  return ctx;
}

const styleCache = new WeakMap<object, Partial<Record<ColorScheme, unknown>>>();

/**
 * Styles that depend on the theme: pass a module-level `(colors) => StyleSheet.create({...})`.
 * Each factory runs once per theme and the result is shared by every component using it.
 */
export function useThemedStyles<T>(factory: (colors: Colors) => T): T {
  const { scheme, colors } = useTheme();
  let entry = styleCache.get(factory);
  if (!entry) styleCache.set(factory, (entry = {}));
  return (entry[scheme] ??= factory(colors)) as T;
}
