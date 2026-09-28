import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useServices } from '../../../data/ServicesStore';
import { colors, spacing, type } from '../../../theme';

/**
 * PLACEHOLDER — Queue Management screen.
 *
 * Owned by: ___________  (A2 requirement 3.3)
 *
 * This file exists so the Admin Dashboard has somewhere to navigate to while
 * the screen is still being built. Replace the body with the real screen:
 *   - list the queue entries for this service
 *   - reorder or remove an entry (UI only)
 *   - "Serve next" simulation
 *
 * The service is already available from useServices(); read queue entries the
 * same way once mock entries are added to src/data/ServicesStore.js.
 */
export default function QueueManagement() {
  const { serviceId } = useLocalSearchParams();
  const { getService } = useServices();
  const service = getService(serviceId);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: service ? service.name : 'Queue' }} />
      <Text style={type.heading}>Queue management is not built yet</Text>
      <Text style={styles.body}>
        {service
          ? `${service.waiting} people are waiting for ${service.name}.`
          : 'This service could not be found.'}
      </Text>
      <Text style={styles.note}>
        Placeholder screen. Replace app/admin/queue/[serviceId].js with the
        real Queue Management screen.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
    padding: spacing.xl,
    justifyContent: 'center',
  },
  body: { ...type.body, marginTop: spacing.sm },
  note: { ...type.secondary, marginTop: spacing.lg },
});
