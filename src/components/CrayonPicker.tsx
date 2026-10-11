import { useEffect, useRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

/** Swipe left/right for more. Roughly ordered around the color wheel, then browns, skin tones and greys. */
export const CRAYON_COLORS = [
  '#F8BBD0', '#F48FB1', '#F06292', '#EC407A', '#E91E63', '#C2185B', '#FF8A80', '#FF5252',
  '#F44336', '#D32F2F', '#B71C1C', '#8E1B1B', '#FF7043', '#F4511E', '#FF9800', '#FB8C00',
  '#FFB74D', '#FFCC80', '#FFE082', '#FFD54F', '#FFEB3B', '#FDD835', '#FFF59D', '#E6EE9C',
  '#CDDC39', '#AED581', '#8BC34A', '#66BB6A', '#43A047', '#2E7D32', '#1B5E20', '#004D40',
  '#00897B', '#26A69A', '#80CBC4', '#4DD0E1', '#00BCD4', '#0097A7', '#81D4FA', '#4FC3F7',
  '#29B6F6', '#039BE5', '#1E88E5', '#1565C0', '#0D47A1', '#3F51B5', '#283593', '#7986CB',
  '#9575CD', '#673AB7', '#4527A0', '#BA68C8', '#9C27B0', '#6A1B9A', '#CE93D8', '#E1BEE7',
  '#FFE0BD', '#F1C27D', '#E0AC69', '#C68642', '#8D5524', '#5D3A1A', '#A1887F', '#795548',
  '#5D4037', '#3E2723', '#D7CCC8', '#FFFFFF', '#E0E0E0', '#BDBDBD', '#9E9E9E', '#757575',
  '#616161', '#424242', '#212121', '#000000',
];

const CRAYON_WIDTH = 44;
const GAP = 4;

type Props = { selected: string; onSelect: (color: string) => void };

export function CrayonPicker({ selected, onSelect }: Props) {
  const scrollRef = useRef<ScrollView>(null);

  // Start with the selected crayon in view.
  useEffect(() => {
    const index = CRAYON_COLORS.indexOf(selected);
    if (index > 2) scrollRef.current?.scrollTo({ x: (index - 2) * (CRAYON_WIDTH + GAP), animated: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <ScrollView
      ref={scrollRef}
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      style={styles.scroller}
    >
      {CRAYON_COLORS.map((color) => (
        <Pressable key={color} onPress={() => onSelect(color)} accessibilityLabel={`Color ${color}`}>
          <Crayon color={color} selected={color === selected} />
        </Pressable>
      ))}
    </ScrollView>
  );
}

function Crayon({ color, selected }: { color: string; selected: boolean }) {
  const isWhite = color === '#FFFFFF';
  return (
    <View style={[styles.crayon, selected && styles.crayonSelected]}>
      <View style={[styles.nub, { backgroundColor: color }]} />
      <View style={[styles.tip, { borderBottomColor: color }]} />
      <View style={[styles.body, { backgroundColor: color }, isWhite && styles.whiteBody]}>
        <View style={styles.highlight} />
        <View style={[styles.band, { top: 10 }]} />
        <View style={[styles.band, { top: 56 }]} />
      </View>
    </View>
  );
}

const TIP_HEIGHT = 34;
const TIP_INSET = 11;

const styles = StyleSheet.create({
  scroller: { flexGrow: 0 },
  row: { paddingHorizontal: 8, gap: GAP, alignItems: 'flex-end', height: 120 },
  crayon: { width: CRAYON_WIDTH, alignItems: 'center', transform: [{ translateY: 28 }] },
  crayonSelected: { transform: [{ translateY: 0 }] },
  nub: { width: CRAYON_WIDTH - TIP_INSET * 2 - 6, height: 6, borderTopLeftRadius: 4, borderTopRightRadius: 4 },
  tip: {
    width: CRAYON_WIDTH,
    height: 0,
    borderBottomWidth: TIP_HEIGHT,
    borderLeftWidth: TIP_INSET,
    borderRightWidth: TIP_INSET,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  body: { width: CRAYON_WIDTH, height: 80, borderTopLeftRadius: 3, borderTopRightRadius: 3, overflow: 'hidden' },
  whiteBody: { borderWidth: StyleSheet.hairlineWidth, borderColor: '#999' },
  highlight: { position: 'absolute', left: 5, top: 0, bottom: 0, width: 6, backgroundColor: 'rgba(255,255,255,0.3)' },
  band: { position: 'absolute', left: 0, right: 0, height: 8, backgroundColor: 'rgba(0,0,0,0.18)' },
});
