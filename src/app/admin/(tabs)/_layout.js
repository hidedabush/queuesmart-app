import React from 'react';
import { Tabs } from 'expo-router';
import { useLayout } from '../../../frontend/hooks/useLayout';
import { DashboardIcon, ServicesIcon } from '../../../frontend/components/TabIcons';
import { colors, fonts, headerOptions, layout } from '../../../frontend/theme';

/**
 * The two top-level admin destinations. Bottom tab bar on phones, where it
 * sits under the thumb; a left sidebar on wide screens, where a bottom bar
 * would stretch across the whole display.
 */
export default function AdminTabs() {
  const { isWide } = useLayout();

  return (
    <Tabs
      screenOptions={{
        ...headerOptions,
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
          title: 'Dashboard',
          tabBarIcon: ({ color }) => <DashboardIcon color={color} />,
        }}
      />
      <Tabs.Screen
        name="services"
        options={{
          title: 'Services',
          tabBarIcon: ({ color }) => <ServicesIcon color={color} />,
        }}
      />
    </Tabs>
  );
}
