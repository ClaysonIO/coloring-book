import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { BusyOverlay } from '../components/BusyOverlay';
import { Grid } from '../components/Grid';
import { Header, IconButton } from '../components/Header';
import { NamePrompt } from '../components/NamePrompt';
import { pickImages } from '../components/pickImages';
import { usePinGate } from '../components/PinPrompt';
import { AddTile, Tile } from '../components/Tile';
import { useLibrary, type PickedImage } from '../state/LibraryContext';
import { useUsers } from '../state/UsersContext';
import { useTheme, useThemedStyles } from '../state/ThemeContext';
import type { Colors } from '../theme';

export default function BooksScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { currentUser } = useUsers();
  const { books, createBook, removeBook, renameBook, newPackCount } = useLibrary();
  const [editing, setEditing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [cover, setCover] = useState<PickedImage | null>(null);
  const [renaming, setRenaming] = useState<{ id: string; title: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const { gate, pinPrompt } = usePinGate();
  if (!currentUser) return <Redirect href="/" />;

  const open = (bookId: string, edit = false) =>
    router.push({ pathname: '/book/[bookId]', params: { bookId, ...(edit ? { edit: '1' } : {}) } });

  const create = async (title: string) => {
    setCreating(false);
    setBusy('Creating book…');
    try {
      const id = await createBook(title, cover ?? undefined);
      open(id, true);
    } catch {
      Alert.alert("Couldn't read that cover image", 'The book was not created. Try a different image.');
    } finally {
      setBusy(null);
      setCover(null);
    }
  };

  // Removing a book clears it for everyone, so it sits behind the PIN like resetting a book.
  const remove = (id: string, title: string) =>
    gate(currentUser, `Enter ${currentUser.name}'s PIN to remove ${title}`, () =>
      Alert.alert(`Remove ${title}?`, "Its pages and everyone's coloring in it will be deleted.", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removeBook(id) },
      ]),
    );

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Coloring Books"
        subtitle={currentUser.name}
        onBack={() => router.back()}
        right={
          <>
            <IconButton
              icon={editing ? 'check' : 'pencil'}
              label={editing ? 'Done editing' : 'Edit books'}
              onPress={() => setEditing(!editing)}
              color={editing ? colors.accent : colors.text}
            />
            <IconButton icon="book-plus-multiple" label="More books" onPress={() => router.push('/get-books')} />
            <IconButton icon="cog" label="Settings" onPress={() => router.push('/settings')} />
          </>
        }
      />
      <Grid
        items={books}
        keyOf={(book) => book.id}
        renderItem={(book) => (
          <Tile
            title={book.title}
            image={book.cover ?? book.pages[0]?.image}
            aspectRatio={3 / 4}
            paper={!book.cover}
            onPress={() => open(book.id, editing)}
            onLongPress={editing && book.custom ? () => setRenaming({ id: book.id, title: book.title }) : undefined}
            onRemove={editing && !book.sketchbook ? () => remove(book.id, book.title) : undefined}
          />
        )}
        trailing={
          editing ? (
            <AddTile label="New book" aspectRatio={3 / 4} onPress={() => setCreating(true)} />
          ) : (
            <AddTile
              label="More books"
              icon="book-plus-multiple"
              badge={newPackCount}
              aspectRatio={3 / 4}
              onPress={() => router.push('/get-books')}
            />
          )
        }
      />

      <NamePrompt
        visible={creating}
        title="New book"
        confirmLabel="Create"
        onCancel={() => {
          setCreating(false);
          setCover(null);
        }}
        onConfirm={create}
      >
        <Pressable
          style={styles.coverButton}
          onPress={async () => {
            const [picked] = await pickImages(false);
            if (picked) setCover(picked);
          }}
        >
          <Text style={styles.coverText}>{cover ? 'Cover chosen ✓  (tap to change)' : 'Choose a cover (optional)'}</Text>
        </Pressable>
      </NamePrompt>

      <NamePrompt
        visible={renaming !== null}
        title="Rename book"
        initialValue={renaming?.title}
        confirmLabel="Save"
        onCancel={() => setRenaming(null)}
        onConfirm={(title) => {
          if (renaming) renameBook(renaming.id, title);
          setRenaming(null);
        }}
      />
      <BusyOverlay message={busy} />
      {pinPrompt}
    </View>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    coverButton: { marginTop: 16, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: colors.outline, alignItems: 'center' },
    coverText: { color: colors.accent, fontSize: 16 },
  });
