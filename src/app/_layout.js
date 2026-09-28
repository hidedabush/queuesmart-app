import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ServicesProvider } from '../data/ServicesStore';
import { colors } from '../theme';

export default function RootLayout() {
  return (
    <ServicesProvider>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTitleStyle: { fontSize: 17, fontWeight: '600', color: colors.ink },
          headerTintColor: colors.indigo,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.paper },
        }}
      />
    </ServicesProvider>
  );
}
