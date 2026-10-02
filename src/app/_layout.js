import React from 'react';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import { getFocusedRouteNameFromRoute } from 'expo-router/react-navigation';
import { StatusBar } from 'expo-status-bar';
import { ServicesProvider } from '../data/ServicesStore';
import { ToastProvider } from '../components/Toast';
import { colors, headerOptions } from '../theme';

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
          </Stack>
        </ToastProvider>
      </ServicesProvider>
    </ThemeProvider>
  );
}
