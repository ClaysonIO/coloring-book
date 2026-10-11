import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { ImageRef } from '../content/books';
import { colors } from '../theme';

type Props = {
  title: string;
  image?: ImageRef;
  /** Width / height of the artwork area. */
  aspectRatio: number;
  /** Pages sit on white "paper"; covers fill the frame. */
  paper?: boolean;
  onPress: () => void;
  onLongPress?: () => void;
  /** Shows a remove badge (edit mode). */
  onRemove?: () => void;
};

export function Tile({ title, image, aspectRatio, paper, onPress, onLongPress, onRemove }: Props) {
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      accessibilityLabel={title}
    >
      <View style={[styles.art, { aspectRatio }, paper && styles.paper]}>
        {image !== undefined && (
          // Page art is up to 2048px; expo-image decodes it at tile size instead of full size.
          <Image
            source={typeof image === 'number' ? image : { uri: image }}
            style={styles.image}
            contentFit={paper ? 'contain' : 'cover'}
            cachePolicy="memory"
            transition={100}
          />
        )}
      </View>
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
        {title}
      </Text>
      {onRemove && (
        <Pressable onPress={onRemove} style={styles.remove} hitSlop={6} accessibilityLabel={`Remove ${title}`}>
          <MaterialCommunityIcons name="close" size={22} color="#fff" />
        </Pressable>
      )}
    </Pressable>
  );
}

/** Dashed "add" tile shown at the end of a grid in edit mode. */
export function AddTile({ label, aspectRatio, onPress }: { label: string; aspectRatio: number; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed]} accessibilityLabel={label}>
      <View style={[styles.art, styles.add, { aspectRatio }]}>
        <MaterialCommunityIcons name="plus" size={56} color={colors.accent} />
      </View>
      <Text style={styles.title} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { flex: 1, backgroundColor: colors.surface, borderRadius: 22, padding: 10 },
  pressed: { opacity: 0.8 },
  art: { width: '100%', borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surfaceHigh },
  paper: { backgroundColor: 'white' },
  add: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: colors.outline,
  },
  image: { width: '100%', height: '100%' },
  title: { color: colors.text, fontSize: 20, fontWeight: '500', textAlign: 'center', marginTop: 10, marginBottom: 4 },
  remove: {
    position: 'absolute',
    top: 2,
    right: 2,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#C62828',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
});
