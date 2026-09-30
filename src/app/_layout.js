import React from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ServicesProvider } from '../data/ServicesStore';
import { colors, fonts } from '../theme';

export default function RootLayout() {
  return (
    <ServicesProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTitleStyle: {
            fontFamily: fonts.mono,
            fontSize: 14,
            fontWeight: '700',
            color: colors.text,
          },
          headerTintColor: colors.accentText,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      />
    </ServicesProvider>
  );
}
