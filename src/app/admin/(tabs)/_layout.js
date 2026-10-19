import React from 'react';
import { Pressable, Text } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { useServices } from '../../../frontend/state/ServicesStore';
import { useLayout } from '../../../frontend/hooks/useLayout';
import { DashboardIcon, ServicesIcon } from '../../../frontend/components/TabIcons';
import { colors, fonts, headerOptions, layout } from '../../../frontend/theme';

/**
 * The two top-level admin destinations. Bottom tab bar on phones, where it
 * sits under the thumb; a left sidebar on wide screens, where a bottom bar
 * would stretch across the whole display.
 */
// Ends the staff session and goes back to the staff sign-in screen.
function SignOutButton() {
  const router = useRouter();
  const { logout } = useServices();
  return (
    <Pressable
      onPress={() => {
        logout();
        router.replace('/admin-login');
      }}
      accessibilityRole="button"
      accessibilityLabel="Sign out of the front desk"
      style={({ pressed }) => ({ paddingHorizontal: 16, paddingVertical: 8, opacity: pressed ? 0.6 : 1 })}
    >
      <Text style={{ color: colors.muted, fontFamily: fonts.mono, fontSize: 12, fontWeight: '700', letterSpacing: 1 }}>
        SIGN OUT
      </Text>
    </Pressable>
  );
}

export default function AdminTabs() {
  const { isWide } = useLayout();

  return (
    <Tabs
      screenOptions={{
        ...headerOptions,
        headerRight: () => <SignOutButton />,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarPosition: isWide ? 'left' : 'bottom',
        tabBarLabelPosition: isWide ? 'beside-icon' : 'below-icon',
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarActiveBackgroundColor: isWide ? colors.raised : undefined,
        tabBarStyle: [
          { backgroundColor: colors.bg, borderTopColor: colors.line, borderRightColor: colors.line },
          // The default sidebar scales with the window and eats the content area.
          isWide && { minWidth: 0, width: layout.sidebar },
        ],
        tabBarLabelStyle: {
          fontFamily: fonts.mono,
          fontSize: isWide ? 13 : 11,
          fontWeight: '700',
          letterSpacing: 1,
          textTransform: 'uppercase',
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: 'Front desk',
          tabBarIcon: ({ color }) => <DashboardIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Visit types',
          tabBarIcon: ({ color }) => <ServicesIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
