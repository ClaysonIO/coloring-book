import { MaterialCommunityIcons } from '@expo/vector-icons';
import { drawAsImage, Skia, useImage, type SkImage } from '@shopify/react-native-skia';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { PixelRatio, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirm } from '../../../components/confirm';
import { CrayonPicker } from '../../../components/CrayonPicker';
import { Header, IconButton } from '../../../components/Header';
import { ToolSheet } from '../../../components/ToolSheet';
import type { Page } from '../../../content/books';
import { TOOLS } from '../../../drawing/brushes';
import { ColoringCanvas } from '../../../drawing/ColoringCanvas';
import { buildWallMap, computeFill, type FillMask } from '../../../drawing/floodFill';
import { PageArtwork } from '../../../drawing/PageArtwork';
import type { FillOp, Op, StrokeOp, Tool } from '../../../drawing/types';
import { useLibrary } from '../../../state/LibraryContext';
import { useUsers } from '../../../state/UsersContext';
import * as storage from '../../../state/storage';
import { useTheme, useThemedStyles } from '../../../state/ThemeContext';
import type { Colors } from '../../../theme';

const THUMB_MAX = 480;
const THUMB_DELAY_MS = 800;

export default function ColorScreen() {
  const { bookId, pageId } = useLocalSearchParams<{ bookId: string; pageId: string }>();
  const { currentUser } = useUsers();
  const { getPage } = useLibrary();
  const page = getPage(bookId, pageId);
  if (!currentUser || !page) return <Redirect href="/" />;
  return (
    <Colorer
      key={`${currentUser.id}/${bookId}/${pageId}`}
      userId={currentUser.id}
      pinchZoom={!!currentUser.pinchZoom}
      bookId={bookId}
      pageId={pageId}
      page={page}
    />
  );
}

/** Largest side of a generated sketchbook page, in pixels. */
const MAX_BLANK_SIZE = 2048;

/** A white page of the given size, for sketchbook pages. */
function makeBlank(width: number, height: number): SkImage | null {
  const surface = Skia.Surface.Make(width, height);
  if (!surface) return null;
  surface.getCanvas().clear(Skia.Color('white'));
  surface.flush();
  return surface.makeImageSnapshot().makeNonTextureImage();
}

/** Pixel size for a page that exactly fills `area` (in dp), as sharp as the screen up to MAX_BLANK_SIZE. */
function blankSizeFor(area: { width: number; height: number }) {
  const scale = Math.min(PixelRatio.get(), MAX_BLANK_SIZE / Math.max(area.width, area.height));
  return { width: Math.round(area.width * scale), height: Math.round(area.height * scale) };
}

