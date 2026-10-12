import { MaterialCommunityIcons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { Image } from 'expo-image';
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BusyOverlay } from '../components/BusyOverlay';
import { Header } from '../components/Header';
import { usePinGate } from '../components/PinPrompt';
import { packUrl, type CatalogBook, type CatalogPack } from '../content/catalog';
import { useLibrary } from '../state/LibraryContext';
import { useUsers } from '../state/UsersContext';
import { useTheme, useThemedStyles } from '../state/ThemeContext';
import type { Colors } from '../theme';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const megabytes = (bytes: number) => `${Math.max(1, Math.round(bytes / 1e6))} MB`;

/**
 * "More books": packs from the website, and importing a zip of your own. Everything on the
 * website's books page is listed here, so the app needs no link out (kids' store categories
 * would want a parental gate in front of one).
 */
export default function GetBooksScreen() {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const { currentUser } = useUsers();
  const { catalog, catalogState, refreshCatalog, markPacksSeen, installPack, importZip, installedPacks, removePack, updatingPacks } =
    useLibrary();
  const insets = useSafeAreaInsets();
  const [busy, setBusy] = useState<string | null>(null);
  const { gate, pinPrompt } = usePinGate();

  useEffect(() => {
    refreshCatalog();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // Whatever is listed here has been seen, so the "More books" badge clears.
  useEffect(markPacksSeen, [markPacksSeen]);

  if (!currentUser) return <Redirect href="/" />;

  const reportSkipped = (failed: number) => {
    if (failed) Alert.alert(`${plural(failed, 'picture')} couldn't be read`, 'They were skipped.');
  };

  const download = async (pack: CatalogPack, restoreRemoved = false) => {
    setBusy('Downloading…');
    try {
      reportSkipped(await installPack(pack, setBusy, restoreRemoved));
    } catch {
      Alert.alert(`Couldn't download ${pack.title}`, 'Check the internet connection and try again.');
    } finally {
      setBusy(null);
    }
  };

  const remove = (packId: string, title: string) =>
    gate(currentUser, `Enter ${currentUser.name}'s PIN to remove ${title}`, () =>
      Alert.alert(`Remove ${title}?`, "All of its books and everyone's coloring in them will be deleted.", [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => removePack(packId) },
      ]),
    );

  const pickZip = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      // Some Android file managers label zips as generic binary files.
      type: ['application/zip', 'application/x-zip-compressed', 'application/octet-stream'],
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const { uri, name } = result.assets[0];
    setBusy('Opening…');
    try {
      const added = await importZip(uri, name, setBusy);
      setBusy(null);
      Alert.alert(`Added ${added.title}`, `${plural(added.books, 'book')} added to your library.`);
      reportSkipped(added.failed);
    } catch (e) {
      setBusy(null);
      Alert.alert("Couldn't add that zip file", e instanceof Error ? e.message : undefined);
    } finally {
      try {
        const copy = new File(uri);
        if (copy.exists) copy.delete();
      } catch {
        // Only the picker's cache copy; leaving it is harmless.
      }
    }
  };

  const packs = catalog?.packs ?? [];
  return (
    <View style={styles.screen}>
      <Header title="More Books" subtitle="Free coloring books to download" onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
        refreshControl={
          <RefreshControl
            refreshing={catalogState === 'loading' && packs.length > 0}
            onRefresh={refreshCatalog}
            tintColor={colors.accent}
            colors={[colors.accent]}
          />
        }
      >
        {catalogState === 'offline' && (
          <View style={styles.notice}>
            <MaterialCommunityIcons name="wifi-off" size={22} color={colors.textMuted} />
            <Text style={styles.noticeText}>
              {packs.length ? "Can't reach the website, so this list may be out of date." : 'Connect to the internet to see the books you can download.'}
            </Text>
            <Pressable onPress={refreshCatalog} hitSlop={8}>
              <Text style={styles.link}>Try again</Text>
            </Pressable>
          </View>
        )}
        {catalogState === 'loading' && packs.length === 0 && <ActivityIndicator color={colors.accent} size="large" style={{ marginVertical: 32 }} />}

        {packs.map((pack) => {
          const installed = installedPacks.find((p) => p.id === pack.id);
          return (
            <PackCard
              key={pack.id}
              pack={pack}
              state={
                updatingPacks.includes(pack.id)
                  ? 'updating'
                  : !installed
                    ? 'available'
                    : installed.version && installed.version !== pack.version
                      ? 'outdated'
                      : 'installed'
              }
              removedBooks={installed?.removed.length ?? 0}
              onDownload={() => download(pack)}
              onRestore={() => download(pack, true)}
              onRemove={() => remove(pack.id, pack.title)}
            />
          );
        })}

        <Text style={styles.section}>Your own books</Text>
        <View style={styles.card}>
          <View style={styles.row}>
            <MaterialCommunityIcons name="folder-zip-outline" size={40} color={colors.accent} />
            <View style={{ flex: 1 }}>
              <Text style={styles.cardTitle}>Add a zip file</Text>
              <Text style={styles.body}>
                Pick a zip of pictures from your files. Each folder in it becomes a book. Zips downloaded from the
                website work too.
              </Text>
            </View>
          </View>
          <Button icon="folder-open" label="Choose a zip file" onPress={pickZip} />
        </View>
        {installedPacks
          .filter((p) => !packs.some((c) => c.id === p.id))
          .map((p) => (
            <View key={p.id} style={[styles.card, styles.row]}>
              <View style={{ flex: 1 }}>
                <Text style={styles.cardTitle}>{p.title}</Text>
                <Text style={styles.body}>From a zip file · {plural(p.books.length, 'book')}</Text>
              </View>
              <Pressable onPress={() => remove(p.id, p.title)} hitSlop={8}>
                <Text style={styles.danger}>Remove</Text>
              </Pressable>
            </View>
          ))}
      </ScrollView>
      <BusyOverlay message={busy} />
      {pinPrompt}
    </View>
  );
}

