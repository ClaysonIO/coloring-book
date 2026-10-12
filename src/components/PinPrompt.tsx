import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { User } from '../state/storage';
import { useThemedStyles } from '../state/ThemeContext';
import { ALL_ORIENTATIONS, type Colors } from '../theme';

export const PIN_LENGTH = 4;

type Props = {
  visible: boolean;
  title: string;
  /** Return an error message to stay open (and clear the digits), or null to accept. */
  onSubmit: (pin: string) => string | null;
  onCancel: () => void;
};

/** Number-pad PIN entry that submits as soon as all digits are typed. */
export function PinPrompt({ visible, title, onSubmit, onCancel }: Props) {
  const styles = useThemedStyles(createStyles);
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const input = useRef<TextInput>(null);

  useEffect(() => {
    if (visible) {
      setPin('');
      setError(null);
    }
  }, [visible]);
  // A new step (e.g. "enter it again") starts with empty digits but keeps any error from the last one.
  useEffect(() => setPin(''), [title]);

  const change = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, PIN_LENGTH);
    setPin(digits);
    if (digits.length === PIN_LENGTH) {
      const err = onSubmit(digits);
      if (err) {
        setError(err);
        setPin('');
      }
    } else {
      setError(null);
    }
  };

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
          <Pressable style={styles.dots} onPress={() => input.current?.focus()}>
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
            ))}
          </Pressable>
          <Text style={styles.error}>{error ?? ' '}</Text>
          <TextInput
            ref={input}
            value={pin}
            onChangeText={change}
            keyboardType="number-pad"
            secureTextEntry
            maxLength={PIN_LENGTH}
            autoFocus
            style={styles.hiddenInput}
            accessibilityLabel="PIN"
          />
          <Pressable onPress={onCancel} hitSlop={8} style={styles.cancelButton}>
            <Text style={styles.cancel}>Cancel</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

/**
 * Runs protected actions only after the user's PIN is entered (immediately if they have none).
 * Render `pinPrompt` somewhere in the screen.
 */
export function usePinGate() {
  const [request, setRequest] = useState<{ user: User; title: string; action: () => void } | null>(null);

  const gate = useCallback((user: User, title: string, action: () => void) => {
    if (!user.pin) action();
    else setRequest({ user, title, action });
  }, []);

  const pinPrompt = (
    <PinPrompt
      visible={request !== null}
      title={request?.title ?? ''}
      onCancel={() => setRequest(null)}
      onSubmit={(pin) => {
        if (!request || pin !== request.user.pin) return 'Wrong PIN';
        const { action } = request;
        setRequest(null);
        // Let the PIN modal close before any confirmation alert opens.
        setTimeout(action, 350);
        return null;
      }}
    />
  );

  return { gate, pinPrompt };
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
    dialog: {
      backgroundColor: colors.surface,
      borderRadius: 28,
      padding: 24,
      maxWidth: 400,
      width: '100%',
      alignSelf: 'center',
      alignItems: 'center',
    },
    title: { color: colors.text, fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
    dots: { flexDirection: 'row', gap: 18, paddingVertical: 8 },
    dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: colors.accent },
    dotFilled: { backgroundColor: colors.accent },
    error: { color: colors.danger, marginTop: 10, fontSize: 15 },
    hiddenInput: { position: 'absolute', width: 1, height: 1, opacity: 0 },
    cancelButton: { marginTop: 16 },
    cancel: { color: colors.textMuted, fontSize: 17 },
  });
