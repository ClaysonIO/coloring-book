import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTheme, useThemedStyles } from '../state/ThemeContext';
import type { Colors } from '../theme';

type Props = { title?: string; subtitle?: string; onBack?: () => void; right?: ReactNode };

export function Header({ title, subtitle, onBack, right }: Props) {
  const styles = useThemedStyles(createStyles);
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingTop: insets.top + 8 }]}>
      {onBack ? <IconButton icon="arrow-left" onPress={onBack} label="Back" /> : <View style={styles.spacer} />}
      <View style={styles.titles}>
        {title ? (
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
        ) : null}
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      <View style={styles.right}>{right}</View>
    </View>
  );
}

export function IconButton({
  icon,
  onPress,
  label,
  disabled,
  color,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  onPress: () => void;
  label: string;
  disabled?: boolean;
  /** Defaults to the theme's text color. */
  color?: string;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <MaterialCommunityIcons name={icon} size={28} color={color ?? colors.text} />
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    bar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingBottom: 12, backgroundColor: colors.background },
    spacer: { width: 8 },
    titles: { flex: 1, marginLeft: 8 },
    title: { color: colors.text, fontSize: 28, fontWeight: '700' },
    subtitle: { color: colors.textMuted, fontSize: 17, marginTop: 2 },
    right: { flexDirection: 'row', alignItems: 'center' },
    iconButton: { padding: 10, borderRadius: 24 },
    pressed: { backgroundColor: colors.surfaceHigh },
    disabled: { opacity: 0.35 },
  });
