import type { ModalProps } from 'react-native';

export type ColorScheme = 'light' | 'dark';
/** What the user picked in Settings; 'system' follows the device. */
export type ThemePreference = 'system' | ColorScheme;

const dark = {
  background: '#121212',
  surface: '#1E1E1E',
  surfaceHigh: '#2A2A2A',
  /** Behind the page while coloring, a shade off the background so the white page stands out. */
  canvasBackdrop: '#0E0E0E',
  text: '#ECECEC',
  textMuted: '#B5B5B5',
  accent: '#FFB59A',
  accentContainer: '#FFDBCF',
  onAccentContainer: '#3B1A0E',
  danger: '#FF8A80',
  outline: '#5A5A5A',
};

export type Colors = typeof dark;

const light: Colors = {
  background: '#FFF8F5',
  surface: '#FFFFFF',
  surfaceHigh: '#F5E6DF',
  canvasBackdrop: '#EADDD6',
  text: '#231A16',
  textMuted: '#6B5850',
  accent: '#A63F1A',
  accentContainer: '#FFDBCF',
  onAccentContainer: '#3B1A0E',
  danger: '#BA1A1A',
  outline: '#C9B5AC',
};

export const palettes: Record<ColorScheme, Colors> = { light, dark };

/** Avatar colors offered when creating a user. */
export const avatarColors = ['#F28B82', '#FBBC04', '#81C995', '#78D9EC', '#8AB4F8', '#C58AF9', '#FF8BCB', '#FDAB6B'];

/** iOS modals only allow portrait unless told otherwise, which would rotate the app when one opens. */
export const ALL_ORIENTATIONS: ModalProps['supportedOrientations'] = [
  'portrait',
  'portrait-upside-down',
  'landscape',
  'landscape-left',
  'landscape-right',
];
