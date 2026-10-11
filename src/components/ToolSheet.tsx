import { MaterialCommunityIcons } from '@expo/vector-icons';
import Slider from '@react-native-community/slider';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TOOLS } from '../drawing/brushes';
import type { Tool } from '../drawing/types';
import { ALL_ORIENTATIONS, colors } from '../theme';

export const MIN_SIZE = 4;
export const MAX_SIZE = 60;

type Props = {
  visible: boolean;
  tool: Tool;
  size: number;
  color: string;
  onTool: (tool: Tool) => void;
  onSize: (size: number) => void;
  onClose: () => void;
};

export function ToolSheet({ visible, tool, size, color, onTool, onSize, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const preview = 6 + ((size - MIN_SIZE) / (MAX_SIZE - MIN_SIZE)) * 40;
  return (
    <Modal
      supportedOrientations={ALL_ORIENTATIONS}
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close tools" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.handle} />
        <View style={styles.headerRow}>
          <Text style={styles.heading}>Coloring Tools</Text>
          <Pressable onPress={onClose} hitSlop={10}>
            <Text style={styles.done}>Done</Text>
          </Pressable>
        </View>

        <View style={styles.tools}>
          {TOOLS.map((t) => {
            const active = t.tool === tool;
            return (
              <Pressable
                key={t.tool}
                onPress={() => onTool(t.tool)}
                style={[styles.tool, active && styles.toolActive]}
                accessibilityLabel={t.label}
                accessibilityState={{ selected: active }}
              >
                <MaterialCommunityIcons
                  name={t.icon as keyof typeof MaterialCommunityIcons.glyphMap}
                  size={28}
                  color={active ? colors.onAccentContainer : colors.text}
                />
                <Text style={[styles.toolLabel, active && styles.toolLabelActive]}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>

        <View style={[styles.sizeRow, tool === 'fill' && styles.hidden]}>
          <View style={styles.sizeSmall} />
          <Slider
            style={styles.slider}
            minimumValue={MIN_SIZE}
            maximumValue={MAX_SIZE}
            value={size}
            onValueChange={onSize}
            minimumTrackTintColor={colors.accent}
            maximumTrackTintColor={colors.accentContainer}
            thumbTintColor={colors.accent}
          />
          <View style={styles.sizeLarge} />
        </View>
        <View style={[styles.previewBox, tool === 'fill' && styles.hidden]}>
          <View
            style={{
              width: preview,
              height: preview,
              borderRadius: preview / 2,
              backgroundColor: tool === 'eraser' ? '#FFFFFF' : color,
              borderWidth: 1,
              borderColor: colors.outline,
            }}
          />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.textMuted, marginTop: 12 },
  headerRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, marginBottom: 14 },
  heading: { color: colors.text, fontSize: 20 },
  done: { color: colors.accent, fontSize: 18, fontWeight: '600' },
  tools: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 10 },
  tool: {
    width: 76,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.outline,
  },
  toolActive: { backgroundColor: colors.accentContainer, borderColor: colors.accentContainer },
  toolLabel: { color: colors.text, fontSize: 12, marginTop: 4 },
  toolLabelActive: { color: colors.onAccentContainer },
  sizeRow: { flexDirection: 'row', alignItems: 'center', marginTop: 16 },
  slider: { flex: 1, height: 40, marginHorizontal: 8 },
  sizeSmall: { width: 10, height: 10, borderRadius: 5, backgroundColor: colors.accent },
  sizeLarge: { width: 26, height: 26, borderRadius: 13, backgroundColor: colors.accent },
  previewBox: { height: 52, alignItems: 'center', justifyContent: 'center' },
  hidden: { display: 'none' },
});
