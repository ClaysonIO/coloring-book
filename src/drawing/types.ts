export type BrushKind = 'crayon' | 'marker' | 'paint' | 'pencil' | 'highlighter' | 'spray';
export type Tool = 'fill' | BrushKind | 'eraser';

/** Coordinates and widths are in base-image pixels, so a layer is resolution independent of the screen. */
export type StrokeOp = {
  kind: 'stroke';
  brush: BrushKind | 'eraser';
  color: string;
  width: number;
  /** Flat [x0, y0, x1, y1, ...] list. */
  points: number[];
  /** Seeds per-stroke randomness (spray dots) so replays look identical. */
  seed: number;
};

export type FillOp = { kind: 'fill'; color: string; x: number; y: number };

export type Op = StrokeOp | FillOp;

/** A user's coloring for one page: an ordered list of ops drawn on top of the base image. */
export type PageLayer = { version: 1; ops: Op[]; updatedAt: number };
