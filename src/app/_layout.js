import { DarkTheme, Stack, ThemeProvider, useRootNavigationState, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ToastProvider } from '../frontend/components/Toast';
import { ServicesProvider, useServices } from '../frontend/state/ServicesStore';
import { colors, headerOptions } from '../frontend/theme';

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

// Patient and staff screens need a signed-in account (the server would
// refuse their requests anyway). Anyone signed out, including after their
// session expires, goes back to the matching sign-in screen.
function AuthGate() {
  const { user } = useServices();
  const segments = useSegments();
  const router = useRouter();
  const navigationReady = Boolean(useRootNavigationState()?.key);

  useEffect(() => {
    if (!navigationReady) return;
    const area = segments[0];
    if (!user && area === 'user') router.replace('/login');
    if (area === 'admin' && user?.role !== 'admin') router.replace('/admin-login');
  }, [navigationReady, router, segments, user]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <ServicesProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <AuthGate />
            <Stack
              screenOptions={{
                ...headerOptions,
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="admin-login" options={{ title: 'Staff Login', headerShown: false }} />
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
            <Stack.Screen name="user/join-queue" options={{ title: 'Check in' }} />
            <Stack.Screen name="user/queue-status" options={{ title: 'My check-in' }} />
            </Stack>
          </ToastProvider>
        </ServicesProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
