import React, { useMemo } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useServices, formatWait } from '../../data/ServicesStore';
import { PriorityPill } from '../../components/Pill';
import Button from '../../components/Button';
import { colors, radius, spacing, type } from '../../theme';

/**
 * Admin Dashboard (A2 requirement 3.1)
 *
 * What an administrator needs on opening the app, in order:
 *   1. How many people are waiting right now, across everything.
 *   2. Which queue is the problem.
 *   3. One tap to close a queue that is out of control.
 *
 * The layout follows that order. The total waiting count is the one loud
 * element on the screen; everything else stays quiet so it reads at a glance
 * from across a service counter.
 */
export default function AdminDashboard() {
  const router = useRouter();
  const { services, setQueueOpen } = useServices();

  const summary = useMemo(() => {
    const open = services.filter((s) => s.isOpen);
    const waiting = open.reduce((total, s) => total + s.waiting, 0);
    const longest = open.reduce(
      (worst, s) => (!worst || s.waiting > worst.waiting ? s : worst),
      null
    );
    return { waiting, openCount: open.length, total: services.length, longest };
  }, [services]);

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Dashboard' }} />

      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <Header summary={summary} onManage={() => router.push('/admin/services')} />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <ServiceRow
            service={item}
            onOpenQueue={() => router.push(`/admin/queue/${item.id}`)}
            onToggle={(value) => setQueueOpen(item.id, value)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={type.heading}>No services yet</Text>
            <Text style={styles.emptyBody}>
              Create a service and it will appear here with its live queue.
            </Text>
            <Button
              label="Create a service"
              onPress={() => router.push('/admin/services/new')}
              style={{ marginTop: spacing.lg }}
            />
          </View>
        }
      />
    </View>
  );
}

function Header({ summary, onManage }) {
  return (
    <View>
      <View style={styles.summary}>
        <Text style={styles.summaryLabel}>Waiting right now</Text>
        <Text style={styles.summaryNumber}>{summary.waiting}</Text>
        <Text style={styles.summaryDetail}>
          across {summary.openCount} open{' '}
          {summary.openCount === 1 ? 'queue' : 'queues'}
          {summary.longest
            ? ` · longest is ${summary.longest.name}`
            : ''}
        </Text>
      </View>

      <View style={styles.sectionHeader}>
        <Text style={type.heading}>Services</Text>
        <Pressable onPress={onManage} accessibilityRole="button">
          <Text style={styles.link}>Manage</Text>
        </Pressable>
      </View>
    </View>
  );
}

function ServiceRow({ service, onOpenQueue, onToggle }) {
  return (
    <Pressable
      onPress={onOpenQueue}
      accessibilityRole="button"
      accessibilityLabel={`Open queue for ${service.name}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
    >
      <View style={styles.rowMain}>
        <Text style={type.body} numberOfLines={1}>
          {service.name}
        </Text>
        <Text style={styles.rowMeta}>
          {service.isOpen
            ? `${service.waiting} waiting · about ${formatWait(service)}`
            : 'Queue closed'}
        </Text>
        <View style={styles.rowPills}>
          <PriorityPill priority={service.priority} />
        </View>
      </View>

      <View style={styles.rowRight}>
        <Text
          style={[
            styles.count,
            !service.isOpen && { color: colors.line },
          ]}
        >
          {service.isOpen ? service.waiting : '—'}
        </Text>
        <Switch
          value={service.isOpen}
          onValueChange={onToggle}
          trackColor={{ true: colors.green, false: colors.line }}
          accessibilityLabel={`${service.isOpen ? 'Close' : 'Open'} the ${service.name} queue`}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  summary: {
    backgroundColor: colors.indigo,
    borderRadius: radius.md,
    padding: spacing.xl,
  },
  summaryLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.indigoSoft,
  },
  summaryNumber: {
    fontSize: 56,
    fontWeight: '700',
    color: colors.surface,
    letterSpacing: -2,
    marginVertical: spacing.xs,
  },
  summaryDetail: { fontSize: 13, color: colors.indigoSoft },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xl,
    marginBottom: spacing.md,
  },
  link: { fontSize: 15, fontWeight: '600', color: colors.indigo },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
  },
  rowPressed: { backgroundColor: colors.indigoSoft },
  rowMain: { flex: 1, paddingRight: spacing.md },
  rowMeta: { ...type.secondary, marginTop: 2 },
  rowPills: { flexDirection: 'row', marginTop: spacing.sm },
  rowRight: { alignItems: 'center' },
  count: {
    fontSize: 28,
    fontWeight: '700',
    color: colors.ink,
    marginBottom: spacing.sm,
  },
  separator: { height: 1, backgroundColor: colors.line },

  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'flex-start',
  },
  emptyBody: { ...type.secondary, marginTop: spacing.xs },
});
