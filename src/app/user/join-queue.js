import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef } from 'react';
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
  const listRef = useRef(null);
  const { selectedServiceId: selectedServiceParam } = useLocalSearchParams();
  const { services } = useServices();
  const { activeQueue, joinQueue } = useQueue();
  const selectedServiceId = Array.isArray(selectedServiceParam)
    ? selectedServiceParam[0]
    : selectedServiceParam;
  const selectedServiceIndex = services.findIndex((item) => item.id === selectedServiceId);

  useEffect(() => {
    if (selectedServiceIndex < 0) return undefined;

    const frame = requestAnimationFrame(() => {
      listRef.current?.scrollToIndex({
        index: selectedServiceIndex,
        animated: true,
        viewPosition: 0.16,
      });
    });

    return () => cancelAnimationFrame(frame);
  }, [selectedServiceIndex]);

  function handleJoin(service) {
    joinQueue(service.id);
    router.push('/user/queue-status');
  }

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Join Queue' }} />

      <FlatList
        ref={listRef}
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        onScrollToIndexFailed={({ index, averageItemLength }) => {
          listRef.current?.scrollToOffset({
            offset: averageItemLength * index,
            animated: false,
          });
          requestAnimationFrame(() => {
            listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.16 });
          });
        }}
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
        renderItem={({ item }) => {
          const isSelected = item.id === selectedServiceId;

          return (
            <View style={[styles.card, isSelected && styles.selectedCard]}>
              <View style={styles.cardMain}>
                {isSelected ? <Text style={styles.selectedLabel}>SELECTED SERVICE</Text> : null}
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
          );
        }}
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

  selectedCard: {
    backgroundColor: colors.accentSoft,
    borderColor: colors.accentText,
    borderWidth: 2,
    borderLeftWidth: 6,
  },

  selectedLabel: {
    ...type.label,
    color: colors.accentText,
    fontSize: 10,
    marginBottom: spacing.xs,
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