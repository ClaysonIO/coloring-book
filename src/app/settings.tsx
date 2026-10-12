import { MaterialCommunityIcons } from '@expo/vector-icons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirm } from '../components/confirm';
import { Header } from '../components/Header';
import { PinPrompt, usePinGate } from '../components/PinPrompt';
import { useLibrary } from '../state/LibraryContext';
import { useUsers } from '../state/UsersContext';
import * as storage from '../state/storage';
import { useTheme, useThemedStyles } from '../state/ThemeContext';
import type { Colors, ThemePreference } from '../theme';

/** Two-step "choose, then repeat" flow for setting a PIN. */
type PinSetup = { step: 'choose' } | { step: 'repeat'; first: string } | null;

export default function SettingsScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors, preference, setPreference } = useTheme();
  const { currentUser, deleteUser, selectUser, setPin, setPinchZoom, bumpRevision } = useUsers();
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
        <Text style={styles.section}>Appearance</Text>
        <Text style={styles.note}>For everyone on this device. Automatic follows the device's light or dark setting.</Text>
        <View style={styles.segments} accessibilityRole="radiogroup">
          {THEME_OPTIONS.map(({ value, label, icon }) => {
            const active = preference === value;
            return (
              <Pressable
                key={value}
                onPress={() => setPreference(value)}
                style={[styles.segment, active && styles.segmentActive]}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                accessibilityLabel={label}
              >
                <MaterialCommunityIcons name={icon} size={22} color={active ? colors.onAccentContainer : colors.text} />
                <Text style={[styles.segmentLabel, active && styles.segmentLabelActive]}>{label}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.section}>Coloring</Text>
        <Text style={styles.note}>
          Just for {name}. Pinch with two fingers to zoom in on a page and drag with two fingers to move around. One
          finger always colors.
        </Text>
        <Pressable
          onPress={() => setPinchZoom(id, !currentUser.pinchZoom)}
          style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}
          accessibilityRole="switch"
          accessibilityState={{ checked: !!currentUser.pinchZoom }}
          accessibilityLabel="Pinch to zoom"
        >
          <Text style={styles.rowLabel}>Pinch to zoom</Text>
          <Switch
            value={!!currentUser.pinchZoom}
            onValueChange={(on) => setPinchZoom(id, on)}
            trackColor={{ true: colors.accent, false: colors.outline }}
            thumbColor="white"
            ios_backgroundColor={colors.outline}
          />
        </Pressable>

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

const THEME_OPTIONS: { value: ThemePreference; label: string; icon: keyof typeof MaterialCommunityIcons.glyphMap }[] = [
  { value: 'system', label: 'Automatic', icon: 'theme-light-dark' },
  { value: 'light', label: 'Light', icon: 'white-balance-sunny' },
  { value: 'dark', label: 'Dark', icon: 'weather-night' },
];

function Row({ label, action, danger, onPress }: { label: string; action?: string; danger?: boolean; onPress: () => void }) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { opacity: 0.7 }]}>
      <Text style={[styles.rowLabel, danger && { color: colors.danger }]}>{label}</Text>
      {action ? <Text style={styles.rowAction}>{action}</Text> : null}
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
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
    segments: { flexDirection: 'row', gap: 8, marginBottom: 8 },
    segment: {
      flex: 1,
      alignItems: 'center',
      gap: 4,
      paddingVertical: 12,
      borderRadius: 16,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.outline,
    },
    segmentActive: { backgroundColor: colors.accentContainer, borderColor: colors.accentContainer },
    segmentLabel: { color: colors.text, fontSize: 16 },
    segmentLabelActive: { color: colors.onAccentContainer, fontWeight: '600' },
    rowLabel: { color: colors.text, fontSize: 18, flexShrink: 1 },
    rowAction: { color: colors.danger, fontSize: 16, fontWeight: '600' },
  });
