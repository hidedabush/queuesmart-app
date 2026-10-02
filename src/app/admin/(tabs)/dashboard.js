import React, { useEffect, useMemo, useRef } from 'react';
import {
  AccessibilityInfo,
  Animated,
  FlatList,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useServices } from '../../../frontend/state/ServicesStore';
import QueueRow, { TOGGLE_WIDTH } from '../../../frontend/components/QueueRow';
import Button from '../../../frontend/components/Button';
import { contentWidth, useLayout } from '../../../frontend/hooks/useLayout';
import { colors, fonts, layout, radius, spacing, type } from '../../../frontend/theme';

/**
 * Admin Dashboard (A2 requirement 3.1)
 *
 * Styled like a departure board. What an administrator needs on opening
 * the app, in order:
 *   1. How many people are waiting right now, across everything.
 *   2. Which queue is the problem — one tap to open it.
 *   3. One tap to open or close any queue.
 */
export default function AdminDashboard() {
  const router = useRouter();
  const { services, setQueueOpen } = useServices();
  const { width, isXL, isTablet, gutter } = useLayout();
  // Summary beside the list only when both get a comfortable width.
  const split = isXL;

  const summary = useMemo(() => {
    const open = services.filter((s) => s.isOpen);
    const waiting = open.reduce((total, s) => total + s.waiting, 0);
    const longest = open.reduce(
      (worst, s) => (!worst || s.waiting > worst.waiting ? s : worst),
      null
    );
    return {
      open,
      waiting,
      openCount: open.length,
      total: services.length,
      busiest: longest && longest.waiting > 0 ? longest : null,
    };
  }, [services]);

  const openQueue = (id) => router.push(`/admin/queue/${id}`);

  if (services.length === 0) {
    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={[contentWidth(layout.readable, gutter), styles.padded]}
      >
        <EmptyBoard onCreate={() => router.push('/admin/services/new')} />
      </ScrollView>
    );
  }

  // Scales the headline number with the space it has: ~72 on a 320pt phone,
  // capped so it never dominates a tablet.
  const heroSize = split ? 96 : isTablet ? 104 : Math.round(Math.min(96, Math.max(72, width * 0.22)));

  const summaryPanel = (
    <Summary summary={summary} heroSize={heroSize} onOpenBusiest={openQueue} />
  );

  const list = (
    <FlatList
      data={services}
      keyExtractor={(item) => item.id}
      style={styles.screen}
      contentContainerStyle={
        split ? styles.padded : [contentWidth(layout.readable, gutter), styles.padded]
      }
      ListHeaderComponent={
        <>
          {split ? null : summaryPanel}
          <ListHeader total={summary.total} />
        </>
      }
      renderItem={({ item }) => (
        <QueueRow
          service={item}
          isBusiest={summary.busiest?.id === item.id}
          onOpen={() => openQueue(item.id)}
          onToggle={(value) => setQueueOpen(item.id, value)}
        />
      )}
    />
  );

  if (!split) return list;

  return (
    <View style={[styles.screen, styles.wide, contentWidth(layout.max, gutter)]}>
      <ScrollView style={styles.sidePanel} contentContainerStyle={styles.padded}>
        {summaryPanel}
      </ScrollView>
      <View style={styles.wideList}>{list}</View>
    </View>
  );
}

function LiveDot({ active }) {
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!active) {
      opacity.setValue(1);
      return undefined;
    }
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
  }, [active, opacity]);

  return (
    <Animated.View
      style={[styles.liveDot, { opacity, backgroundColor: active ? colors.accent : colors.faint }]}
    />
  );
}

