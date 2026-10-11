import { ActivityIndicator, Modal, StyleSheet, Text, View } from 'react-native';

import { ALL_ORIENTATIONS, colors } from '../theme';

export function BusyOverlay({ message }: { message: string | null }) {
  return (
    <Modal
      supportedOrientations={ALL_ORIENTATIONS}
      visible={message !== null}
      transparent
      animationType="fade"
    >
      <View style={styles.backdrop}>
        <View style={styles.box}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.text}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  box: { backgroundColor: colors.surface, borderRadius: 20, padding: 28, alignItems: 'center', gap: 16, minWidth: 220 },
  text: { color: colors.text, fontSize: 17 },
});
