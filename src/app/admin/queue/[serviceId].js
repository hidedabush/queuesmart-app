/**
 * Queue Management screen (A2 requirement 3.3)
 *
 * by kevin :3 (idk if u wanted me to keep the layout of the placeholder but i tried)
 *
 * The front desk's view of one visit type's line. Staff call the next
 * patient, then mark them checked in when they reach the desk or a no-show
 * after the grace period. Only one patient can be called at a time. Staff
 * can also move a patient up or down, or take them out of line. The line
 * itself lives in the shared state (ServicesStore.js), so a patient who
 * checks in from the app appears here and moves up as staff work the line.
 */
import { Stack, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { NO_SHOW_GRACE_MINUTES, displayName } from '../../../frontend/rules';
import Button from '../../../frontend/components/Button';
import Pill from '../../../frontend/components/Pill';
import { ToastProvider, useToast } from '../../../frontend/components/Toast';
import { contentWidth, useLayout } from '../../../frontend/hooks/useLayout';
import { useServices } from '../../../frontend/state/ServicesStore';
import { colors, layout, radius, spacing, type } from '../../../frontend/theme';

//  this keeps the screen working
// whether or not the layout already provides one.
export default function QueueManagement() {
  return (
    <ToastProvider>
      <QueueScreen />
    </ToastProvider>
  );
}

function formatDob(dob) {
  if (!dob) return null;
  const [year, month, day] = dob.split('-');
  return `${month}/${day}/${year}`;
}

function QueueScreen() {
  const { serviceId } = useLocalSearchParams();
  const {
    getService,
    watchLine,
    getServiceQueue,
    getCalled,
    callNext,
    resolveCalled,
    moveEntry,
    removeEntry,
  } = useServices();
  const { gutter } = useLayout();
  const toast = useToast();
  // Read this line from the server while the screen is open.
  useEffect(() => watchLine(serviceId), [serviceId, watchLine]);
  const service = getService(serviceId);
  const queue = service ? getServiceQueue(serviceId) : [];
  const called = service ? getCalled(serviceId) : null;

  if (!service) {
    return (
      <View style={[styles.screen, contentWidth(layout.readable, gutter), styles.padded]}>
        <Text style={type.title}>Visit type not found</Text>
        <Text style={[type.secondary, { marginTop: spacing.xs }]}>
          Go back to the front desk and pick a line.
        </Text>
      </View>
    );
  }

  // Each action returns { error, message } when the server refuses it.
  async function handleCallNext() {
    const result = await callNext(serviceId);
    if (result.error) return toast(result.message);
    toast(`Calling ${displayName(result.entry.patientName)} to the front desk.`);
  }

  async function handleResolve(outcome) {
    const entry = await resolveCalled(serviceId, outcome);
    if (entry.error) return toast(entry.message);
    toast(
      outcome === 'seen'
        ? `${displayName(entry.patientName)} checked in.`
        : `${displayName(entry.patientName)} marked as a no-show. Their spot is released.`
    );
  }

  async function move(index, direction) {
    const entry = queue[index];
    const line = await moveEntry(serviceId, entry.id, direction);
    if (line.error) return toast(line.message);
    // The server never moves a patient past a different priority level, so
    // report where they actually ended up.
    const position = line.findIndex((item) => item.id === entry.id) + 1;
    toast(`${displayName(entry.patientName)} moved to position ${position}.`);
  }

  async function remove(index) {
    const entry = queue[index];
    const result = await removeEntry(entry.id);
    if (result.error) return toast(result.message);
    toast(`${displayName(entry.patientName)} was taken out of line.`);
  }

  return (
    <FlatList
      data={queue}
      keyExtractor={(item) => item.id}
      style={styles.screen}
      contentContainerStyle={[contentWidth(layout.readable, gutter), styles.padded]}
      ListHeaderComponent={
        <View>
          <Stack.Screen options={{ title: service.name }} />
          <Text style={type.label}>
            {service.name} · {service.isOpen ? 'Open for check-in' : 'Closed to new check-ins'}
          </Text>
          <Text style={[type.display, { marginTop: spacing.xs }]}>{queue.length} waiting</Text>

          {called ? (
            <View
              style={styles.serving}
              accessible
              accessibilityLabel={`Now calling ${displayName(called.patientName)}`}
            >
              <Text style={[type.label, { color: colors.accentText }]}>Now calling</Text>
              <Text style={styles.servingName}>{displayName(called.patientName)}</Text>
              <Text style={[type.secondary, { marginTop: 2 }]}>{called.reason}</Text>
              <Text style={[type.secondary, { marginTop: spacing.sm }]}>
                Confirm name and date of birth ({formatDob(called.dob)}) at the desk. If they have
                not arrived after {NO_SHOW_GRACE_MINUTES} minutes, mark a no-show.
              </Text>
              <View style={styles.actions}>
                <Button
                  label="Checked in"
                  size="sm"
                  onPress={() => handleResolve('seen')}
                  accessibilityHint="The patient is at the desk and is sent to a room"
                />
                <Button
                  label="No-show"
                  variant="danger"
                  size="sm"
                  onPress={() => handleResolve('no-show')}
                  accessibilityHint="Releases the spot of a patient who did not arrive"
                />
              </View>
            </View>
          ) : null}

          <Button
            label="Call next patient"
            onPress={handleCallNext}
            disabled={queue.length === 0 || Boolean(called)}
            accessibilityHint={
              called
                ? 'Check in or mark a no-show for the patient being called first'
                : 'Calls the first patient in line to the front desk'
            }
            style={{ marginTop: spacing.lg, marginBottom: called ? spacing.xs : spacing.xl }}
          />
          {called ? (
            <Text style={[type.secondary, { marginBottom: spacing.xl }]}>
              Finish with the patient being called before calling the next one.
            </Text>
          ) : null}

          <View style={styles.listHeader}>
            <Text style={type.label} role="heading" aria-level={2}>
              Line · {String(queue.length).padStart(2, '0')}
            </Text>
          </View>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.empty}>
          <Text style={type.label}>Line empty</Text>
          <Text style={[type.title, { marginTop: spacing.sm }]}>Nobody is waiting</Text>
          <Text style={[type.secondary, { marginTop: spacing.xs }]}>
            Patients who check in for {service.name} will appear here.
          </Text>
        </View>
      }
      renderItem={({ item, index }) => (
        <Entry
          entry={item}
          position={index + 1}
          isFirst={index === 0}
          isLast={index === queue.length - 1}
          onUp={() => move(index, -1)}
          onDown={() => move(index, 1)}
          onRemove={() => remove(index)}
        />
      )}
    />
  );
}

