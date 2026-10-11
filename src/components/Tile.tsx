import { Image, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import { colors } from '../theme';

type Props = {
  title: string;
  image: ImageSourcePropType;
  /** Width / height of the artwork area. */
  aspectRatio: number;
  /** Pages sit on white "paper"; covers fill the frame. */
  paper?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
};

export function Tile({ title, image, aspectRatio, paper, onPress, onLongPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityLabel={title}
    >
      <View style={[styles.art, { aspectRatio }, paper && styles.paper]}>
        <Image source={image} style={styles.image} resizeMode={paper ? 'contain' : 'cover'} />
      </View>
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 22, padding: 10 },
  pressed: { opacity: 0.8 },
  art: { width: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surfaceHigh },
  paper: { backgroundColor: 'white' },
  image: { width: '100%', height: '100%' },
  title: { color: colors.text, fontSize: 20, fontWeight: '500', textAlign: 'center', marginTop: 10, marginBottom: 4 },
});