function Colorer({
  userId,
  pinchZoom,
  bookId,
  pageId,
  page,
}: {
  userId: string;
  pinchZoom: boolean;
  bookId: string;
  pageId: string;
  page: Page;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const window = useWindowDimensions();
  const landscape = window.width > window.height;
  const { bumpRevision } = useUsers();
  const { setSketchPageSize } = useLibrary();
  const loadedImage = useImage(page.image ?? null);
  const blank = page.blank;
  const blankImage = useMemo(
    () => (blank ? makeBlank(blank.width, blank.height) : null),
    [blank?.width, blank?.height], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const base = blank !== undefined ? blankImage : loadedImage;

  // A sketchbook page opened for the first time takes the shape of the space it's shown in,
  // so it is landscape when opened in landscape and portrait in portrait.
  const onArea = useCallback(
    (width: number, height: number) => {
      if (blank !== null || width < 50 || height < 50) return;
      // Pages drawn on before sizing existed were 2048x1536; keep those drawings lined up.
      const size = storage.loadLayer(userId, bookId, pageId)
        ? { width: 2048, height: 1536 }
        : blankSizeFor({ width, height });
      setSketchPageSize(pageId, size.width, size.height);
    },
    [blank, userId, bookId, pageId, setSketchPageSize],
  );

  const [ops, setOps] = useState<Op[]>(() => storage.loadLayer(userId, bookId, pageId)?.ops ?? []);
  const [redo, setRedo] = useState<Op[]>([]);
  const [tool, setTool] = useState<Tool>('crayon');
  const [color, setColor] = useState('#F44336');
  const [size, setSize] = useState(16);
  const [sheetOpen, setSheetOpen] = useState(false);

  const wallMap = useMemo(() => (base ? buildWallMap(base) : null), [base]);
  const fills = useRef(new Map<FillOp, FillMask | null>()).current;
  const [fillsVersion, setFillsVersion] = useState(0);

  // Fill ops are saved as tap points; recompute their masks once the base image is available.
  useEffect(() => {
    if (!wallMap) return;
    let added = false;
    for (const op of ops) {
      if (op.kind === 'fill' && !fills.has(op)) {
        fills.set(op, computeFill(wallMap, op.x, op.y, op.color));
        added = true;
      }
    }
    if (added) setFillsVersion((v) => v + 1);
  }, [ops, wallMap, fills]);

  // --- Persistence -------------------------------------------------------
  const latest = useRef({ ops, base });
  latest.current = { ops, base };
  const thumbTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const loaded = useRef(false);

  const writeThumbnail = useCallback(async () => {
    thumbTimer.current = null;
    const { ops: currentOps, base: currentBase } = latest.current;
    if (!currentBase || currentOps.length === 0) return;
    const scale = Math.min(1, THUMB_MAX / Math.max(currentBase.width(), currentBase.height()));
    const snapshot = await drawAsImage(
      <PageArtwork base={currentBase} ops={currentOps} fills={fills} scale={scale} />,
      { width: Math.round(currentBase.width() * scale), height: Math.round(currentBase.height() * scale) },
    );
    if (!snapshot) return;
    storage.saveThumbnail(userId, bookId, pageId, snapshot.encodeToBytes());
    bumpRevision();
  }, [userId, bookId, pageId, fills, bumpRevision]);

  useEffect(() => {
    if (!loaded.current) {
      loaded.current = true;
      return;
    }
    if (ops.length === 0) {
      storage.resetPage(userId, bookId, pageId);
      bumpRevision();
      return;
    }
    storage.saveLayer(userId, bookId, pageId, { version: 1, ops, updatedAt: Date.now() });
    if (thumbTimer.current) clearTimeout(thumbTimer.current);
    thumbTimer.current = setTimeout(writeThumbnail, THUMB_DELAY_MS);
  }, [ops, userId, bookId, pageId, writeThumbnail, bumpRevision]);

  // Don't lose the thumbnail if the user leaves right after drawing.
  useEffect(
    () => () => {
      if (thumbTimer.current) {
        clearTimeout(thumbTimer.current);
        void writeThumbnail();
      }
    },
    [writeThumbnail],
  );

  // --- Editing -----------------------------------------------------------
  const push = useCallback((op: Op) => {
    setOps((prev) => [...prev, op]);
    setRedo([]);
  }, []);

  const onStroke = useCallback((op: StrokeOp) => push(op), [push]);

  const onFill = useCallback(
    (x: number, y: number) => {
      if (!wallMap) return;
      const op: FillOp = { kind: 'fill', color, x: Math.round(x), y: Math.round(y) };
      const mask = computeFill(wallMap, op.x, op.y, op.color);
      if (!mask) return; // tapped on a line
      fills.set(op, mask);
      push(op);
    },
    [wallMap, color, fills, push],
  );

  const undo = () => {
    if (ops.length === 0) return;
    setRedo((r) => [...r, ops[ops.length - 1]]);
    setOps(ops.slice(0, -1));
  };

  const redoOne = () => {
    if (redo.length === 0) return;
    setOps([...ops, redo[redo.length - 1]]);
    setRedo(redo.slice(0, -1));
  };

  const resetPage = () =>
    confirm('Erase this page?', () => {
      setOps([]);
      setRedo([]);
    });

  const pickColor = (c: string) => {
    setColor(c);
    if (tool === 'eraser') setTool('crayon');
  };

  const toolIcon = TOOLS.find((t) => t.tool === tool)!.icon as keyof typeof MaterialCommunityIcons.glyphMap;

  const canvas = (
    <View style={[styles.canvasArea, landscape && { paddingHorizontal: 6, paddingTop: insets.top + 6, paddingBottom: insets.bottom + 6 }]}>
      <ColoringCanvas
        base={base ?? null}
        onArea={onArea}
        ops={ops}
        fills={fills}
        fillsVersion={fillsVersion}
        tool={tool}
        color={color}
        size={size}
        onFill={onFill}
        onStroke={onStroke}
        pinchZoom={pinchZoom}
      />
    </View>
  );

  const buttons = (
    <>
      <IconButton icon="restore" label="Reset page" onPress={resetPage} disabled={ops.length === 0} />
      <View style={landscape ? styles.dividerH : styles.divider} />
      <IconButton icon="undo" label="Undo" onPress={undo} disabled={ops.length === 0} />
      <IconButton icon="redo" label="Redo" onPress={redoOne} disabled={redo.length === 0} />
      <View style={landscape ? styles.dividerH : styles.divider} />
      <Pressable style={styles.toolButton} onPress={() => setSheetOpen(true)} accessibilityLabel="Coloring tools">
        <View style={[styles.toolCorner, { borderTopColor: tool === 'eraser' ? '#FFFFFF' : color }]} />
        <MaterialCommunityIcons name={toolIcon} size={30} color={colors.text} />
      </Pressable>
    </>
  );

  const sheet = (
    <ToolSheet
      visible={sheetOpen}
      tool={tool}
      size={size}
      color={color}
      onTool={setTool}
      onSize={setSize}
      onClose={() => setSheetOpen(false)}
    />
  );

  // Landscape: every control moves to the short sides so the page gets the full height.
  // [back] | page | crayons (pointing at the page) | tool buttons
  if (landscape) {
    return (
      <View style={[styles.screen, styles.row]}>
        <View style={[styles.sideBar, { paddingLeft: insets.left + 4, paddingTop: insets.top + 8 }]}>
          <IconButton icon="arrow-left" label="Back" onPress={() => router.back()} />
        </View>
        {canvas}
        <CrayonPicker selected={color} onSelect={pickColor} vertical insetStart={insets.top} insetEnd={insets.bottom} />
        <View
          style={[
            styles.toolbarVertical,
            { paddingRight: insets.right + 6, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 },
          ]}
        >
          {buttons}
        </View>
        {sheet}
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <Header onBack={() => router.back()} />
      {canvas}
      <CrayonPicker selected={color} onSelect={pickColor} />
      <View style={[styles.toolbar, { paddingBottom: insets.bottom + 10 }]}>{buttons}</View>
      {sheet}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.canvasBackdrop },
    row: { flexDirection: 'row' },
    sideBar: { backgroundColor: colors.background, paddingRight: 4 },
    toolbarVertical: {
      alignItems: 'center',
      justifyContent: 'space-evenly',
      backgroundColor: colors.surface,
      paddingLeft: 6,
    },
    dividerH: { height: 1, width: 36, backgroundColor: colors.outline },
    canvasArea: { flex: 1, padding: 12, justifyContent: 'center' },
    toolbar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-evenly',
      backgroundColor: colors.surface,
      paddingTop: 10,
    },
    divider: { width: 1, height: 36, backgroundColor: colors.outline },
    toolButton: {
      width: 64,
      height: 52,
      borderRadius: 8,
      borderWidth: 2,
      borderColor: colors.textMuted,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
    },
    toolCorner: {
      position: 'absolute',
      top: 0,
      left: 0,
      width: 0,
      height: 0,
      borderTopWidth: 18,
      borderRightWidth: 18,
      borderRightColor: 'transparent',
    },
  });
