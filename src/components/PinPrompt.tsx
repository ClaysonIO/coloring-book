import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import type { User } from '../state/storage';
import { ALL_ORIENTATIONS, colors } from '../theme';

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

  // autoFocus inside a Modal is unreliable (the keyboard often never appears), so focus once the
  // modal has finished showing. Blurring first makes focus() reopen a keyboard the user dismissed.
  const focusInput = () => {
    input.current?.blur();
    setTimeout(() => input.current?.focus(), 50);
  };

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
      onShow={focusInput}
    >
      <View style={styles.backdrop}>
        <View style={styles.dialog}>
          <Text style={styles.title}>{title}</Text>
          <View style={styles.dots}>
            {Array.from({ length: PIN_LENGTH }, (_, i) => (
              <View key={i} style={[styles.dot, i < pin.length && styles.dotFilled]} />
            ))}
            {/* The real input sits invisibly over the dots, so tapping them opens the keyboard directly. */}
            <TextInput
              ref={input}
              value={pin}
              onChangeText={change}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={PIN_LENGTH}
              caretHidden
              contextMenuHidden
              selectionColor="transparent"
              style={styles.hiddenInput}
              accessibilityLabel="PIN"
            />
          </View>
          <Text style={styles.error}>{error ?? ' '}</Text>
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

const styles = StyleSheet.create({
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
  // Kept fully opaque (an invisible or 1px view may not take touches or focus); the text itself is transparent.
  hiddenInput: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, color: 'transparent', backgroundColor: 'transparent', fontSize: 1 },
  cancelButton: { marginTop: 16 },
  cancel: { color: colors.textMuted, fontSize: 17 },
});
