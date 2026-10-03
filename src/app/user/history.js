import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../frontend/components/Button';
import { colors, radius, spacing, type } from '../../frontend/theme';

const historyEntries = [
  { id: 'history-1', serviceName: 'Academic Advising', date: 'Sep 28, 2026', outcome: 'Served' },
  { id: 'history-2', serviceName: 'ID Card Services', date: 'Sep 22, 2026', outcome: 'Served' },
  { id: 'history-3', serviceName: 'Financial Aid', date: 'Sep 16, 2026', outcome: 'Left queue' },
];

export default function QueueHistory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Queue History', headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={type.title}>Queue history</Text>
        <Text style={styles.subtitle}>Past services you have joined.</Text>

        {historyEntries.length ? (
          <View style={styles.list}>
            {historyEntries.map((entry) => (
              <View key={entry.id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.serviceName}>{entry.serviceName}</Text>
                  <Text style={[
                    styles.outcome,
                    entry.outcome === 'Served' && styles.outcomeServed,
                  ]}>
                    {entry.outcome}
                  </Text>
                </View>
                <Text style={styles.date}>{entry.date}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No past queues yet</Text>
            <Text style={styles.subtitle}>Queues you leave will appear here.</Text>
          </View>
        )}

        <Button
          label="Back to dashboard"
          variant="secondary"
          onPress={() => router.replace('/user/dashboard')}
          style={styles.dashboardButton}
        />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  subtitle: { ...type.secondary, marginTop: spacing.xs },
  list: { marginTop: spacing.xl, borderTopWidth: 1, borderColor: colors.line },
  row: {
    paddingVertical: spacing.lg,
    borderBottomWidth: 1,
    borderColor: colors.line,
  },
  rowTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: spacing.md,
  },
  serviceName: { ...type.heading, flex: 1 },
  outcome: {
    ...type.label,
    fontSize: 10,
    color: colors.muted,
    textAlign: 'right',
  },
  outcomeServed: { color: colors.accentText },
  date: { ...type.secondary, marginTop: spacing.xs, fontSize: 12 },
  emptyState: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  emptyTitle: { ...type.heading },
  dashboardButton: { marginTop: spacing.xl },
});
