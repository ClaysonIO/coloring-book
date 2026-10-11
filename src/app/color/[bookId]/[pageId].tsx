import { MaterialCommunityIcons } from '@expo/vector-icons';
import { drawAsImage, useImage } from '@shopify/react-native-skia';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirm } from '../../../components/confirm';
import { CrayonPicker } from '../../../components/CrayonPicker';
import { Header, IconButton } from '../../../components/Header';
import { ToolSheet } from '../../../components/ToolSheet';
import type { ImageRef } from '../../../content/books';
import { TOOLS } from '../../../drawing/brushes';
import { ColoringCanvas } from '../../../drawing/ColoringCanvas';
import { buildWallMap, computeFill, type FillMask } from '../../../drawing/floodFill';
import { PageArtwork } from '../../../drawing/PageArtwork';
import type { FillOp, Op, StrokeOp, Tool } from '../../../drawing/types';
import { useLibrary } from '../../../state/LibraryContext';
import { useUsers } from '../../../state/UsersContext';
import * as storage from '../../../state/storage';
import { colors } from '../../../theme';

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
      bookId={bookId}
      pageId={pageId}
      image={page.image}
    />
  );
}

function Colorer({ userId, bookId, pageId, image }: { userId: string; bookId: string; pageId: string; image: ImageRef }) {
  const insets = useSafeAreaInsets();
  const { bumpRevision } = useUsers();
  const base = useImage(image);

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

  return (
    <View style={styles.screen}>
      <Header onBack={() => router.back()} />
      <View style={styles.canvasArea}>
        {base ? (
          <ColoringCanvas
            base={base}
            ops={ops}
            fills={fills}
            fillsVersion={fillsVersion}
            tool={tool}
            color={color}
            size={size}
            onFill={onFill}
            onStroke={onStroke}
          />
        ) : (
          <ActivityIndicator color={colors.accent} />
        )}
      </View>

      <CrayonPicker selected={color} onSelect={pickColor} />

      <View style={[styles.toolbar, { paddingBottom: insets.bottom + 10 }]}>
        <IconButton icon="restore" label="Reset page" onPress={resetPage} disabled={ops.length === 0} />
        <View style={styles.divider} />
        <IconButton icon="undo" label="Undo" onPress={undo} disabled={ops.length === 0} />
        <IconButton icon="redo" label="Redo" onPress={redoOne} disabled={redo.length === 0} />
        <View style={styles.divider} />
        <Pressable style={styles.toolButton} onPress={() => setSheetOpen(true)} accessibilityLabel="Coloring tools">
          <View style={[styles.toolCorner, { borderTopColor: tool === 'eraser' ? '#FFFFFF' : color }]} />
          <MaterialCommunityIcons name={toolIcon} size={30} color={colors.text} />
        </Pressable>
      </View>

      <ToolSheet
        visible={sheetOpen}
        tool={tool}
        size={size}
        color={color}
        onTool={setTool}
        onSize={setSize}
        onClose={() => setSheetOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#0E0E0E' },
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
