import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Alert } from 'react-native';

import type { PickedImage } from '../state/LibraryContext';

/** Asks Photos-or-Files, then lets the user pick one or many images. Resolves [] if cancelled. */
export function pickImages(multiple: boolean): Promise<PickedImage[]> {
  return new Promise((resolve) => {
    Alert.alert(multiple ? 'Add pages from' : 'Choose a cover from', undefined, [
      { text: 'Photos', onPress: () => fromPhotos(multiple).then(resolve, () => resolve([])) },
      { text: 'Files', onPress: () => fromFiles(multiple).then(resolve, () => resolve([])) },
      { text: 'Cancel', style: 'cancel', onPress: () => resolve([]) },
    ]);
  });
}

async function fromPhotos(multiple: boolean): Promise<PickedImage[]> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? 0 : 1,
    orderedSelection: true,
    quality: 1,
  });
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, name: a.fileName }));
}

async function fromFiles(multiple: boolean): Promise<PickedImage[]> {
  const result = await DocumentPicker.getDocumentAsync({ type: 'image/*', multiple, copyToCacheDirectory: true });
  if (result.canceled) return [];
  return result.assets.map((a) => ({ uri: a.uri, name: a.name }));
}
