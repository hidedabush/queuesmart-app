import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useServices } from '../../../data/ServicesStore';
import { PriorityMeter, OpenPill } from '../../../components/Pill';
import Button from '../../../components/Button';
import { contentWidth, useLayout } from '../../../hooks/useLayout';
import { colors, layout, radius, spacing, type } from '../../../theme';

const FAB_CLEARANCE = 96;

/**
 * Service Management — list (A2 requirement 3.2)
 *
 * The dashboard answers "what is happening now". This screen answers
 * "what services do we offer", so it shows configuration (duration,
 * priority) rather than live queue length.
 */
export default function ServiceList() {
  const router = useRouter();
  const { services } = useServices();
  const { width, isWide, gutter } = useLayout();

  const openCount = services.filter((s) => s.isOpen).length;
  const available = width - (isWide ? layout.sidebar : 0);
  const columns = available >= 1000 ? 3 : available >= 640 ? 2 : 1;
  const create = () => router.push('/admin/services/new');

  // Pad the last row so a lone card keeps its column width instead of stretching.
  const remainder = services.length % columns;
  const cells =
    columns > 1 && remainder
      ? [...services, ...Array.from({ length: columns - remainder }, (_, i) => ({ id: `spacer-${i}`, spacer: true }))]
      : services;

  const showFab = !isWide && services.length > 0;

  return (
    <View style={styles.screen}>
      <FlatList
        key={columns}
        numColumns={columns}
        data={cells}
        keyExtractor={(item) => item.id}
        columnWrapperStyle={columns > 1 ? styles.columns : undefined}
        contentContainerStyle={[
          contentWidth(columns > 1 ? layout.max : layout.readable, gutter),
          styles.content,
          showFab && { paddingBottom: FAB_CLEARANCE },
        ]}
        ListHeaderComponent={
          services.length > 0 ? (
            <View style={styles.header}>
              <Text style={[type.label, { flex: 1 }]}>
                {services.length} {services.length === 1 ? 'service' : 'services'} · {openCount} open ·{' '}
                {services.length - openCount} closed
              </Text>
              {isWide ? <Button label="+ New service" size="sm" onPress={create} /> : null}
            </View>
          ) : null
        }
        renderItem={({ item }) =>
          item.spacer ? (
            <View style={[styles.cell, styles.spacer]} />
          ) : (
            <ServiceCard
              service={item}
              style={columns > 1 && styles.cell}
              onPress={() => router.push(`/admin/services/${item.id}`)}
            />
          )
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={type.title}>No services yet</Text>
            <Text style={[type.secondary, { marginTop: spacing.xs }]}>
              A service is one thing people can queue for, such as advising or
              ID cards. Create the first one to get started.
            </Text>
            <Button label="+ Create a service" onPress={create} style={{ marginTop: spacing.lg }} />
          </View>
        }
      />

      {showFab ? (
        <Button
          label="+ New service"
          onPress={create}
          style={[styles.fab, { right: gutter }]}
        />
      ) : null}
    </View>
  );
}

function ServiceCard({ service, onPress, style }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${service.name}, ${service.isOpen ? 'open' : 'closed'}, ${
        service.expectedDuration
      } minutes per person, ${service.priority} priority`}
      accessibilityHint="Edit this service"
      style={({ pressed, hovered }) => [
        styles.card,
        style,
        hovered && { backgroundColor: colors.hover },
        pressed && { backgroundColor: colors.raised },
      ]}
    >
      <View style={styles.cardTop}>
        <Text style={styles.name} numberOfLines={2}>
          {service.name}
        </Text>
        <OpenPill isOpen={service.isOpen} />
      </View>

      <Text style={styles.description} numberOfLines={2}>
        {service.description}
      </Text>

      <View style={styles.cardBottom}>
        <Text style={styles.durationUnit}>
          <Text style={styles.durationValue}>{service.expectedDuration}</Text> min / person
        </Text>
        <PriorityMeter priority={service.priority} />
        <Text style={styles.chevron}>›</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { paddingTop: spacing.lg, paddingBottom: spacing.xxl },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 44,
    marginBottom: spacing.md,
  },

  columns: { columnGap: spacing.md },
  cell: { flex: 1, flexBasis: 0 },
  // Same box model as a card, so flex shares the row out evenly.
  spacer: { padding: spacing.lg, borderWidth: 1, borderColor: 'transparent' },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', columnGap: spacing.md },
  name: { ...type.heading, flex: 1, fontSize: 18, lineHeight: 23 },
  description: { ...type.secondary, marginTop: spacing.xs, marginBottom: spacing.md },
  // Pinned to the bottom so the metadata lines up across a grid row.
  cardBottom: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.lg,
    rowGap: spacing.sm,
    marginTop: 'auto',
  },
  durationValue: { ...type.metric, fontSize: 16 },
  durationUnit: { ...type.label, textTransform: 'none', letterSpacing: 0.5 },
  chevron: { marginLeft: 'auto', fontSize: 22, color: colors.faint, marginTop: -2 },

  empty: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderStyle: 'dashed',
    padding: spacing.xl,
  },

  fab: {
    position: 'absolute',
    bottom: spacing.lg,
    paddingHorizontal: spacing.xl,
  },
});
