import React, { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useServices, formatWait } from '../../data/ServicesStore';
import { PriorityMeter } from '../../components/Pill';
import Button from '../../components/Button';
import { colors, fonts, radius, spacing, type } from '../../theme';

/**
 * Admin Dashboard (A2 requirement 3.1)
 *
 * Styled like a departure board. What an administrator needs on opening
 * the app, in order:
 *   1. How many people are waiting right now, across everything.
 *   2. Which queue is the problem.
 *   3. One tap to close a queue that is out of control.
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
    return { open, waiting, openCount: open.length, total: services.length, longest };
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
        renderItem={({ item, index }) => (
          <ServiceRow
            service={item}
            index={index}
            isBusiest={summary.longest?.id === item.id && item.waiting > 0}
            onOpenQueue={() => router.push(`/admin/queue/${item.id}`)}
            onToggle={(value) => setQueueOpen(item.id, value)}
          />
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={type.label}>Board empty</Text>
            <Text style={[type.title, { marginTop: spacing.sm }]}>No services yet</Text>
            <Text style={[type.secondary, { marginTop: spacing.xs }]}>
              Create a service and it will appear here with its live queue.
            </Text>
            <Button
              label="+ Create a service"
              onPress={() => router.push('/admin/services/new')}
              style={{ marginTop: spacing.lg, alignSelf: 'stretch' }}
            />
          </View>
        }
      />
    </View>
  );
}

function LiveDot() {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    let loop;
    let cancelled = false;
    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce || cancelled) return;
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, { toValue: 0.25, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
          Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: Platform.OS !== 'web' }),
        ])
      );
      loop.start();
    });
    return () => {
      cancelled = true;
      loop?.stop();
    };
  }, [opacity]);

  return <Animated.View style={[styles.liveDot, { opacity }]} />;
}

function Header({ summary, onManage }) {
  const { waiting, openCount, total, longest, open } = summary;

  return (
    <View>
      <View style={styles.statusRow}>
        <LiveDot />
        <Text style={[type.label, { color: colors.text }]}>Live</Text>
        <Text style={type.label}>
          {'  ·  '}
          {openCount}/{total} queues open
        </Text>
      </View>

      <View
        style={styles.hero}
        accessible
        accessibilityLabel={`${waiting} people waiting right now across ${openCount} open queues`}
      >
        <Text style={type.hero}>{String(waiting).padStart(2, '0')}</Text>
        <Text style={styles.heroCaption}>
          People{'\n'}waiting{'\n'}
          <Text style={{ color: colors.accentText }}>now</Text>
        </Text>
      </View>

      <LoadBar open={open} busiestId={longest?.waiting > 0 ? longest.id : null} />

      {longest && longest.waiting > 0 ? (
        <View style={styles.alert}>
          <Text style={[type.label, { color: colors.accentText }]}>Busiest</Text>
          <Text style={styles.alertText} numberOfLines={1}>
            {longest.name}
          </Text>
          <Text style={styles.alertCount}>{longest.waiting}</Text>
        </View>
      ) : null}

      <View style={styles.sectionHeader}>
        <Text style={type.label}>Services / {String(total).padStart(2, '0')}</Text>
        <Pressable
          onPress={onManage}
          accessibilityRole="button"
          accessibilityLabel="Manage services"
          hitSlop={12}
        >
          <Text style={styles.link}>Manage →</Text>
        </Pressable>
      </View>

      <View style={styles.tableHead}>
        <Text style={[type.label, styles.colIndex]}>#</Text>
        <Text style={[type.label, { flex: 1 }]}>Service</Text>
        <Text style={type.label}>Waiting</Text>
      </View>
    </View>
  );
}

// Each open queue's share of everyone waiting, as one segmented bar.
function LoadBar({ open, busiestId }) {
  const withPeople = open.filter((s) => s.waiting > 0);
  if (withPeople.length === 0) {
    return <View style={[styles.loadBar, { backgroundColor: colors.line }]} />;
  }

  const shades = [colors.text, '#8A8A8A', '#555555', '#3A3A3A'];
  let shadeIndex = 0;

  return (
    <View style={styles.loadBar} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {withPeople.map((s) => {
        const color = s.id === busiestId ? colors.accent : shades[shadeIndex++ % shades.length];
        return <View key={s.id} style={{ flex: s.waiting, backgroundColor: color, marginRight: 2 }} />;
      })}
    </View>
  );
}

function ServiceRow({ service, index, isBusiest, onOpenQueue, onToggle }) {
  const { isOpen } = service;

  return (
    <Pressable
      onPress={onOpenQueue}
      accessibilityRole="button"
      accessibilityLabel={`${service.name}, ${isOpen ? `${service.waiting} waiting` : 'closed'}. Open queue.`}
      style={({ pressed }) => [
        styles.row,
        isBusiest && styles.rowBusiest,
        pressed && { backgroundColor: colors.raised },
      ]}
    >
      <Text style={[styles.rowIndex, isBusiest && { color: colors.accentText }]}>
        {String(index + 1).padStart(2, '0')}
      </Text>

      <View style={styles.rowMain}>
        <Text
          style={[styles.rowName, !isOpen && styles.closedText]}
          numberOfLines={1}
        >
          {service.name}
        </Text>
        <Text style={styles.rowMeta}>
          {isOpen ? `~${formatWait(service)}` : 'Queue closed'}
        </Text>
        <View style={{ marginTop: spacing.sm, opacity: isOpen ? 1 : 0.5 }}>
          <PriorityMeter priority={service.priority} />
        </View>
      </View>

      <View style={styles.rowRight}>
        <Text
          style={[
            styles.count,
            isBusiest && { color: colors.accentText },
            !isOpen && { color: colors.faint },
          ]}
        >
          {isOpen ? String(service.waiting).padStart(2, '0') : '--'}
        </Text>
        <Switch
          value={isOpen}
          onValueChange={onToggle}
          trackColor={{ true: colors.accent, false: colors.lineStrong }}
          thumbColor={colors.text}
          ios_backgroundColor={colors.lineStrong}
          accessibilityLabel={`${isOpen ? 'Close' : 'Open'} the ${service.name} queue`}
        />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl * 2 },

  statusRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.sm },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
    marginRight: spacing.sm,
  },

  hero: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginTop: spacing.md,
  },
  heroCaption: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 17,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    color: colors.muted,
    marginLeft: spacing.md,
    marginBottom: spacing.md,
  },

  loadBar: {
    flexDirection: 'row',
    height: 10,
    marginTop: spacing.md,
    overflow: 'hidden',
  },

  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderLeftWidth: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
  },
  alertText: { ...type.body, flex: 1, marginLeft: spacing.md, fontWeight: '700' },
  alertCount: { fontFamily: fonts.mono, fontSize: 18, fontWeight: '700', color: colors.accentText },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xxl,
    paddingBottom: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },
  link: {
    fontFamily: fonts.mono,
    fontSize: 13,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.accentText,
  },
  tableHead: {
    flexDirection: 'row',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  colIndex: { width: 40 },

  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowBusiest: { borderLeftWidth: 3, borderLeftColor: colors.accent, paddingLeft: spacing.sm },
  rowIndex: {
    width: 40,
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    color: colors.faint,
    paddingTop: 2,
  },
  rowMain: { flex: 1, paddingRight: spacing.md },
  rowName: { ...type.body, fontWeight: '700' },
  closedText: { color: colors.faint, textDecorationLine: 'line-through' },
  rowMeta: { ...type.label, marginTop: spacing.xs, textTransform: 'none', letterSpacing: 0.5 },
  rowRight: { alignItems: 'flex-end' },
  count: {
    fontFamily: fonts.mono,
    fontSize: 30,
    fontWeight: '700',
    color: colors.text,
    marginBottom: spacing.sm,
  },

  empty: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderStyle: 'dashed',
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
});
