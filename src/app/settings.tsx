import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirm } from '../components/confirm';
import { Header } from '../components/Header';
import { PinPrompt, usePinGate } from '../components/PinPrompt';
import { useLibrary } from '../state/LibraryContext';
import { useUsers } from '../state/UsersContext';
import * as storage from '../state/storage';
import { colors } from '../theme';

/** Two-step "choose, then repeat" flow for setting a PIN. */
type PinSetup = { step: 'choose' } | { step: 'repeat'; first: string } | null;

export default function SettingsScreen() {
  const { currentUser, deleteUser, selectUser, setPin, bumpRevision } = useUsers();
  const { books, hasRemovedBuiltIns, restoreBuiltIns } = useLibrary();
  const insets = useSafeAreaInsets();
  const { gate, pinPrompt } = usePinGate();
  const [setup, setSetup] = useState<PinSetup>(null);
  if (!currentUser) return <Redirect href="/" />;
  const { id, name } = currentUser;

  const guarded = (what: string, action: () => void) => gate(currentUser, `Enter ${name}'s PIN to ${what}`, action);

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
              guarded(`reset ${book.title}`, () =>
                confirm(`Erase all of ${name}'s coloring in ${book.title}?`, () => {
                  storage.resetBook(id, book.id);
                  bumpRevision();
                }),
              )
            }
          />
        ))}

        {hasRemovedBuiltIns && (
          <>
            <Text style={styles.section}>Library</Text>
            <Row label="Bring back removed built-in books and pages" onPress={restoreBuiltIns} />
          </>
        )}

        <Text style={styles.section}>PIN</Text>
        <Text style={styles.note}>
          A PIN stops this account from being deleted or having whole books cleared without it. Single pages can
          always be cleared.
        </Text>
        {currentUser.pin ? (
          <>
            <Row label="Change PIN" onPress={() => guarded('change the PIN', () => setSetup({ step: 'choose' }))} />
            <Row
              label="Remove PIN"
              onPress={() =>
                guarded('remove the PIN', () => {
                  setPin(id, null);
                  Alert.alert('PIN removed');
                })
              }
            />
          </>
        ) : (
          <Row label="Set a PIN" onPress={() => setSetup({ step: 'choose' })} />
        )}

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
            guarded('reset everything', () =>
              confirm(`Erase every page ${name} has colored?`, () => {
                storage.resetUser(id);
                bumpRevision();
              }),
            )
          }
        />
        <Row
          label={`Delete ${name}`}
          danger
          onPress={() =>
            guarded(`delete ${name}`, () =>
              confirm(`Delete ${name} and all their coloring?`, () => {
                router.dismissAll();
                deleteUser(id);
              }),
            )
          }
        />
      </ScrollView>

      <PinPrompt
        visible={setup !== null}
        title={setup?.step === 'repeat' ? 'Enter the PIN again' : 'Choose a 4-digit PIN'}
        onCancel={() => setSetup(null)}
        onSubmit={(pin) => {
          if (setup?.step === 'choose') {
            setSetup({ step: 'repeat', first: pin });
            return null;
          }
          if (setup?.step === 'repeat' && pin !== setup.first) {
            setSetup({ step: 'choose' });
            return "PINs didn't match. Try again.";
          }
          setPin(id, pin);
          setSetup(null);
          return null;
        }}
      />
      {pinPrompt}
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
  note: { color: colors.textMuted, fontSize: 14, marginBottom: 10, marginHorizontal: 4 },
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
