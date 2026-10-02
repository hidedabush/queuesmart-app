import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { ToastProvider } from '../frontend/components/Toast';
import { ServicesProvider } from '../frontend/state/ServicesStore';
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

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ThemeProvider value={navigationTheme}>
        <ServicesProvider>
          <ToastProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                ...headerOptions,
                headerBackButtonDisplayMode: 'minimal',
                contentStyle: { backgroundColor: colors.bg },
              }}
            >
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="admin-login" options={{ title: 'Admin Login', headerShown: false }} />
            {/* The tab navigator draws its own headers. The title follows the
                active tab so back buttons say where they lead. */}
            <Stack.Screen
              name="admin/(tabs)"
              options={({ route }) => ({
                headerShown: false,
                title: getFocusedRouteNameFromRoute(route) === 'services' ? 'Services' : 'Dashboard',
              })}
            />
            <Stack.Screen
              name="admin/services/[id]"
              options={({ route }) => ({
                title: route.params?.id === 'new' ? 'New service' : 'Edit service',
              })}
            />
            <Stack.Screen name="admin/queue/[serviceId]" options={{ title: 'Queue' }} />
            <Stack.Screen name="user/join-queue" options={{ title: 'Join Queue' }} />
            <Stack.Screen name="user/queue-status" options={{ title: 'Queue Status' }} />
            </Stack>
          </ToastProvider>
        </ServicesProvider>
      </ThemeProvider>
    </GestureHandlerRootView>
  );
}
