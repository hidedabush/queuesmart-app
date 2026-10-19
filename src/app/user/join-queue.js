import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';

import { EMERGENCY_NOTICE, REASON_MAX, formatWait, validateReason } from '../../frontend/rules';

import {
  useQueue,
  useServices,
} from '../../frontend/state/ServicesStore';

import {
  AvailabilityPill,
  PriorityPill,
} from '../../frontend/components/Pill';

import Button from '../../frontend/components/Button';
import Field from '../../frontend/components/Field';

import {
  colors,
  radius,
  spacing,
  type,
} from '../../frontend/theme';

// Why the check-in button is unavailable for a visit type, or null.
function unavailableLabel(service, activeQueue) {
  if (activeQueue?.serviceId === service.id) return 'You are checked in here';
  if (activeQueue) return 'Already checked in';
  if (!service.isOpen) return 'Closed';
  if (service.waiting >= service.capacity) return 'Full for today';
  return null;
}

export default function JoinQueue() {
  const router = useRouter();
  const listRef = useRef(null);
  const { selectedServiceId: selectedServiceParam } = useLocalSearchParams();
  const { services } = useServices();
  const { activeQueue, checkIn } = useQueue();
  const selectedServiceId = Array.isArray(selectedServiceParam)
    ? selectedServiceParam[0]
    : selectedServiceParam;
  const selectedServiceIndex = services.findIndex((item) => item.id === selectedServiceId);

  // The visit type whose reason form is open, and what has been typed.
  const [choosingId, setChoosingId] = useState(null);
  const [reason, setReason] = useState('');
  const [reasonError, setReasonError] = useState(null);
  const activeService = activeQueue ? services.find((s) => s.id === activeQueue.serviceId) : null;

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

  function startCheckIn(service) {
    setChoosingId(service.id);
    setReason('');
    setReasonError(null);
  }

  function confirmCheckIn(service) {
    const error = validateReason(reason);
    if (error) {
      setReasonError(error);
      return;
    }
    const result = checkIn(service.id, reason);
    if (result.error) {
      setReasonError(result.message ?? 'This visit type just became unavailable. Choose another.');
      return;
    }
    setChoosingId(null);
    router.push('/user/queue-status');
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Stack.Screen options={{ title: 'Check in' }} />

      <FlatList
        ref={listRef}
        data={services}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
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
              Check in for a visit
            </Text>

            <Text style={styles.subtitle}>
              Choose the kind of care you need today. You can wait anywhere, and
              we will tell you when to head to the office.
            </Text>

            <View style={styles.emergency}>
              <Text style={styles.emergencyText}>{EMERGENCY_NOTICE}</Text>
            </View>

            {activeQueue ? (
              <View style={styles.checkedIn}>
                <Text style={type.body}>
                  You are checked in for {activeService?.name ?? 'a visit'}. One check-in at a
                  time: cancel it first to choose a different visit type.
                </Text>
                <Button
                  label="View my check-in"
                  variant="secondary"
                  onPress={() => router.push('/user/queue-status')}
                  style={{ marginTop: spacing.md }}
                />
              </View>
            ) : null}
          </View>
        }
        ItemSeparatorComponent={() => (
          <View style={styles.separator} />
        )}
        renderItem={({ item }) => {
          const isSelected = item.id === selectedServiceId;
          const unavailable = unavailableLabel(item, activeQueue);
          const choosing = choosingId === item.id && !unavailable;

          return (
            <View style={[styles.card, isSelected && styles.selectedCard]}>
              <View style={styles.cardMain}>
                {isSelected ? <Text style={styles.selectedLabel}>SELECTED VISIT TYPE</Text> : null}
                <Text style={type.heading}>
                  {item.name}
                </Text>

                <Text style={styles.description}>
                  {item.description}
                </Text>

                <Text style={styles.wait}>
                  {item.isOpen
                    ? `${item.waiting} waiting · about ${formatWait(item)}`
                    : 'Not taking walk-ins right now'}
                </Text>

                <View style={styles.pills}>
                  <PriorityPill priority={item.priority} />
                  <AvailabilityPill service={item} />
                </View>

                {choosing ? (
                  <View style={styles.reasonForm}>
                    <Field
                      label="Reason for visit"
                      value={reason}
                      onChangeText={(text) => {
                        setReason(text);
                        if (reasonError) setReasonError(validateReason(text));
                      }}
                      error={reasonError}
                      maxLength={REASON_MAX}
                      showCounter
                      multiline
                      required
                      autoFocus
                      placeholder="e.g. Sore throat and fever since yesterday"
                      helper="Only the care team sees this. It never appears in notifications."
                    />
                    <View style={styles.formActions}>
                      <Button
                        label="Cancel"
                        variant="secondary"
                        onPress={() => setChoosingId(null)}
                        style={styles.formButton}
                      />
                      <Button
                        label="Confirm check-in"
                        onPress={() => confirmCheckIn(item)}
                        style={styles.formButton}
                      />
                    </View>
                  </View>
                ) : (
                  <Button
                    label={unavailable ?? 'Check in'}
                    disabled={Boolean(unavailable)}
                    onPress={() => startCheckIn(item)}
                    style={{ marginTop: spacing.lg }}
                  />
                )}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            The office is not taking walk-ins right now.
          </Text>
        }
      />
    </KeyboardAvoidingView>
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

  emergency: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.accent,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
  },

  emergencyText: {
    ...type.body,
    fontWeight: '600',
  },

  checkedIn: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
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
    alignItems: 'center',
    columnGap: spacing.md,
    marginTop: spacing.md,
  },

  reasonForm: {
    marginTop: spacing.lg,
  },

  formActions: {
    flexDirection: 'row',
    columnGap: spacing.sm,
  },

  formButton: {
    flex: 1,
  },

  separator: {
    height: spacing.md,
  },

  empty: {
    ...type.secondary,
  },
});