function Summary({ summary, heroSize, onOpenBusiest }) {
  const { waiting, openCount, total, open, busiest } = summary;
  const live = openCount > 0;

  return (
    <View style={styles.summary}>
      <View
        style={styles.statusRow}
        accessible
        accessibilityLabel={live ? `Live. ${openCount} of ${total} queues open` : 'All queues closed'}
      >
        <LiveDot active={live} />
        <Text style={[type.label, live && { color: colors.text }]}>
          {live ? 'Live' : 'All queues closed'}
        </Text>
        {live ? (
          <Text style={type.label}>
            {'  ·  '}
            {openCount} of {total} open
          </Text>
        ) : null}
      </View>

      <View
        style={styles.hero}
        accessible
        role="heading"
        aria-level={2}
        accessibilityLabel={`${waiting} people waiting right now across ${openCount} open ${
          openCount === 1 ? 'queue' : 'queues'
        }`}
      >
        <Text
          style={[type.hero, styles.heroNumber, { fontSize: heroSize, lineHeight: heroSize * 1.05, letterSpacing: -heroSize * 0.045 }]}
          maxFontSizeMultiplier={1.15}
        >
          {String(waiting).padStart(2, '0')}
        </Text>
        <Text style={styles.heroCaption} maxFontSizeMultiplier={1.4}>
          People{'\n'}waiting{'\n'}
          <Text style={{ color: colors.accentText }}>now</Text>
        </Text>
      </View>

      <LoadBar open={open} busiestId={busiest?.id} />

      {busiest ? (
        <Pressable
          onPress={() => onOpenBusiest(busiest.id)}
          accessibilityRole="button"
          accessibilityLabel={`Busiest queue: ${busiest.name}, ${busiest.waiting} waiting`}
          accessibilityHint="Opens queue management"
          style={({ pressed, hovered }) => [
            styles.alert,
            (hovered || pressed) && { backgroundColor: colors.accentSoftStrong },
          ]}
        >
          <View style={{ flex: 1 }}>
            <Text style={[type.label, { color: colors.accentText }]}>Busiest</Text>
            <Text style={styles.alertName} numberOfLines={2}>
              {busiest.name}
            </Text>
          </View>
          <Text style={styles.alertCount}>{busiest.waiting}</Text>
          <Text style={styles.alertChevron}>›</Text>
        </Pressable>
      ) : null}
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
        return <View key={s.id} style={{ flex: s.waiting, backgroundColor: color }} />;
      })}
    </View>
  );
}

function ListHeader({ total }) {
  return (
    <View style={styles.listHeader}>
      <Text style={[type.label, styles.listTitle]} role="heading" aria-level={2}>
        Queues · {String(total).padStart(2, '0')}
      </Text>
      <Text style={[type.label, styles.colWaiting]} aria-hidden>Waiting</Text>
      <Text style={[type.label, styles.colOpen]} aria-hidden>Open</Text>
    </View>
  );
}

function EmptyBoard({ onCreate }) {
  return (
    <View style={styles.empty}>
      <Text style={type.label}>Board empty</Text>
      <Text style={[type.title, { marginTop: spacing.sm }]}>No services yet</Text>
      <Text style={[type.secondary, { marginTop: spacing.xs }]}>
        Create a service and it will appear here with its live queue.
      </Text>
      <Button label="+ Create a service" onPress={onCreate} style={{ marginTop: spacing.lg }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },

  wide: { flexDirection: 'row', columnGap: spacing.xxl },
  sidePanel: { width: 340, flexGrow: 0 },
  wideList: { flex: 1 },

  summary: { marginBottom: spacing.xl },
  statusRow: { flexDirection: 'row', alignItems: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4, marginRight: spacing.sm },

  hero: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing.sm },
  heroNumber: { fontVariant: ['tabular-nums'] },
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

  loadBar: { flexDirection: 'row', columnGap: 2, height: 8, marginTop: spacing.md, overflow: 'hidden' },

  alert: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 64,
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    borderLeftWidth: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
  },
  alertName: { ...type.body, fontWeight: '700', marginTop: 2 },
  alertCount: { ...type.metric, fontSize: 24, color: colors.accentText, marginLeft: spacing.md },
  alertChevron: { fontSize: 22, color: colors.accentText, marginLeft: spacing.sm, marginTop: -2 },

  listHeader: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },
  listTitle: { flex: 1 },
  // Right edge lines up with the count column (the row's chevron sits after it).
  colWaiting: { marginRight: spacing.lg + 1 },
  colOpen: { width: TOGGLE_WIDTH + 1, textAlign: 'center' },

  empty: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderStyle: 'dashed',
    padding: spacing.xl,
  },
});
