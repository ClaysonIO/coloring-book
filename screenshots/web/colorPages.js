/**
 * Pre-colors a page for a scene: works out fill taps (or takes the scene's own ops), then saves the
 * layer and thumbnail the way the coloring screen does, using the app's own fill and drawing code.
 */
import { drawAsImage, Skia } from '@shopify/react-native-skia';
import { createElement } from 'react';

import { buildWallMap, computeFill } from '../../src/drawing/floodFill';
import { PageArtwork } from '../../src/drawing/PageArtwork';
import { File } from './expo-file-system';

const THUMB_MAX = 480;

/** Small areas (mostly faces and hands in these pictures) get skin tones and pale colors. */
const SMALL_PALETTE = ['#FFE0BD', '#F1C27D', '#FFE0BD', '#E0AC69', '#FFF59D', '#F8BBD0'];
const SMALL_AREA = 0.004;

const PALETTE = [
  '#F44336', '#FF9800', '#FFD54F', '#8BC34A', '#43A047', '#29B6F6', '#1E88E5', '#9575CD',
  '#F06292', '#FFB74D', '#A1887F', '#795548', '#F1C27D', '#FFE0BD', '#80CBC4', '#00897B',
];

function random(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/**
 * One fill tap per enclosed area of the line art, the way a child might color it: the background
 * (the biggest area touching the edge) gets `background` if given, and the rest are colored top to
 * bottom until `progress` (0–1) of them are done.
 */
function autoFills(
  map,
  { progress = 1, background = null, seed = 1, palette = PALETTE, smallPalette = SMALL_PALETTE, minArea = 0.0003 } = {},
) {
  const { width: w, height: h, walls, scale } = map;
  const n = w * h;
  // Distance to the nearest line, so each tap lands well inside its area.
  const dist = new Uint16Array(n);
  for (let i = 0; i < n; i++) dist[i] = walls[i] ? 0 : 65535;
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      if (!dist[i]) continue;
      if (x > 0) dist[i] = Math.min(dist[i], dist[i - 1] + 1);
      if (y > 0) dist[i] = Math.min(dist[i], dist[i - w] + 1);
    }
  for (let y = h - 1; y >= 0; y--)
    for (let x = w - 1; x >= 0; x--) {
      const i = y * w + x;
      if (x < w - 1) dist[i] = Math.min(dist[i], dist[i + 1] + 1);
      if (y < h - 1) dist[i] = Math.min(dist[i], dist[i + w] + 1);
    }

  const label = new Int32Array(n).fill(-1);
  const regions = [];
  const stack = [];
  for (let start = 0; start < n; start++) {
    if (walls[start] || label[start] >= 0) continue;
    const r = { area: 0, sumY: 0, sumX: 0, best: start, edge: false };
    label[start] = regions.length;
    stack.push(start);
    while (stack.length) {
      const i = stack.pop();
      const x = i % w;
      const y = (i - x) / w;
      r.area++;
      r.sumX += x;
      r.sumY += y;
      if (dist[i] > dist[r.best]) r.best = i;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) r.edge = true;
      for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, y > 0 ? i - w : -1, y < h - 1 ? i + w : -1]) {
        if (j >= 0 && !walls[j] && label[j] < 0) {
          label[j] = regions.length;
          stack.push(j);
        }
      }
    }
    regions.push(r);
  }

  const big = regions.filter((r) => r.area >= n * minArea && dist[r.best] >= 2);
  const bg = big.filter((r) => r.edge).sort((a, b) => b.area - a.area)[0];
  const rest = big.filter((r) => r !== bg).sort((a, b) => a.sumY / a.area - b.sumY / b.area || a.sumX / a.area - b.sumX / b.area);
  const chosen = rest.slice(0, Math.round(rest.length * progress));
  const rand = random(seed);
  const tap = (r, color) => ({
    kind: 'fill',
    color,
    x: Math.round(((r.best % w) + 0.5) / scale),
    y: Math.round((Math.floor(r.best / w) + 0.5) / scale),
  });
  const ops = [];
  if (bg && background) ops.push(tap(bg, background));
  let last = null;
  for (const r of chosen) {
    const colors = r.area < n * SMALL_AREA ? smallPalette : palette;
    let color;
    do color = colors[Math.floor(rand() * colors.length)];
    while (color === last && colors.length > 1);
    last = color;
    ops.push(tap(r, color));
  }
  return ops;
}

export async function colorPage({ userId, bookId, pageId, image, ops, auto }) {
  const data = await Skia.Data.fromURI(new URL(image, location.href).href);
  const base = Skia.Image.MakeImageFromEncoded(data);
  if (!base) throw new Error(`Couldn't decode ${image}`);
  const map = buildWallMap(base);
  const layerOps = ops ?? autoFills(map, auto);
  const fills = new Map();
  for (const op of layerOps) if (op.kind === 'fill') fills.set(op, computeFill(map, op.x, op.y, op.color));

  const dir = `/document/coloring/users/${userId}/${bookId}`;
  new File(`${dir}/${pageId}.json`).write(JSON.stringify({ version: 1, ops: layerOps, updatedAt: Date.now() }));

  const scale = Math.min(1, THUMB_MAX / Math.max(base.width(), base.height()));
  const thumb = await drawAsImage(createElement(PageArtwork, { base, ops: layerOps, fills, scale }), {
    width: Math.round(base.width() * scale),
    height: Math.round(base.height() * scale),
  });
  if (thumb) new File(`${dir}/${pageId}.png`).write(thumb.encodeToBytes());
}
