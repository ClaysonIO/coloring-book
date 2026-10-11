import { Alert } from 'react-native';

/** Destructive confirmation used by every reset. */
export function confirm(message: string, onConfirm: () => void) {
  Alert.alert(message, 'This cannot be undone.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Erase', style: 'destructive', onPress: onConfirm },
  ]);
}