function Entry({ entry, position, isFirst, isLast, onUp, onDown, onRemove }) {
  const name = displayName(entry.patientName);
  // Status follows position, so it can never go stale after a reorder.
  const upNext = position === 1;

  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <Text style={styles.position}>{String(position).padStart(2, '0')}</Text>
        <View style={styles.who}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.reason} numberOfLines={2}>
            {entry.reason}
          </Text>
        </View>
        {upNext ? (
          <Pill label="Up next" fg={colors.accentText} border={colors.accent} bg={colors.accentSoft} />
        ) : (
          <Pill label="Waiting" />
        )}
      </View>

      <View style={styles.actions}>
        <Button
          label="Up"
          variant="secondary"
          size="sm"
          disabled={isFirst}
          onPress={onUp}
          accessibilityHint={`Moves ${name} up one place`}
        />
        <Button
          label="Down"
          variant="secondary"
          size="sm"
          disabled={isLast}
          onPress={onDown}
          accessibilityHint={`Moves ${name} down one place`}
        />
        <Button
          label="Remove"
          variant="danger"
          size="sm"
          onPress={onRemove}
          accessibilityHint={`Takes ${name} out of line`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  padded: { paddingTop: spacing.lg, paddingBottom: spacing.xxxl },

  serving: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.accent,
    borderLeftWidth: 4,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.sm,
  },
  servingName: { ...type.body, fontWeight: '700', marginTop: 2 },

  listHeader: {
    paddingBottom: spacing.sm,
    borderBottomWidth: 2,
    borderBottomColor: colors.text,
  },

  row: {
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', columnGap: spacing.md },
  position: { ...type.metric, fontSize: 28, minWidth: 40 },
  who: { flex: 1 },
  name: { ...type.body, fontWeight: '700' },
  reason: { ...type.secondary, marginTop: 2 },
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: spacing.sm,
    rowGap: spacing.sm,
    marginTop: spacing.md,
  },

  empty: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderStyle: 'dashed',
    padding: spacing.xl,
    marginTop: spacing.lg,
  },
});
