import { DarkTheme, Stack, ThemeProvider, useRouter } from 'expo-router';
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useRef } from 'react';
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

// Screens are split by who may open them. The server enforces the same
// rules; this keeps a signed-out visitor from landing on an empty screen.
function AppStack() {
  const router = useRouter();
  const { role } = useServices();
  const previousRole = useRef(role);

  // Signing out (or an expired session) sends the person back to sign-in.
  useEffect(() => {
    if (previousRole.current && !role) router.replace('/login');
    previousRole.current = role;
  }, [role, router]);

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

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <ServicesProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <AppStack />
          </ToastProvider>
        </ServicesProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}