import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { LibraryProvider } from '../state/LibraryContext';
import { ThemeProvider, useTheme } from '../state/ThemeContext';
import { UsersProvider } from '../state/UsersContext';

export default function RootLayout() {
  return (
    <ThemeProvider>
      <ThemedRoot />
    </ThemeProvider>
  );
}

function ThemedRoot() {
  const { colors, scheme } = useTheme();
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.background }}>
      <SafeAreaProvider>
        <UsersProvider>
          <LibraryProvider>
            <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
              {/* No swipe-back while coloring: strokes near the left edge would leave the page. */}
              <Stack.Screen name="color/[bookId]/[pageId]" options={{ gestureEnabled: false }} />
            </Stack>
          </LibraryProvider>
        </UsersProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
