import React from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useServices } from '../../../data/ServicesStore';
import { PriorityPill, OpenPill } from '../../../components/Pill';
import Button from '../../../components/Button';
import { colors, radius, spacing, type } from '../../../theme';

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

  return (
    <View style={styles.screen}>
      <Stack.Screen options={{ title: 'Services' }} />

      <FlatList
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => router.push(`/admin/services/${item.id}`)}
            accessibilityRole="button"
            accessibilityLabel={`Edit ${item.name}`}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
          >
            <Text style={type.body}>{item.name}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.pills}>
              <PriorityPill priority={item.priority} />
              <View style={{ width: spacing.sm }} />
              <OpenPill isOpen={item.isOpen} />
            </View>
            <Text style={styles.duration}>
              About {item.expectedDuration} min per person
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={type.heading}>No services yet</Text>
            <Text style={styles.emptyBody}>
              A service is one thing people can queue for, such as advising or
              ID cards. Create the first one to get started.
            </Text>
          </View>
        }
      />

      <View style={styles.footer}>
        <Button
          label="New service"
          onPress={() => router.push('/admin/services/new')}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: spacing.lg },
  row: {
    backgroundColor: colors.surface,
    padding: spacing.lg,
  },
  rowPressed: { backgroundColor: colors.indigoSoft },
  description: { ...type.secondary, marginTop: 2 },
  pills: { flexDirection: 'row', marginTop: spacing.md },
  duration: { ...type.secondary, marginTop: spacing.sm },
  separator: { height: 1, backgroundColor: colors.line },
  empty: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
  },
  emptyBody: { ...type.secondary, marginTop: spacing.xs },
  footer: {
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    backgroundColor: colors.surface,
  },
});
