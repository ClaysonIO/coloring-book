import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { confirm } from '../components/confirm';
import { useUsers } from '../state/UsersContext';
import * as storage from '../state/storage';
import { ALL_ORIENTATIONS, avatarColors, colors } from '../theme';

export default function ProfilesScreen() {
  const { users, selectUser, addUser, deleteUser, bumpRevision } = useUsers();
  const insets = useSafeAreaInsets();
  const [adding, setAdding] = useState(false);

  const open = (id: string) => {
    selectUser(id);
    router.push('/books');
  };

  const manage = (id: string, name: string) => {
    Alert.alert(name, undefined, [
      {
        text: 'Reset all coloring',
        style: 'destructive',
        onPress: () =>
          confirm(`Erase all of ${name}'s coloring?`, () => {
            storage.resetUser(id);
            bumpRevision();
          }),
      },
      { text: 'Delete user', style: 'destructive', onPress: () => confirm(`Delete ${name}?`, () => deleteUser(id)) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 32 }]}>
      <Text style={styles.heading}>Who's coloring?</Text>
      <ScrollView contentContainerStyle={styles.list}>
        {users.map((u) => (
          <Pressable
            key={u.id}
            style={styles.profile}
            onPress={() => open(u.id)}
            onLongPress={() => manage(u.id, u.name)}
            accessibilityLabel={u.name}
            accessibilityHint="Long press for options"
          >
            <View style={[styles.avatar, { backgroundColor: u.color }]}>
              <Text style={styles.initial}>{u.name.slice(0, 1).toUpperCase()}</Text>
            </View>
            <Text style={styles.name} numberOfLines={1}>
              {u.name}
            </Text>
          </Pressable>
        ))}
        <Pressable style={styles.profile} onPress={() => setAdding(true)} accessibilityLabel="Add user">
          <View style={[styles.avatar, styles.addAvatar]}>
            <MaterialCommunityIcons name="plus" size={48} color={colors.text} />
          </View>
          <Text style={styles.name}>Add</Text>
        </Pressable>
      </ScrollView>
      {users.length > 0 && <Text style={styles.hint}>Long press a name to reset or delete it.</Text>}

      <AddUserModal
        visible={adding || users.length === 0}
        canCancel={users.length > 0}
        onCancel={() => setAdding(false)}
        onSave={(name, color) => {
          const user = addUser(name, color);
          setAdding(false);
          open(user.id);
        }}
      />
    </View>
  );
}

function AddUserModal({
  visible,
  canCancel,
  onCancel,
  onSave,
}: {
  visible: boolean;
  canCancel: boolean;
  onCancel: () => void;
  onSave: (name: string, color: string) => void;
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(avatarColors[0]);
  const save = () => {
    if (!name.trim()) return;
    onSave(name, color);
    setName('');
  };
  return (
    <Modal
      supportedOrientations={ALL_ORIENTATIONS}
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={canCancel ? onCancel : undefined}
    >
      <View style={styles.modalBackdrop}>
        <View style={styles.dialog}>
          <Text style={styles.dialogTitle}>{canCancel ? 'New user' : 'Welcome! What is your name?'}</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Name"
            placeholderTextColor={colors.textMuted}
            style={styles.input}
            autoFocus
            maxLength={20}
            returnKeyType="done"
            onSubmitEditing={save}
          />
          <View style={styles.swatches}>
            {avatarColors.map((c) => (
              <Pressable
                key={c}
                onPress={() => setColor(c)}
                style={[styles.swatch, { backgroundColor: c }, c === color && styles.swatchActive]}
                accessibilityLabel={`Avatar color ${c}`}
              />
            ))}
          </View>
          <View style={styles.actions}>
            {canCancel && (
              <Pressable onPress={onCancel} hitSlop={8}>
                <Text style={styles.cancel}>Cancel</Text>
              </Pressable>
            )}
            <Pressable onPress={save} hitSlop={8} disabled={!name.trim()}>
              <Text style={[styles.ok, !name.trim() && { opacity: 0.4 }]}>Start coloring</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  heading: { color: colors.text, fontSize: 32, fontWeight: '700', textAlign: 'center', marginBottom: 24 },
  list: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 24, paddingHorizontal: 16 },
  profile: { width: 120, alignItems: 'center' },
  avatar: { width: 110, height: 110, borderRadius: 55, alignItems: 'center', justifyContent: 'center' },
  addAvatar: { backgroundColor: colors.surfaceHigh },
  initial: { fontSize: 48, fontWeight: '700', color: '#1B1B1B' },
  name: { color: colors.text, fontSize: 18, marginTop: 8 },
  hint: { color: colors.textMuted, textAlign: 'center', marginBottom: 32 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 24 },
  dialog: { backgroundColor: colors.surface, borderRadius: 28, padding: 24, maxWidth: 480, width: '100%', alignSelf: 'center' },
  dialogTitle: { color: colors.text, fontSize: 22, fontWeight: '600', marginBottom: 16 },
  input: {
    color: colors.text,
    fontSize: 20,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  swatches: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 20 },
  swatch: { width: 40, height: 40, borderRadius: 20 },
  swatchActive: { borderWidth: 3, borderColor: colors.text },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 28, marginTop: 28 },
  cancel: { color: colors.textMuted, fontSize: 17 },
  ok: { color: colors.accent, fontSize: 17, fontWeight: '600' },
});
