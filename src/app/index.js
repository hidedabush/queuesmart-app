import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import Button from '../components/Button';
import { colors, spacing, type } from '../theme';

/**
 * TEMPORARY entry screen.
 *
 * This exists only so the app is runnable while the team builds in parallel.
 * Once the Login screen is merged it becomes the entry point and this file
 * should be deleted. Teammates: do not build on top of this screen.
 */
export default function Landing() {
  const router = useRouter();

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'QueueSmart', headerShown: false }} />
      <Text style={type.label}>Dev entry point</Text>
      <Text style={styles.brand}>
        Queue<Text style={{ color: colors.accentText }}>Smart</Text>
      </Text>
      <Text style={[type.secondary, { marginTop: spacing.sm }]}>
        Pick an area to work on.
      </Text>

      <View style={styles.actions}>
        <Button
          label="Administrator area →"
          onPress={() => router.push('/admin/dashboard')}
        />
        <Button
          label="User area (not built yet)"
          variant="secondary"
          disabled
          style={{ marginTop: spacing.md }}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  brand: { ...type.display, fontSize: 48, marginTop: spacing.sm },
  actions: { marginTop: spacing.xxl },
});
