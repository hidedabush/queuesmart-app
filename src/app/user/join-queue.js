import { Stack, useRouter } from 'expo-router';
import { FlatList, StyleSheet, Text, View } from 'react-native';

import {
    formatWait,
    useServices,
} from '../../data/ServicesStore';

import { joinQueue } from '../../data/QueueStore';

import {
    OpenPill,
    PriorityPill,
} from '../../components/Pill';

import Button from '../../components/Button';

import {
    colors,
    spacing,
    type,
} from '../../theme';

export default function JoinQueue() {
  const router = useRouter();
  const { services } = useServices();

  function handleJoin(service) {
    joinQueue(service);
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
                label={item.isOpen ? 'Join Queue' : 'Queue Closed'}
                disabled={!item.isOpen}
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
    backgroundColor: colors.paper,
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