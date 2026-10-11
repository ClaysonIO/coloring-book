import { DiscretePathEffect, Image, Path, Shader, Skia, type SkPath } from '@shopify/react-native-skia';
import getStroke from 'perfect-freehand';

import type { FillMask } from './floodFill';
import type { BrushKind, FillOp, Op, StrokeOp, Tool } from './types';

export type BrushInfo = { tool: Tool; label: string; icon: string };

/** Tools in the order they appear in the tool sheet. `icon` is a MaterialCommunityIcons name. */
export const TOOLS: BrushInfo[] = [
  { tool: 'fill', label: 'Fill', icon: 'format-color-fill' },
  { tool: 'crayon', label: 'Crayon', icon: 'grease-pencil' },
  { tool: 'marker', label: 'Marker', icon: 'marker' },
  { tool: 'paint', label: 'Paint', icon: 'brush' },
  { tool: 'pencil', label: 'Pencil', icon: 'lead-pencil' },
  { tool: 'highlighter', label: 'Highlight', icon: 'format-paint' },
  { tool: 'spray', label: 'Spray', icon: 'spray' },
  { tool: 'eraser', label: 'Eraser', icon: 'eraser' },
];

/** Multiplier applied to the size slider for each brush, so one slider feels right for all of them. */
const WIDTH_FACTOR: Record<BrushKind | 'eraser', number> = {
  crayon: 1,
  marker: 1,
  paint: 1.4,
  pencil: 0.35,
  highlighter: 2,
  spray: 2.5,
  eraser: 1.5,
};

export function brushWidth(brush: BrushKind | 'eraser', size: number) {
  return size * WIDTH_FACTOR[brush];
}

// Grainy fill used by crayon and pencil: per-cell noise modulates alpha so paper shows through.
const grainEffect = Skia.RuntimeEffect.Make(`
uniform float4 color;
uniform float grain;
uniform float minAlpha;

float hash(float2 p) {
  return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
}

half4 main(float2 xy) {
  float fine = hash(floor(xy / grain));
  float coarse = hash(floor(xy / (grain * 4.0)) + 17.0);
  float a = mix(minAlpha, 1.0, smoothstep(0.1, 0.7, fine * 0.65 + coarse * 0.35));
  a *= color.a;
  return half4(color.rgb * a, a);
}
`)!;

function hexToUnit(hex: string, alpha = 1): number[] {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255, alpha];
}

/** Smooth polyline through the points using quadratic curves between midpoints. */
function smoothPath(points: number[]): SkPath {
  const path = Skia.Path.Make();
  const n = points.length / 2;
  if (n === 0) return path;
  path.moveTo(points[0], points[1]);
  if (n === 1) {
    // A tap: a tiny segment so the round cap draws a dot.
    path.lineTo(points[0] + 0.01, points[1]);
    return path;
  }
  for (let i = 1; i < n - 1; i++) {
    const x = points[i * 2];
    const y = points[i * 2 + 1];
    const mx = (x + points[i * 2 + 2]) / 2;
    const my = (y + points[i * 2 + 3]) / 2;
    path.quadTo(x, y, mx, my);
  }
  path.lineTo(points[(n - 1) * 2], points[(n - 1) * 2 + 1]);
  return path;
}

/** Tapered, pressure-simulated outline from perfect-freehand, filled as a polygon. */
function paintPath(points: number[], width: number): SkPath {
  const input: number[][] = [];
  for (let i = 0; i < points.length; i += 2) input.push([points[i], points[i + 1]]);
  const outline = getStroke(input, { size: width, thinning: 0.6, smoothing: 0.6, streamline: 0.4 });
  const path = Skia.Path.Make();
  if (outline.length === 0) return path;
  path.moveTo(outline[0][0], outline[0][1]);
  for (let i = 1; i < outline.length; i++) {
    const [x0, y0] = outline[i];
    const [x1, y1] = outline[(i + 1) % outline.length];
    path.quadTo(x0, y0, (x0 + x1) / 2, (y0 + y1) / 2);
  }
  path.close();
  return path;
}

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Scattered dots around the stroke, deterministic for a given seed. */
function sprayPath(points: number[], width: number, seed: number): SkPath {
  const rand = mulberry32(seed);
  const path = Skia.Path.Make();
  const radius = width / 2;
  const dot = Math.max(0.8, width * 0.025);
  const step = Math.max(1, width * 0.2);
  const dotsPerStep = 14;
  let carry = step;
  for (let i = 0; i < points.length; i += 2) {
    const x = points[i];
    const y = points[i + 1];
    const px = i >= 2 ? points[i - 2] : x;
    const py = i >= 2 ? points[i - 1] : y;
    const dist = Math.hypot(x - px, y - py);
    carry += dist;
    while (carry >= step) {
      carry -= step;
      const t = dist === 0 ? 1 : 1 - carry / dist;
      const cx = px + (x - px) * t;
      const cy = py + (y - py) * t;
      for (let d = 0; d < dotsPerStep; d++) {
        const a = rand() * Math.PI * 2;
        const r = Math.sqrt(rand()) * radius;
        path.addCircle(cx + Math.cos(a) * r, cy + Math.sin(a) * r, dot * (0.6 + rand() * 0.8));
      }
    }
  }
  return path;
}

const pathCache = new WeakMap<StrokeOp, SkPath>();

function strokePath(op: StrokeOp): SkPath {
  const cached = pathCache.get(op);
  if (cached) return cached;
  let path: SkPath;
  if (op.brush === 'paint') path = paintPath(op.points, op.width);
  else if (op.brush === 'spray') path = sprayPath(op.points, op.width, op.seed);
  else path = smoothPath(op.points);
  pathCache.set(op, path);
  return path;
}

const round = { cap: 'round', join: 'round' } as const;

export function renderStroke(op: StrokeOp, key?: string | number) {
  const path = strokePath(op);
  switch (op.brush) {
    case 'crayon':
      return (
        <Path key={key} path={path} style="stroke" strokeWidth={op.width} strokeCap="round" strokeJoin="round">
          <DiscretePathEffect length={4} deviation={op.width * 0.06} seed={op.seed % 1000} />
          <Shader source={grainEffect} uniforms={{ color: hexToUnit(op.color, 0.95), grain: 2.5, minAlpha: 0.45 }} />
        </Path>
      );
    case 'pencil':
      return (
        <Path key={key} path={path} style="stroke" strokeWidth={op.width} strokeCap="round" strokeJoin="round">
          <Shader source={grainEffect} uniforms={{ color: hexToUnit(op.color, 0.9), grain: 1.2, minAlpha: 0.35 }} />
        </Path>
      );
    case 'marker':
      return <Path key={key} path={path} style="stroke" strokeWidth={op.width} strokeCap={round.cap} strokeJoin={round.join} color={op.color} />;
    case 'highlighter':
      return (
        <Path key={key} path={path} style="stroke" strokeWidth={op.width} strokeCap="butt" strokeJoin="round" color={op.color} opacity={0.45} />
      );
    case 'paint':
    case 'spray':
      return <Path key={key} path={path} color={op.color} />;
    case 'eraser':
      return (
        <Path key={key} path={path} style="stroke" strokeWidth={op.width} strokeCap="round" strokeJoin="round" color="black" blendMode="clear" />
      );
  }
}

export function renderOp(op: Op, key: string | number, fills: Map<FillOp, FillMask | null>) {
  if (op.kind === 'stroke') return renderStroke(op, key);
  const mask = fills.get(op);
  if (!mask) return null;
  return <Image key={key} image={mask.image} x={mask.x} y={mask.y} width={mask.width} height={mask.height} fit="fill" />;
}
