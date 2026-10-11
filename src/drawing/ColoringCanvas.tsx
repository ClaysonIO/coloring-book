import { Canvas, type SkImage } from '@shopify/react-native-skia';
import { useMemo, useRef, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { brushWidth } from './brushes';
import type { FillMask } from './floodFill';
import { PageArtwork } from './PageArtwork';
import type { FillOp, Op, StrokeOp, Tool } from './types';

type Props = {
  base: SkImage;
  ops: Op[];
  fills: Map<FillOp, FillMask | null>;
  fillsVersion: number;
  tool: Tool;
  color: string;
  /** Brush size in base-image pixels, before the per-brush factor. */
  size: number;
  onFill: (x: number, y: number) => void;
  onStroke: (op: StrokeOp) => void;
};

/**
 * The page is always fit to the space available: no pinch-zoom and no panning,
 * so every touch is coloring.
 */
export function ColoringCanvas({ base, ops, fills, fillsVersion, tool, color, size, onFill, onStroke }: Props) {
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [live, setLive] = useState<StrokeOp | null>(null);
  const liveRef = useRef<StrokeOp | null>(null);

  const imgW = base.width();
  const imgH = base.height();
  const scale = area ? Math.min(area.width / imgW, area.height / imgH) : 0;

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
  };

  const gesture = useMemo(() => {
    const toImage = (x: number, y: number) => [x / scale, y / scale] as const;
    return Gesture.Pan()
      .minDistance(0)
      .maxPointers(1)
      .runOnJS(true)
      .onBegin((e) => {
        if (!scale) return;
        const [x, y] = toImage(e.x, e.y);
        if (tool === 'fill') {
          onFill(x, y);
          return;
        }
        const op: StrokeOp = {
          kind: 'stroke',
          brush: tool,
          color,
          width: brushWidth(tool, size),
          points: [round1(x), round1(y)],
          seed: Math.floor(Math.random() * 1e9),
        };
        liveRef.current = op;
        setLive(op);
      })
      .onUpdate((e) => {
        const cur = liveRef.current;
        if (!cur) return;
        const [x, y] = toImage(e.x, e.y);
        const n = cur.points.length;
        // Skip points closer than ~1 screen pixel; they only bloat the saved layer.
        if (Math.hypot(x - cur.points[n - 2], y - cur.points[n - 1]) * scale < 1.5) return;
        const next = { ...cur, points: [...cur.points, round1(x), round1(y)] };
        liveRef.current = next;
        setLive(next);
      })
      .onFinalize(() => {
        const cur = liveRef.current;
        liveRef.current = null;
        setLive(null);
        if (cur) onStroke(cur);
      });
  }, [scale, tool, color, size, onFill, onStroke]);

  return (
    <View style={styles.area} onLayout={onLayout}>
      {scale > 0 && (
        <GestureDetector gesture={gesture}>
          <View style={[styles.page, { width: imgW * scale, height: imgH * scale }]}>
            <Canvas style={StyleSheet.absoluteFill}>
              <PageArtwork base={base} ops={ops} fills={fills} fillsVersion={fillsVersion} live={live} scale={scale} />
            </Canvas>
          </View>
        </GestureDetector>
      )}
    </View>
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

const styles = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { borderRadius: 14, overflow: 'hidden', backgroundColor: 'white' },
});
