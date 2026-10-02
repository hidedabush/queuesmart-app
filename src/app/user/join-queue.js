import { Stack, useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import { formatWait } from '../../api/services';

import {
    useQueue,
    useServices,
} from '../../frontend/state/ServicesStore';

import {
    OpenPill,
    PriorityPill,
} from '../../frontend/components/Pill';

import Button from '../../frontend/components/Button';

import {
    colors,
    spacing,
    type,
} from '../../frontend/theme';

export default function JoinQueue() {
  const router = useRouter();
  const { services } = useServices();
  const { activeQueue, joinQueue } = useQueue();

  function handleJoin(service) {
    joinQueue(service.id);
    router.push('/user/queue-status');
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Join Queue' }} />

      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={type.title}>
              Join a Queue
            </Text>

            <Text style={styles.subtitle}>
              Choose a service to join.
            </Text>

            {activeQueue ? (
              <Button
                label="View my queue status"
                variant="secondary"
                onPress={() => router.push('/user/queue-status')}
                style={{ marginTop: spacing.lg }}
              />
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.cardMain}>
              <Text style={type.heading}>
                {item.name}
              </Text>

              <Text style={styles.description}>
                {item.description}
              </Text>

              <Text style={styles.wait}>
                {item.isOpen
                  ? `${item.waiting} waiting · about ${formatWait(item)}`
                  : 'Queue closed'}
              </Text>

              <View style={styles.pills}>
                <PriorityPill priority={item.priority} />
                <OpenPill isOpen={item.isOpen} />
              </View>

              <Button
                label={
                  activeQueue?.serviceId === item.id
                    ? 'You are in this queue'
                    : item.isOpen
                      ? 'Join Queue'
                      : 'Queue Closed'
                }
                disabled={!item.isOpen || activeQueue?.serviceId === item.id}
                onPress={() => handleJoin(item)}
                style={{ marginTop: spacing.lg }}
              />
            </View>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No services are available right now.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },

  content: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },

  header: {
    marginBottom: spacing.xl,
  },

  subtitle: {
    ...type.secondary,
    marginTop: spacing.xs,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: 10,
    padding: spacing.lg,
  },

  cardMain: {
    flex: 1,
  },

  description: {
    ...type.secondary,
    marginTop: spacing.xs,
  },

  wait: {
    ...type.secondary,
    marginTop: spacing.sm,
  },

  pills: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },

  separator: {
    height: spacing.md,
  },

  empty: {
    ...type.secondary,
  },
});