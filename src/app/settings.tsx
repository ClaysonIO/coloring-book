import { Redirect, router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirm } from '../components/confirm';
import { Header } from '../components/Header';
import { books } from '../content/books';
import { useUsers } from '../state/UsersContext';
import * as storage from '../state/storage';
import { colors } from '../theme';

export default function SettingsScreen() {
  const { currentUser, deleteUser, selectUser, bumpRevision } = useUsers();
  const insets = useSafeAreaInsets();
  if (!currentUser) return <Redirect href="/" />;
  const { id, name } = currentUser;

  return (
    <View style={styles.screen}>
      <Header title="Settings" subtitle={name} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}>
        <Text style={styles.section}>Reset a book</Text>
        {books.map((book) => (
          <Row
            key={book.id}
            label={book.title}
            action="Reset"
            onPress={() =>
              confirm(`Erase all coloring in ${book.title}?`, () => {
                storage.resetBook(id, book.id);
                bumpRevision();
              })
            }
          />
        ))}

        <Text style={styles.section}>Account</Text>
        <Row
          label="Switch user"
          onPress={() => {
            selectUser(null);
            router.dismissAll();
          }}
        />
        <Row
          label={`Reset all of ${name}'s coloring`}
          danger
          onPress={() =>
            confirm(`Erase every page ${name} has colored?`, () => {
              storage.resetUser(id);
              bumpRevision();
            })
          }
        />
        <Row
          label={`Delete ${name}`}
          danger
          onPress={() =>
            confirm(`Delete ${name} and all their coloring?`, () => {
              router.dismissAll();
              deleteUser(id);
            })
          }
        />
      </ScrollView>
    </View>
  );
}

function Row({ label, action, danger, onPress }: { label: string; action?: string; danger?: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      {action ? <Text style={styles.rowAction}>{action}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: 16 },
  section: { color: colors.accent, fontSize: 15, fontWeight: '600', marginTop: 20, marginBottom: 8, marginLeft: 4 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 8,
  },
  rowLabel: { color: colors.text, fontSize: 18, flexShrink: 1 },
  rowAction: { color: colors.danger, fontSize: 16, fontWeight: '600' },
});
