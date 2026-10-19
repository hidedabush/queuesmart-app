import { Stack, useRouter } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Button from '../../frontend/components/Button';
import { useServices } from '../../frontend/state/ServicesStore';
import { colors, radius, spacing, type } from '../../frontend/theme';

const outcomeLabels = {
  seen: 'Seen',
  cancelled: 'Cancelled',
  'no-show': 'No-show',
  removed: 'Removed by staff',
};

function formatDate(isoDate) {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function VisitHistory() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { history } = useServices();

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Visit History', headerShown: false }} />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.md }]}
        showsVerticalScrollIndicator={false}
      >
        <Text style={type.title}>Visit history</Text>
        <Text style={styles.subtitle}>Your past walk-in check-ins at this office.</Text>

        {history.length ? (
          <View style={styles.list}>
            {history.map((entry) => (
              <View key={entry.id} style={styles.row}>
                <View style={styles.rowTop}>
                  <Text style={styles.serviceName}>{entry.serviceName}</Text>
                  <Text style={[
                    styles.outcome,
                    entry.outcome === 'seen' && styles.outcomeServed,
                  ]}>
                    {outcomeLabels[entry.outcome] ?? entry.outcome}
                  </Text>
                </View>
                <Text style={styles.date}>{formatDate(entry.date)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyState}>
            <Text style={styles.emptyTitle}>No past visits yet</Text>
            <Text style={styles.subtitle}>Visits you check in for will appear here.</Text>
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
  serviceName: { ...type.heading, flex: 1, color: colors.accentText },
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
