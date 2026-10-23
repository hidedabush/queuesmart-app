import { Stack, useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import {
  useQueue,
  useServices,
} from '../../frontend/state/ServicesStore';

import { checkInStatus, formatEstimate } from '../../frontend/checkInStatus';
import Button from '../../frontend/components/Button';

import {
  colors,
  radius,
  spacing,
  type,
} from '../../frontend/theme';

export default function QueueStatus() {
  const router = useRouter();
  const { services } = useServices();
  const { activeQueue, queueLoading, queueError, refreshMyQueue, cancelCheckIn } = useQueue();

  const service = activeQueue
    ? services.find(
        (item) => item.id === activeQueue.serviceId
      )
    : null;
  const status = activeQueue ? checkInStatus(activeQueue) : null;
  const isCalled = activeQueue?.status === 'called';

  // Back to the visit type list. It is normally the previous screen; replace
  // covers the case where this screen was opened directly.
  function goToCheckIn() {
    if (router.canGoBack()) router.back();
    else router.replace('/user/join-queue');
  }

  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  async function confirmCancel() {
    setCancelling(true);
    setCancelError(null);

    try {
      const result = await cancelCheckIn();

      if (result?.error) {
        setCancelError(
          result.message ?? 'Unable to cancel your check-in.'
        );
        return;
      }

      goToCheckIn();
    } catch {
      setCancelError(
        'Unable to cancel your check-in. Please try again.'
      );
    } finally {
      setCancelling(false);
    }
  }

  function handleCancel() {
    const title = 'Cancel your check-in?';
    const message = 'You will lose your place in line. Checking in again puts you at the back.';

    // Alert.alert with buttons is a no-op on react-native-web.
    if (Platform.OS === 'web') {
      if (window.confirm(`${title}\n\n${message}`)) {
        void confirmCancel();
      }
      return;
    }

    Alert.alert(title, message, [
      { text: 'Keep my place', style: 'cancel' },
      { text: 'Cancel check-in', style: 'destructive', onPress: () => void confirmCancel(), },
    ]);
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'My check-in' }} />

      <Text style={type.title}>
        Your check-in
      </Text>

      {queueLoading && !activeQueue ? (
        <Text style={styles.empty}>
          Checking your check-in status…
        </Text>
      ) : queueError && !activeQueue ? (
        <>
          <Text style={styles.empty}>
            We could not retrieve your check-in status. Please try again.
          </Text>

          <Button
            label="Retry"
            onPress={() => void refreshMyQueue()}
            style={{ marginTop: spacing.xl }}
          />
        </>
      ) : !activeQueue ? (
        <>
          <Text style={styles.empty}>
            You are not checked in for a visit right now.
          </Text>

          <Button
            label="Check in for a visit"
            onPress={goToCheckIn}
            style={{ marginTop: spacing.xl }}
          />
        </>
      ) : !service ? (
        <Text style={styles.empty}>
          Your check-in was found, but its visit type could not be loaded.
          Please try again shortly.
        </Text>
      ) : (
        <View style={[styles.card, status.urgent && styles.cardUrgent]}>
          <Text style={type.heading}>
            {service.name}
          </Text>

          <Text style={[styles.status, status.urgent && { color: colors.accentText }]}>
            {status.label}
          </Text>

          {isCalled ? null : (
            <View style={styles.positionBox}>
              <Text style={styles.positionNumber}>
                #{activeQueue.position}
              </Text>

              <Text style={styles.positionLabel}>
                Your place in line
              </Text>
            </View>
          )}

          {isCalled ? null : (
            <Text style={styles.wait}>
              Estimated wait: {formatEstimate(activeQueue.estimatedWait)}
            </Text>
          )}

          <Text style={styles.description} accessibilityLiveRegion="polite">
            {status.message}
          </Text>

          <View style={styles.reasonBox}>
            <Text style={type.label}>Reason for visit</Text>
            <Text style={[type.body, { marginTop: spacing.xs }]}>{activeQueue.reason}</Text>
          </View>

          <Text style={styles.note}>
            At the front desk, have a photo ID and your insurance card ready. Staff
            will confirm your name and date of birth.
          </Text>

          {cancelError ? (
            <Text
              style={styles.description}
              accessibilityLiveRegion="polite"
            >
              {cancelError}
            </Text>
          ) : null}

          <Button
            label={cancelling ? 'Cancelling…' : 'Cancel check-in'}
            variant="danger"
            disabled={cancelling}
            onPress={handleCancel}
            style={{ marginTop: spacing.xl }}
          />
        </View>
      )}

      <Button
        label="Back to dashboard"
        variant="secondary"
        onPress={() => router.replace('/user/dashboard')}
        style={{ marginTop: spacing.xl }}
      />
    </ScrollView>
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

  empty: {
    ...type.secondary,
    marginTop: spacing.md,
  },

  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: spacing.xl,
    marginTop: spacing.lg,
  },

  cardUrgent: {
    borderWidth: 1,
    borderLeftWidth: 4,
    borderColor: colors.accent,
  },

  status: {
    fontSize: 13,
    fontWeight: '600',
    color: colors.text,
    marginTop: spacing.sm,
  },

  positionBox: {
    backgroundColor: colors.raised,
    borderRadius: radius.md,
    padding: spacing.xl,
    alignItems: 'center',
    marginTop: spacing.xl,
  },

  positionNumber: {
    fontSize: 42,
    fontWeight: '700',
    color: colors.text,
  },

  positionLabel: {
    ...type.secondary,
    marginTop: spacing.xs,
  },

  wait: {
    ...type.body,
    marginTop: spacing.xl,
  },

  description: {
    ...type.secondary,
    marginTop: spacing.sm,
  },

  reasonBox: {
    marginTop: spacing.xl,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },

  note: {
    ...type.secondary,
    marginTop: spacing.lg,
  },
});
