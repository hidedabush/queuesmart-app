import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useServices } from '../../../data/ServicesStore';
import { PriorityMeter, OpenPill } from '../../../components/Pill';
import Button from '../../../components/Button';
import { colors, fonts, spacing, type } from '../../../theme';

/**
 * Service Management — list (A2 requirement 3.2)
 *
 * The dashboard answers "what is happening now". This screen answers
 * "what services do we offer", so it shows configuration (duration,
 * priority) rather than live queue length.
 */
export default function ServiceList() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { services } = useServices();
  const openCount = services.filter((s) => s.isOpen).length;

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Services' }} />

      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View style={styles.header}>
            <Text style={type.label}>Configuration</Text>
            <View style={styles.headerStats}>
              <Stat value={services.length} label="Services" />
              <Stat value={openCount} label="Open" />
              <Stat value={services.length - openCount} label="Closed" />
            </View>
          </View>
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/admin/services/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            style={({ pressed }) => [
              styles.card,
              { borderLeftColor: item.isOpen ? colors.accent : colors.lineStrong },
              pressed && { backgroundColor: colors.raised },
            ]}
          >
            <View style={styles.cardTop}>
              <Text style={styles.code}>{item.id.toUpperCase()}</Text>
              <OpenPill isOpen={item.isOpen} />
            </View>

            <Text style={styles.name}>{item.name}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>

            <View style={styles.cardBottom}>
              <View style={styles.duration}>
                <Text style={styles.durationValue}>{item.expectedDuration}</Text>
                <Text style={styles.durationUnit}>min / person</Text>
              </View>
              <PriorityMeter priority={item.priority} />
            </View>

            <Text style={styles.edit}>Edit →</Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={type.title}>No services yet</Text>
            <Text style={[type.secondary, { marginTop: spacing.xs }]}>
              A service is one thing people can queue for, such as advising or
              ID cards. Create the first one to get started.
            </Text>
          </View>
        }
      />

      <View style={[styles.footer, { paddingBottom: spacing.lg + insets.bottom }]}>
        <Button
          label="+ New service"
          onPress={() => router.push('/admin/services/new')}
        />
      </View>
    </View>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{String(value).padStart(2, '0')}</Text>
      <Text style={type.label}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: spacing.xxl },

  header: {
    paddingBottom: spacing.lg,
    marginBottom: spacing.lg,
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },
  headerStats: { flexDirection: 'row', marginTop: spacing.md },
  stat: { marginRight: spacing.xxl },
  statValue: { fontFamily: fonts.mono, fontSize: 36, fontWeight: '700', color: colors.text },

  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderLeftWidth: 4,
    padding: spacing.lg,
    marginBottom: spacing.md,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  code: { ...type.label, color: colors.faint },
  name: { ...type.heading, fontSize: 20, marginTop: spacing.md },
  description: { ...type.secondary, marginTop: spacing.xs },
  cardBottom: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  duration: { flexDirection: 'row', alignItems: 'baseline' },
  durationValue: { fontFamily: fonts.mono, fontSize: 24, fontWeight: '700', color: colors.text },
  durationUnit: { ...type.label, marginLeft: spacing.xs, textTransform: 'none', letterSpacing: 0.5 },
  edit: {
    ...type.label,
    color: colors.accentText,
    alignSelf: 'flex-end',
    marginTop: spacing.md,
  },

  empty: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderStyle: 'dashed',
    padding: spacing.xl,
  },
  footer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.bg,
  },
});
