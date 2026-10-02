import { Stack, useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import {
    getActiveQueue,
    leaveQueue,
} from '../../data/QueueStore';

import {
    useServices,
} from '../../data/ServicesStore';

import Button from '../../components/Button';

import {
    colors,
    radius,
    spacing,
    type,
} from '../../theme';

export default function QueueStatus() {
  const router = useRouter();
  const { services } = useServices();

  const activeQueue = getActiveQueue();

  const service = activeQueue
    ? services.find(
        (item) => item.id === activeQueue.serviceId
      )
    : null;

  function handleLeave() {
    leaveQueue();
    router.replace('/user/join-queue');
  }

  function getStatusLabel(status) {
    switch (status) {
      case 'almost-ready':
        return 'Almost ready';

      case 'served':
        return 'Served';

      default:
        return 'Waiting';
    }
  }

  function getStatusMessage(status) {
    switch (status) {
      case 'almost-ready':
        return 'You are almost up. Please be ready.';

      case 'served':
        return 'Your queue visit has been completed.';

      default:
        return 'You are currently waiting in line.';
    }
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Queue Status' }} />

      <View style={styles.content}>
        <Text style={type.title}>
          Your Queue Status
        </Text>

        {!activeQueue || !service ? (
          <Text style={styles.empty}>
            You are not currently in a queue.
          </Text>
        ) : (
          <View style={styles.card}>
            <Text style={type.heading}>
              {service.name}
            </Text>

            <Text style={styles.status}>
              {getStatusLabel(activeQueue.status)}
            </Text>

            <View style={styles.positionBox}>
              <Text style={styles.positionNumber}>
                #{activeQueue.position}
              </Text>

              <Text style={styles.positionLabel}>
                Your position
              </Text>
            </View>

            <Text style={styles.wait}>
              Estimated wait:{' '}
              {activeQueue.estimatedWait.low}–
              {activeQueue.estimatedWait.high} min
            </Text>

            <Text style={styles.description}>
              {getStatusMessage(activeQueue.status)}
            </Text>

            <Button
              label="Leave Queue"
              variant="danger"
              onPress={handleLeave}
              style={{ marginTop: spacing.xl }}
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.paper,
  },

  content: {
    padding: spacing.lg,
  },

  empty: {
    ...type.secondary,
    marginTop: spacing.md,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },

  status: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.green,
    marginTop: spacing.sm,
  },

  positionBox: {
    backgroundColor: colors.indigoSoft,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
  },

  positionNumber: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.indigo,
  },

  positionLabel: {
    ...type.secondary,
    marginTop: spacing.xs,
  },

  wait: {
    ...type.body,
    marginTop: spacing.xl,
  },

  description: {
    ...type.secondary,
    marginTop: spacing.sm,
  },
});