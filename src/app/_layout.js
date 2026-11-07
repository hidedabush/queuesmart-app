import { DarkTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Button from '../frontend/components/Button';
import NotificationWatcher from '../frontend/components/NotificationWatcher';
import { ToastProvider } from '../frontend/components/Toast';
import { ServicesProvider, useServices } from '../frontend/state/ServicesStore';
import { colors, headerOptions, spacing, type } from '../frontend/theme';

// Navigation chrome (headers, tab bar, borders) picks these up by default.
const navigationTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.accentText,
    background: colors.bg,
    card: colors.bg,
    text: colors.text,
    border: colors.line,
    notification: colors.accent,
  },
};

// Screens are split by who may open them. The server enforces the same
// rules; this keeps a signed-out visitor from landing on an empty screen.
function AppStack() {
  const router = useRouter();
  const { role, authReady, authRestoreError, restoreSession, logout } = useServices();
  const previousRole = useRef(role);

  // Signing out (or an expired session) sends the person back to sign-in.
  useEffect(() => {
    if (previousRole.current && !role) router.replace('/login');
    previousRole.current = role;
  }, [role, router]);

  if (!authReady) {
    return (
      <View style={styles.sessionGate}>
        <ActivityIndicator color={colors.accentText} />
        <Text style={styles.sessionMessage}>Restoring your session…</Text>
      </View>
    );
  }

  if (authRestoreError) {
    return (
      <View style={styles.sessionGate}>
        <Text style={type.title}>Can’t restore your session</Text>
        <Text style={styles.sessionMessage}>{authRestoreError}</Text>
        <Button label="Try again" onPress={restoreSession} />
        <Button
          label="Sign in instead"
          variant="secondary"
          onPress={() => {
            logout();
            router.replace('/login');
          }}
        />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        ...headerOptions,
        headerBackButtonDisplayMode: 'minimal',
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="admin-login" options={{ title: 'Staff Login', headerShown: false }} />

      <Stack.Protected guard={role === 'admin'}>
        {/* The tab navigator draws its own headers. The title follows the
            active tab so back buttons say where they lead. */}
        <Stack.Screen
          name="admin/(tabs)"
          options={({ route }) => ({
            headerShown: false,
            title: getFocusedRouteNameFromRoute(route) === 'services' ? 'Visit types' : 'Front desk',
          })}
        />
        <Stack.Screen
          name="admin/services/[id]"
          options={({ route }) => ({
            title: route.params?.id === 'new' ? 'New visit type' : 'Edit visit type',
          })}
        />
        <Stack.Screen name="admin/queue/[serviceId]" options={{ title: 'Waiting line' }} />
      </Stack.Protected>

      <Stack.Protected guard={role === 'user'}>
        <Stack.Screen name="user/dashboard" options={{ headerShown: false }} />
        <Stack.Screen name="user/history" options={{ headerShown: false }} />
        <Stack.Screen name="user/profile" options={{ headerShown: false }} />
        <Stack.Screen name="user/join-queue" options={{ title: 'Check in' }} />
        <Stack.Screen name="user/queue-status" options={{ title: 'My check-in' }} />
      </Stack.Protected>
    </Stack>
  );
}

const styles = StyleSheet.create({
  sessionGate: {
    flex: 1,
    justifyContent: 'center',
    gap: spacing.lg,
    padding: spacing.xl,
    backgroundColor: colors.bg,
  },
  sessionMessage: {
    ...type.secondary,
    textAlign: 'center',
  },
});

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <ServicesProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <NotificationWatcher />
            <AppStack />
          </ToastProvider>
        </ServicesProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}