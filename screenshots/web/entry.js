/**
 * Entry point of the screenshot build (metro.config.js routes expo-router's entry here when
 * SCREENSHOTS=1). Skia's WebAssembly and the scene's files have to be ready before any app
 * module loads, since some of them use Skia at import time. Then the scene's pre-colored pages
 * are drawn with the app's own fill and rendering code, so saved layers and thumbnails are exactly
 * what the app would have written.
 */
import { LoadSkiaWeb } from '@shopify/react-native-skia/lib/module/web';

import { loadSeed } from './expo-file-system';

async function start() {
  await LoadSkiaWeb({ locateFile: (file) => `/${file}` });
  const seed = await loadSeed('/seed.json');
  for (const coloring of seed?.colorings ?? []) {
    try {
      await require('./colorPages').colorPage(coloring);
    } catch (e) {
      console.error(`Couldn't color ${coloring.bookId}/${coloring.pageId}`, e);
    }
  }
  require('expo-router/entry-classic');
  window.__router = require('expo-router').router;
  window.__appStarted = true;
}

start();
