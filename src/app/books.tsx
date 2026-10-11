import { Redirect, router } from 'expo-router';
import { View } from 'react-native';

import { Grid } from '../components/Grid';
import { Header, IconButton } from '../components/Header';
import { Tile } from '../components/Tile';
import { books } from '../content/books';
import { useUsers } from '../state/UsersContext';
import { colors } from '../theme';

export default function BooksScreen() {
  const { currentUser } = useUsers();
  if (!currentUser) return <Redirect href="/" />;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <Header
        title="Coloring Books"
        subtitle={currentUser.name}
        onBack={() => router.back()}
        right={<IconButton icon="cog" label="Settings" onPress={() => router.push('/settings')} />}
      />
      <Grid>
        {books.map((book) => (
          <Tile
            key={book.id}
            title={book.title}
            image={book.cover ?? book.pages[0].image}
            aspectRatio={3 / 4}
            paper={!book.cover}
            onPress={() => router.push({ pathname: '/book/[bookId]', params: { bookId: book.id } })}
          />
        ))}
      </Grid>
    </View>
  );
}
