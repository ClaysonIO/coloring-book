import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Canvas, Group, type SkImage } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';

import { brushWidth } from './brushes';
import type { FillMask } from './floodFill';
import { PageArtwork } from './PageArtwork';
import type { FillOp, Op, StrokeOp, Tool } from './types';

type Props = {
  /** Null while loading. */
  base: SkImage | null;
  ops: Op[];
  fills: Map<FillOp, FillMask | null>;
  fillsVersion: number;
  tool: Tool;
  color: string;
  /** Brush size in base-image pixels, before the per-brush factor. */
  size: number;
  onFill: (x: number, y: number) => void;
  onStroke: (op: StrokeOp) => void;
  /** Reports the space available for the page (used to size new sketchbook pages). */
  onArea?: (width: number, height: number) => void;
  /** Lets two fingers zoom and move the page inside its frame. One finger always colors. */
  pinchZoom?: boolean;
};

/** Zoom and offset of the page inside its frame, in frame pixels. */
type View2D = { zoom: number; x: number; y: number };

const IDENTITY: View2D = { zoom: 1, x: 0, y: 0 };
const MAX_ZOOM = 5;

/**
 * The page is fit to the space available. Without pinch-zoom every touch is coloring.
 * With it, two fingers zoom and pan the page within its frame; a touch that turns into
 * a two-finger gesture is dropped instead of leaving a mark, and fills wait for the
 * finger to lift so the first finger of a pinch doesn't fill.
 */
export function ColoringCanvas({
  base,
  ops,
  fills,
  fillsVersion,
  tool,
  color,
  size,
  onFill,
  onStroke,
  onArea,
  pinchZoom = false,
}: Props) {
  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [live, setLive] = useState<StrokeOp | null>(null);
  const liveRef = useRef<StrokeOp | null>(null);
  const pendingFill = useRef<readonly [number, number] | null>(null);
  /** Set once the current touch sequence became a zoom/pan, so it never colors. */
  const zooming = useRef(false);

  const imgW = base?.width() ?? 1;
  const imgH = base?.height() ?? 1;
  const scale = area && base ? Math.min(area.width / imgW, area.height / imgH) : 0;
  const frameW = imgW * scale;
  const frameH = imgH * scale;

  const [view, setView] = useState<View2D>(IDENTITY);
  const viewRef = useRef(view);
  viewRef.current = view;

  // A new fit (rotation, resize) or turning the setting off puts the whole page back in view.
  useEffect(() => setView(IDENTITY), [scale, pinchZoom]);

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    setArea({ width, height });
    onArea?.(width, height);
  };

  const gesture = useMemo(() => {
    const toImage = (x: number, y: number) => {
      const v = viewRef.current;
      return [(x - v.x) / v.zoom / scale, (y - v.y) / v.zoom / scale] as const;
    };
    const draw = Gesture.Pan()
      .minDistance(0)
      .maxPointers(1)
      .runOnJS(true)
      .onBegin((e) => {
        zooming.current = false;
        pendingFill.current = null;
        if (!scale) return;
        const [x, y] = toImage(e.x, e.y);
        if (tool === 'fill') {
          if (pinchZoom) pendingFill.current = [x, y];
          else onFill(x, y);
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
        if (!cur || zooming.current) return;
        const [x, y] = toImage(e.x, e.y);
        const n = cur.points.length;
        // Skip points closer than ~1 screen pixel; they only bloat the saved layer.
        if (Math.hypot(x - cur.points[n - 2], y - cur.points[n - 1]) * scale * viewRef.current.zoom < 1.5) return;
        const next = { ...cur, points: [...cur.points, round1(x), round1(y)] };
        liveRef.current = next;
        setLive(next);
      })
      .onFinalize(() => {
        const cur = liveRef.current;
        const fill = pendingFill.current;
        liveRef.current = null;
        pendingFill.current = null;
        setLive(null);
        if (zooming.current) return;
        if (cur) onStroke(cur);
        if (fill) onFill(fill[0], fill[1]);
      });
    if (!pinchZoom) return draw;

    // Drop whatever the first finger started; this touch sequence is now moving the page.
    const startZooming = () => {
      zooming.current = true;
      liveRef.current = null;
      pendingFill.current = null;
      setLive(null);
    };
    // Keeps the page covering its frame: no gaps at the edges, never smaller than fit.
    const clamp = (v: View2D): View2D => {
      const zoom = Math.min(MAX_ZOOM, Math.max(1, v.zoom));
      return {
        zoom,
        x: Math.min(0, Math.max(frameW * (1 - zoom), v.x)),
        y: Math.min(0, Math.max(frameH * (1 - zoom), v.y)),
      };
    };

    let lastScale = 1;
    const pinch = Gesture.Pinch()
      .runOnJS(true)
      .onStart(() => {
        lastScale = 1;
        startZooming();
      })
      .onUpdate((e) => {
        const v = viewRef.current;
        const ratio = Math.min(MAX_ZOOM, Math.max(1, v.zoom * (e.scale / lastScale))) / v.zoom;
        lastScale = e.scale;
        // Zoom around the point between the fingers.
        const next = clamp({
          zoom: v.zoom * ratio,
          x: e.focalX - (e.focalX - v.x) * ratio,
          y: e.focalY - (e.focalY - v.y) * ratio,
        });
        viewRef.current = next;
        setView(next);
      });

    const pan = Gesture.Pan()
      .minPointers(2)
      .runOnJS(true)
      .onStart(startZooming)
      .onChange((e) => {
        const v = viewRef.current;
        const next = clamp({ zoom: v.zoom, x: v.x + e.changeX, y: v.y + e.changeY });
        viewRef.current = next;
        setView(next);
      });

    return Gesture.Simultaneous(draw, pinch, pan);
  }, [scale, frameW, frameH, tool, color, size, onFill, onStroke, pinchZoom]);

  // Kept stable while zooming so only the transform changes between frames.
  const artwork = useMemo(
    () =>
      base ? (
        <PageArtwork base={base} ops={ops} fills={fills} fillsVersion={fillsVersion} live={live} scale={scale} />
      ) : null,
    [base, ops, fills, fillsVersion, live, scale],
  );

  return (
    <View style={styles.area} onLayout={onLayout}>
      {base && scale > 0 ? (
        <GestureDetector gesture={gesture}>
          <View style={[styles.page, { width: frameW, height: frameH }]}>
            <Canvas style={StyleSheet.absoluteFill}>
              <Group transform={[{ translateX: view.x }, { translateY: view.y }, { scale: view.zoom }]}>{artwork}</Group>
            </Canvas>
          </View>
        </GestureDetector>
      ) : (
        <ActivityIndicator color="#FFB59A" />
      )}
      {area && scale > 0 && view.zoom > 1 ? (
        // Outside the gesture area so tapping it never colors; pinned to the page's top-right corner.
        <Pressable
          onPress={() => setView(IDENTITY)}
          style={({ pressed }) => [
            styles.fit,
            { top: (area.height - frameH) / 2 + 8, right: (area.width - frameW) / 2 + 8 },
            pressed && { opacity: 0.7 },
          ]}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Show the whole page"
        >
          <MaterialCommunityIcons name="fit-to-screen-outline" size={26} color="#333" />
        </Pressable>
      ) : null}
    </View>
  );
}

function round1(n: number) {
  return Math.round(n * 10) / 10;
}

const styles = StyleSheet.create({
  area: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  page: { borderRadius: 14, overflow: 'hidden', backgroundColor: 'white' },
  fit: {
    position: 'absolute',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
  },
});
