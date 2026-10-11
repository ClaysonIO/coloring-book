import { Group, Image, Rect, type SkImage } from '@shopify/react-native-skia';
import { useMemo } from 'react';

import { renderOp, renderStroke } from './brushes';
import type { FillMask } from './floodFill';
import type { FillOp, Op, StrokeOp } from './types';

type Props = {
  base: SkImage;
  ops: Op[];
  fills: Map<FillOp, FillMask | null>;
  /** Bumped when `fills` gains entries, since the map itself is mutated in place. */
  fillsVersion?: number;
  live?: StrokeOp | null;
  /** Screen pixels per base-image pixel. */
  scale: number;
};

/**
 * White paper, then the user's color layer, then the line art multiplied on top so
 * colors never cover the lines. The eraser clears only within the color layer.
 */
export function PageArtwork({ base, ops, fills, fillsVersion, live, scale }: Props) {
  const width = base.width();
  const height = base.height();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const committed = useMemo(() => ops.map((op, i) => renderOp(op, i, fills)), [ops, fills, fillsVersion]);
  return (
    <Group transform={[{ scale }]}>
      <Rect x={0} y={0} width={width} height={height} color="white" />
      <Group layer>
        {committed}
        {live ? renderStroke(live) : null}
      </Group>
      <Image image={base} x={0} y={0} width={width} height={height} fit="fill" blendMode="multiply" />
    </Group>
  );
}