type PackState = 'available' | 'installed' | 'outdated' | 'updating';

function PackCard({
  pack,
  state,
  removedBooks,
  onDownload,
  onRestore,
  onRemove,
}: {
  pack: CatalogPack;
  state: PackState;
  removedBooks: number;
  onDownload: () => void;
  onRestore: () => void;
  onRemove: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  const [open, setOpen] = useState<CatalogBook | null>(null);
  const pages = pack.books.reduce((n, b) => n + b.pages.length, 0);
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{pack.title}</Text>
      {pack.description ? <Text style={styles.body}>{pack.description}</Text> : null}
      <Text style={styles.meta}>
        {plural(pack.books.length, 'book')} · {plural(pages, 'page')} · {megabytes(pack.size)}
      </Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
        {pack.books.map((book) => (
          <Pressable
            key={book.id}
            onPress={() => setOpen(open?.id === book.id ? null : book)}
            style={[styles.book, open?.id === book.id && styles.bookOpen]}
            accessibilityLabel={`${book.title}, ${plural(book.pages.length, 'page')}`}
            accessibilityHint="Shows its pages"
          >
            <Image source={{ uri: packUrl(book.cover) }} style={styles.cover} contentFit="cover" transition={100} />
            <Text style={styles.bookTitle} numberOfLines={2}>
              {book.title}
            </Text>
            <Text style={styles.bookMeta}>{plural(book.pages.length, 'page')}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {open && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
          {open.pages.map((page) => (
            <View key={page.id} style={styles.page}>
              <Image source={{ uri: packUrl(page.thumb) }} style={styles.pageImage} contentFit="contain" transition={100} />
              <Text style={styles.pageTitle} numberOfLines={1}>
                {page.title}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <View style={styles.actions}>
        {state === 'available' && <Button icon="cloud-download" label={`Download (${megabytes(pack.size)})`} onPress={onDownload} />}
        {state === 'outdated' && <Button icon="update" label="Update" onPress={onDownload} />}
        {state === 'updating' && <Button icon="update" label="Updating…" disabled onPress={onDownload} />}
        {state === 'installed' && (
          <View style={styles.installed}>
            <MaterialCommunityIcons name="check-circle" size={22} color={colors.accent} />
            <Text style={styles.installedText}>In your library</Text>
          </View>
        )}
        {state !== 'available' && (
          <Pressable onPress={onRemove} hitSlop={8}>
            <Text style={styles.danger}>Remove</Text>
          </Pressable>
        )}
      </View>
      {state === 'installed' && removedBooks > 0 && (
        <Pressable onPress={onRestore} hitSlop={8}>
          <Text style={styles.link}>Get the {plural(removedBooks, 'removed book')} back</Text>
        </Pressable>
      )}
    </View>
  );
}

function Button({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof MaterialCommunityIcons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.button, pressed && { opacity: 0.8 }, disabled && { opacity: 0.5 }]}
    >
      <MaterialCommunityIcons name={icon} size={22} color={colors.onAccentContainer} />
      <Text style={styles.buttonText}>{label}</Text>
    </Pressable>
  );
}

const createStyles = (colors: Colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: colors.background },
    content: { paddingHorizontal: 16, gap: 14 },
    section: { color: colors.accent, fontSize: 15, fontWeight: '600', marginTop: 8, marginLeft: 4 },
    card: { backgroundColor: colors.surface, borderRadius: 22, padding: 18, gap: 10 },
    row: { flexDirection: 'row', alignItems: 'center', gap: 14 },
    cardTitle: { color: colors.text, fontSize: 22, fontWeight: '700' },
    body: { color: colors.textMuted, fontSize: 16, lineHeight: 22 },
    meta: { color: colors.text, fontSize: 15 },
    strip: { gap: 12, paddingVertical: 4 },
    book: { width: 116, borderRadius: 14, padding: 4 },
    bookOpen: { backgroundColor: colors.surfaceHigh },
    cover: { width: 108, aspectRatio: 3 / 4, borderRadius: 10, backgroundColor: 'white' },
    bookTitle: { color: colors.text, fontSize: 15, fontWeight: '500', marginTop: 6 },
    bookMeta: { color: colors.textMuted, fontSize: 13 },
    page: { width: 96 },
    pageImage: { width: 96, height: 96, borderRadius: 8, backgroundColor: 'white' },
    pageTitle: { color: colors.textMuted, fontSize: 12, marginTop: 4 },
    actions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 },
    button: {
      flexDirection: 'row',
      alignItems: 'center',
      alignSelf: 'flex-start',
      gap: 8,
      backgroundColor: colors.accentContainer,
      borderRadius: 24,
      paddingHorizontal: 18,
      paddingVertical: 12,
    },
    buttonText: { color: colors.onAccentContainer, fontSize: 17, fontWeight: '600' },
    installed: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 12 },
    installedText: { color: colors.text, fontSize: 17 },
    danger: { color: colors.danger, fontSize: 16, fontWeight: '600' },
    link: { color: colors.accent, fontSize: 16, fontWeight: '600' },
    notice: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface, borderRadius: 16, padding: 14 },
    noticeText: { color: colors.textMuted, fontSize: 15, flex: 1 },
  });
