import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';

import { BusyOverlay } from '../../components/BusyOverlay';
import { confirm } from '../../components/confirm';
import { Grid } from '../../components/Grid';
import { Header, IconButton } from '../../components/Header';
import { NamePrompt } from '../../components/NamePrompt';
import { pickImages } from '../../components/pickImages';
import { AddTile, Tile } from '../../components/Tile';
import { useLibrary } from '../../state/LibraryContext';
import { useUsers } from '../../state/UsersContext';
import * as storage from '../../state/storage';
import { colors } from '../../theme';

export default function BookScreen() {
  const { bookId, edit } = useLocalSearchParams<{ bookId: string; edit?: string }>();
  const { currentUser, bumpRevision } = useUsers();
  const { getBook, addPages, removePage, renamePage } = useLibrary();
  const [editing, setEditing] = useState(edit === '1');
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const book = getBook(bookId);
  if (!currentUser || !book) return <Redirect href="/books" />;

  const resetBook = () =>
    confirm(`Erase all of ${currentUser.name}'s coloring in ${book.title}?`, () => {
      storage.resetBook(currentUser.id, book.id);
      bumpRevision();
    });

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
    Alert.alert(`Remove ${title}?`, "Everyone's coloring on this page will be deleted.", [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => removePage(book.id, pageId) },
    ]);

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
      <Grid>
        {book.pages.map((page) => {
          const thumb = storage.thumbnailUri(currentUser.id, book.id, page.id);
          return (
            <Tile
              key={page.id}
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
        })}
        {editing && <AddTile label="Add pages" aspectRatio={1} onPress={add} />}
      </Grid>

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
    </View>
  );
}
