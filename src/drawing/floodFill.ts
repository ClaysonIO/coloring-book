import { AlphaType, ColorType, Skia, type SkImage } from '@shopify/react-native-skia';

/** Line-art boundaries sampled from the base image, at most MAX_DIM pixels on a side. */
export type WallMap = { width: number; height: number; scale: number; walls: Uint8Array };

/** A computed fill, cropped to the region it covers, in base-image coordinates. */
export type FillMask = { image: SkImage; x: number; y: number; width: number; height: number };

const MAX_DIM = 1200;
/** Anything darker than this counts as a line. High on purpose: thin lines turn grey when downsampled. */
const WALL_LUMINANCE = 200;
/** How far (in map pixels) a fill bleeds under the lines so no white halo shows at the edges. */
const BLEED = 2;

export function buildWallMap(image: SkImage): WallMap | null {
  const scale = Math.min(1, MAX_DIM / Math.max(image.width(), image.height()));
  const width = Math.max(1, Math.round(image.width() * scale));
  const height = Math.max(1, Math.round(image.height() * scale));
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;
  const canvas = surface.getCanvas();
  canvas.clear(Skia.Color('white'));
  canvas.drawImageRect(
    image,
    Skia.XYWHRect(0, 0, image.width(), image.height()),
    Skia.XYWHRect(0, 0, width, height),
    Skia.Paint(),
  );
  surface.flush();
  const pixels = surface.makeImageSnapshot().readPixels(0, 0, {
    width,
    height,
    colorType: ColorType.RGBA_8888,
    alphaType: AlphaType.Unpremul,
  });
  if (!pixels) return null;

  const walls = new Uint8Array(width * height);
  for (let i = 0, p = 0; i < walls.length; i++, p += 4) {
    const lum = pixels[p] * 0.299 + pixels[p + 1] * 0.587 + pixels[p + 2] * 0.114;
    walls[i] = lum < WALL_LUMINANCE ? 1 : 0;
  }
  return { width, height, scale, walls };
}

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Flood-fills the region under (x, y) (base-image coords). Returns null when tapping on a line. */
export function computeFill(map: WallMap, x: number, y: number, color: string): FillMask | null {
  const { width: w, height: h, walls } = map;
  const sx = Math.floor(x * map.scale);
  const sy = Math.floor(y * map.scale);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h || walls[sy * w + sx]) return null;

  // Scanline flood fill.
  const region = new Uint8Array(w * h);
  const stack = [sx, sy];
  let minX = sx;
  let maxX = sx;
  let minY = sy;
  let maxY = sy;
  const open = (i: number) => !walls[i] && !region[i];
  while (stack.length) {
    const cy = stack.pop()!;
    let cx = stack.pop()!;
    const row = cy * w;
    while (cx > 0 && open(row + cx - 1)) cx--;
    let spanUp = false;
    let spanDown = false;
    for (; cx < w && open(row + cx); cx++) {
      region[row + cx] = 1;
      if (cx < minX) minX = cx;
      if (cx > maxX) maxX = cx;
      if (cy > 0) {
        const up = open(row - w + cx);
        if (up && !spanUp) stack.push(cx, cy - 1);
        spanUp = up;
      }
      if (cy < h - 1) {
        const down = open(row + w + cx);
        if (down && !spanDown) stack.push(cx, cy + 1);
        spanDown = down;
      }
    }
    if (cy < minY) minY = cy;
    if (cy > maxY) maxY = cy;
  }

  // Grow the region a little into the lines (they are drawn on top, so it hides the seam).
  minX = Math.max(0, minX - BLEED);
  minY = Math.max(0, minY - BLEED);
  maxX = Math.min(w - 1, maxX + BLEED);
  maxY = Math.min(h - 1, maxY + BLEED);
  for (let pass = 0; pass < BLEED; pass++) {
    const grown: number[] = [];
    for (let yy = minY; yy <= maxY; yy++) {
      for (let xx = minX; xx <= maxX; xx++) {
        const i = yy * w + xx;
        if (region[i] || !walls[i]) continue;
        if (
          (xx > 0 && region[i - 1]) ||
          (xx < w - 1 && region[i + 1]) ||
          (yy > 0 && region[i - w]) ||
          (yy < h - 1 && region[i + w])
        ) {
          grown.push(i);
        }
      }
    }
    for (const i of grown) region[i] = 1;
  }

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  const [r, g, b] = hexToRgb(color);
  const rgba = new Uint8Array(bw * bh * 4);
  for (let yy = 0; yy < bh; yy++) {
    for (let xx = 0; xx < bw; xx++) {
      if (!region[(yy + minY) * w + xx + minX]) continue;
      const p = (yy * bw + xx) * 4;
      rgba[p] = r;
      rgba[p + 1] = g;
      rgba[p + 2] = b;
      rgba[p + 3] = 255;
    }
  }
  const image = Skia.Image.MakeImage(
    { width: bw, height: bh, colorType: ColorType.RGBA_8888, alphaType: AlphaType.Premul },
    Skia.Data.fromBytes(rgba),
    bw * 4,
  );
  if (!image) return null;
  return {
    image,
    x: minX / map.scale,
    y: minY / map.scale,
    width: bw / map.scale,
    height: bh / map.scale,
  };
}
