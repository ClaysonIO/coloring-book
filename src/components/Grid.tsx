import { type ReactNode, useMemo } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props<T> = {
  items: T[];
  keyOf: (item: T) => string;
  renderItem: (item: T) => ReactNode;
  /** Extra tile after the items, e.g. an "add" tile. */
  trailing?: ReactNode;
};

type Cell<T> = { key: string; item: T } | { key: string; node: ReactNode };

/**
 * Two columns on phones, more on tablets. Virtualized, so only rows near the screen are mounted
 * and decoded: long books would otherwise keep every page image in memory at once.
 */
export function Grid<T>({ items, keyOf, renderItem, trailing }: Props<T>) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const columns = Math.max(2, Math.floor(width / 260));

  const rows = useMemo(() => {
    const cells: Cell<T>[] = items.map((item) => ({ key: keyOf(item), item }));
    if (trailing) cells.push({ key: '__trailing', node: trailing });
    const out: Cell<T>[][] = [];
    for (let i = 0; i < cells.length; i += columns) out.push(cells.slice(i, i + columns));
    return out;
  }, [items, keyOf, trailing, columns]);

  return (
    <FlatList
      data={rows}
      keyExtractor={(row) => row[0].key}
      contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]}
      extraData={renderItem}
      ItemSeparatorComponent={Separator}
      initialNumToRender={4}
      maxToRenderPerBatch={4}
      windowSize={7}
      renderItem={({ item: row }) => (
        <View style={styles.row}>
          {row.map((cell) => (
            <View key={cell.key} style={styles.cell}>
              {'node' in cell ? cell.node : renderItem(cell.item)}
            </View>
          ))}
          {Array.from({ length: columns - row.length }, (_, i) => (
            <View key={`pad${i}`} style={styles.cell} />
          ))}
        </View>
      )}
    />
  );
}

// Not `gap` on the content container: it would also space the list's virtualization spacers.
const Separator = () => <View style={styles.separator} />;

const styles = StyleSheet.create({
  content: { paddingHorizontal: 14 },
  separator: { height: 14 },
  row: { flexDirection: 'row', gap: 14 },
  cell: { flex: 1 },
});
