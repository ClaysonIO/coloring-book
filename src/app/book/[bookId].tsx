import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { BusyOverlay } from '../../components/BusyOverlay';
import { confirm } from '../../components/confirm';
import { Grid } from '../../components/Grid';
import { Header, IconButton } from '../../components/Header';
import { NamePrompt } from '../../components/NamePrompt';
import { pickImages } from '../../components/pickImages';
import { usePinGate } from '../../components/PinPrompt';
import { AddTile, Tile } from '../../components/Tile';
import { useLibrary } from '../../state/LibraryContext';
import { useUsers } from '../../state/UsersContext';
import * as storage from '../../state/storage';
import { useTheme } from '../../state/ThemeContext';

export default function BookScreen() {
  const { colors } = useTheme();
  const { bookId, edit } = useLocalSearchParams<{ bookId: string; edit?: string }>();
  const { currentUser, bumpRevision } = useUsers();
  const { getBook, addPages, addSketchPage, removePage, renamePage } = useLibrary();
  const [editing, setEditing] = useState(edit === '1');
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { gate, pinPrompt } = usePinGate();
  const book = getBook(bookId);
  if (!currentUser || !book) return <Redirect href="/books" />;

  const resetBook = () =>
    gate(currentUser, `Enter ${currentUser.name}'s PIN to erase ${book.title}`, () =>
      confirm(`Erase all of ${currentUser.name}'s coloring in ${book.title}?`, () => {
        storage.resetBook(currentUser.id, book.id);
        bumpRevision();
      }),
    );

  const pageOptions = (pageId: string, title: string) => {
    if (!storage.loadLayer(currentUser.id, book.id, pageId)) return;
    Alert.alert(title, undefined, [
      {
        text: 'Reset this page',
        style: 'destructive',
        onPress: () =>
          confirm(`Erase ${title}?`, () => {
            storage.resetPage(currentUser.id, book.id, pageId);
            bumpRevision();
          }),
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const add = async () => {
    const images = await pickImages(true);
    if (images.length === 0) return;
    setBusy(`Adding 0 of ${images.length}…`);
    const failed = await addPages(book.id, images, (done) => setBusy(`Adding ${done} of ${images.length}…`));
    setBusy(null);
    if (failed) Alert.alert(`${failed} image${failed > 1 ? 's' : ''} couldn't be read`, 'They were skipped.');
  };

  const remove = (pageId: string, title: string) =>
    Alert.alert(
      `Remove ${title}?`,
      book.sketchbook ? 'Your drawing on this page will be deleted.' : "Everyone's coloring on this page will be deleted.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removePage(book.id, pageId) },
      ],
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={book.title}
        subtitle="Coloring Books"
        onBack={() => router.back()}
        right={
          <>
            <IconButton
              icon={editing ? 'check' : 'pencil'}
              label={editing ? 'Done editing' : 'Edit pages'}
              onPress={() => setEditing(!editing)}
              color={editing ? colors.accent : colors.text}
            />
            <IconButton icon="restore" label="Reset book" onPress={resetBook} />
          </>
        }
      />
      <Grid
        items={book.pages}
        keyOf={(page) => page.id}
        renderItem={(page) => {
          const thumb = storage.thumbnailUri(currentUser.id, book.id, page.id);
          return (
            <Tile
              title={page.title}
              image={thumb ?? page.image}
              aspectRatio={1}
              paper
              onPress={() =>
                router.push({ pathname: '/color/[bookId]/[pageId]', params: { bookId: book.id, pageId: page.id } })
              }
              onLongPress={
                editing
                  ? page.custom
                    ? () => setRenaming({ id: page.id, title: page.title })
                    : undefined
                  : () => pageOptions(page.id, page.title)
              }
              onRemove={editing ? () => remove(page.id, page.title) : undefined}
            />
          );
        }}
        trailing={
          book.sketchbook ? (
            <AddTile label="New page" aspectRatio={1} onPress={addSketchPage} />
          ) : editing ? (
            <AddTile label="Add pages" aspectRatio={1} onPress={add} />
          ) : undefined
        }
      />

      <NamePrompt
        visible={renaming !== null}
        title="Rename page"
        initialValue={renaming?.title}
        confirmLabel="Save"
        onCancel={() => setRenaming(null)}
        onConfirm={(title) => {
          if (renaming) renamePage(book.id, renaming.id, title);
          setRenaming(null);
        }}
      />
      <BusyOverlay message={busy} />
      {pinPrompt}
    </View>
  );
}
