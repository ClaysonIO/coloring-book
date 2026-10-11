import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ALL_ORIENTATIONS, colors } from '../theme';

type Props = {
  visible: boolean;
  title: string;
  initialValue?: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: (value: string) => void;
  /** Extra controls under the text field. */
  children?: ReactNode;
};

export function NamePrompt({ visible, title, initialValue = '', confirmLabel, onCancel, onConfirm, children }: Props) {
  const [value, setValue] = useState(initialValue);
  useEffect(() => {
    if (visible) setValue(initialValue);
  }, [visible, initialValue]);
  const ok = value.trim().length > 0;
  const submit = () => ok && onConfirm(value.trim());
  return (
    <Modal
      supportedOrientations={ALL_ORIENTATIONS}
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <TextInput
            value={value}
            onChangeText={setValue}
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
            maxLength={40}
            returnKeyType="done"
            onSubmitEditing={submit}
          />
          {children}
          <View style={styles.actions}>
            <Pressable onPress={onCancel} hitSlop={8}>
              <Text style={styles.cancel}>Cancel</Text>
            </Pressable>
            <Pressable onPress={submit} hitSlop={8} disabled={!ok}>
              <Text style={[styles.ok, !ok && { opacity: 0.4 }]}>{confirmLabel}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.surface, borderRadius: 28, padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  title: { color: colors.text, fontSize: 22, fontWeight: '600', marginBottom: 16 },
  input: {
    color: colors.text,
    fontSize: 20,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 28, marginTop: 28 },
  cancel: { color: colors.textMuted, fontSize: 17 },
  ok: { color: colors.accent, fontSize: 17, fontWeight: '600' },
});
