import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Alert, View } from 'react-native';

import { confirm } from '../../components/confirm';
import { Grid } from '../../components/Grid';
import { Header, IconButton } from '../../components/Header';
import { Tile } from '../../components/Tile';
import { getBook } from '../../content/books';
import { useUsers } from '../../state/UsersContext';
import * as storage from '../../state/storage';
import { colors } from '../../theme';

export default function BookScreen() {
  const { bookId } = useLocalSearchParams<{ bookId: string }>();
  const { currentUser, bumpRevision } = useUsers();
  const book = getBook(bookId);
  if (!currentUser || !book) return <Redirect href="/" />;

  const resetBook = () =>
    confirm(`Erase all coloring in ${book.title}?`, () => {
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

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title={book.title}
        subtitle="Coloring Books"
        onBack={() => router.back()}
        right={<IconButton icon="restore" label="Reset book" onPress={resetBook} />}
      />
      <Grid>
        {book.pages.map((page) => {
          const thumb = storage.thumbnailUri(currentUser.id, book.id, page.id);
          return (
            <Tile
              key={page.id}
              title={page.title}
              image={thumb ? { uri: thumb } : page.image}
              aspectRatio={1}
              paper
              onPress={() =>
                router.push({ pathname: '/color/[bookId]/[pageId]', params: { bookId: book.id, pageId: page.id } })
              }
              onLongPress={() => pageOptions(page.id, page.title)}
            />
          );
        })}
      </Grid>
    </View>
  );
}
