/**
 * Queue Management screen (A2 requirement 3.3)
 *
 * by kevin :3 (idk if u wanted me to keep the layout of the placeholder but i tried) 
 *
 * ui only, the queue lives in this screen's state, seeded from the service's
 * waiting count. implemented and modified the reorder, remove and "serve next" as a shared state along with its respective needed functions in ServicesStore.js, frontend/state
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import Button from '../../../frontend/components/Button';
import Pill from '../../../frontend/components/Pill';
import { ToastProvider, useToast } from '../../../frontend/components/Toast';
import { contentWidth, useLayout } from '../../../frontend/hooks/useLayout';
import { useServices } from '../../../frontend/state/ServicesStore';
import { colors, layout, radius, spacing, type } from '../../../frontend/theme';

//  this keeps the screen working
// whether or not the layout already provides one.
export default function QueueManagement() {
  return (
    <ToastProvider>
      <QueueScreen />
    </ToastProvider>
  );
}

function QueueScreen() {
  const { serviceId } = useLocalSearchParams();
  const { getService, getServiceQueue, updateServiceQueue } = useServices();
  const { gutter } = useLayout();
  const toast = useToast();
  const service = getService(serviceId);
  const queue = service ? getServiceQueue(serviceId) : [];

  const [serving, setServing] = useState(null);

  if (!service) {
    return (
      <View style={[styles.screen, contentWidth(layout.readable, gutter), styles.padded]}>
        <Text style={type.title}>Service not found</Text>
        <Text style={[type.secondary, { marginTop: spacing.xs }]}>
          Go back to the dashboard and pick a queue.
        </Text>
      </View>
    );
  }

  function serveNext() {
    if (queue.length === 0) return;
    const [served, ...nextQueue] = queue;
    setServing(served);
    updateServiceQueue(serviceId, nextQueue);
    toast(
      nextQueue.length > 0
        ? `Now serving ${served.name}. ${nextQueue[0].name} is almost ready.`
        : `Now serving ${served.name}. The queue is now empty.`
    );
  }

  function move(index, direction) {
    const target = index + direction;
    if (target < 0 || target >= queue.length) return;
    const next = [...queue];
    [next[index], next[target]] = [next[target], next[index]];
    updateServiceQueue(serviceId, next);
    toast(`${queue[index].name} moved to position ${target + 1}.`);
  }

  function remove(index) {
    toast(`${queue[index].name} was removed from the queue.`);
    updateServiceQueue(
      serviceId,
      queue.filter((_, i) => i !== index)
    );
  }

  return (
    <FlatList
      data={queue}
      keyExtractor={(item) => item.id}
      style={styles.screen}
      contentContainerStyle={[contentWidth(layout.readable, gutter), styles.padded]}
      ListHeaderComponent={
        <View>
          <Stack.Screen options={{ title: service.name }} />
          <Text style={type.label}>{service.name}</Text>
          <Text style={[type.display, { marginTop: spacing.xs }]}>{queue.length} waiting</Text>

          {serving ? (
            <View style={styles.serving} accessible accessibilityLabel={`Now serving ${serving.name}`}>
              <Text style={[type.label, { color: colors.accentText }]}>Now serving</Text>
              <Text style={styles.servingName}>{serving.name}</Text>
            </View>
          ) : null}

          <Button
            label="Serve next"
            onPress={serveNext}
            disabled={queue.length === 0}
            accessibilityHint="Calls the first person in the queue"
            style={{ marginTop: spacing.lg, marginBottom: spacing.xl }}
          />

          <View style={styles.listHeader}>
            <Text style={type.label} role="heading" aria-level={2}>
              Queue · {String(queue.length).padStart(2, '0')}
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={type.label}>Queue empty</Text>
          <Text style={[type.title, { marginTop: spacing.sm }]}>Nobody is waiting</Text>
          <Text style={[type.secondary, { marginTop: spacing.xs }]}>
            People who join {service.name} will appear here.
          </Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <Entry
          user={item}
          position={index + 1}
          isFirst={index === 0}
          isLast={index === queue.length - 1}
          onUp={() => move(index, -1)}
          onDown={() => move(index, 1)}
          onRemove={() => remove(index)}
        />
      )}
    />
  );
}

function Entry({ user, position, isFirst, isLast, onUp, onDown, onRemove }) {
  // Status follows position, so it can never go stale after a reorder.
  const almostReady = position === 1;

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.position}>{String(position).padStart(2, '0')}</Text>
        <Text style={styles.name} numberOfLines={1}>
          {user.name}
        </Text>
        {almostReady ? (
          <Pill label="Almost ready" fg={colors.accentText} border={colors.accent} bg={colors.accentSoft} />
        ) : (
          <Pill label="Waiting" />
        )}
      </View>

      <View style={styles.actions}>
        <Button
          label="Up"
          variant="secondary"
          size="sm"
          disabled={isFirst}
          onPress={onUp}
          accessibilityHint={`Moves ${user.name} up one place`}
        />
        <Button
          label="Down"
          variant="secondary"
          size="sm"
          disabled={isLast}
          onPress={onDown}
          accessibilityHint={`Moves ${user.name} down one place`}
        />
        <Button
          label="Remove"
          variant="danger"
          size="sm"
          onPress={onRemove}
          accessibilityHint={`Removes ${user.name} from the queue`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },

  serving: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderLeftWidth: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
  },
  servingName: { ...type.body, fontWeight: '700', marginTop: 2 },

  listHeader: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },

  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.md },
  position: { ...type.metric, fontSize: 28, minWidth: 40 },
  name: { ...type.body, fontWeight: '700', flex: 1 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
    marginTop: spacing.md,
  },

  empty: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderStyle: 'dashed',
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
});
