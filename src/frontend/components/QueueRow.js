import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { estimateWait } from '../rules';
import { PriorityMeter } from './Pill';
import Toggle from './Toggle';
import { colors, fonts, spacing, type } from '../theme';

export const TOGGLE_WIDTH = 76;

export function waitText(service) {
  if (!service.isOpen) return 'Closed';
  const estimate = estimateWait(service);
  return estimate ? `~${estimate.low}–${estimate.high} min` : 'No wait';
}

/**
 * One queue on the live board. Two separate touch zones so an accidental tap
 * never does the wrong thing: the body opens the queue, the right-hand zone
 * opens or closes it. `preview` renders the same row without interaction.
 */
export default function QueueRow({ service, isBusiest = false, onOpen, onToggle, preview = false }) {
  const { isOpen } = service;
  const count = isOpen ? String(service.waiting).padStart(2, '0') : '--';
  // Check-in closes automatically once the line reaches its daily capacity.
  const isFull = isOpen && service.waiting >= service.capacity;

  const body = (
    <>
      <View style={styles.text}>
        <Text style={[styles.name, !isOpen && { color: colors.muted }]} numberOfLines={2}>
          {service.name}
        </Text>
        <View style={styles.meta}>
          {isFull ? (
            <View style={[styles.closedTag, { borderColor: colors.accent }]}>
              <Text style={[styles.closedTagText, { color: colors.accentText }]}>Full</Text>
            </View>
          ) : null}
          {isOpen ? (
            <Text style={styles.wait}>{waitText(service)}</Text>
          ) : (
            <View style={styles.closedTag}>
              <Text style={styles.closedTagText}>Closed</Text>
            </View>
          )}
          <View style={{ opacity: isOpen ? 1 : 0.6 }}>
            <PriorityMeter priority={service.priority} />
          </View>
        </View>
      </View>
      <Text
        style={[
          styles.count,
          isBusiest && isOpen && { color: colors.accentText },
          !isOpen && { color: colors.faint },
        ]}
      >
        {count}
      </Text>
      {preview ? null : <Text style={styles.chevron}>›</Text>}
    </>
  );

  const label = `${service.name}, ${isOpen ? `${service.waiting} waiting, ${waitText(service)}` : 'closed'}${
    isFull ? ', full for today' : ''
  }${
    isBusiest ? ', longest line' : ''
  }`;

  return (
    <View style={[styles.row, preview && { borderBottomWidth: 0 }]}>
      {preview ? (
        <View style={styles.main} accessible accessibilityLabel={`Preview: ${label}`}>
          {body}
        </View>
      ) : (
        <Pressable
          onPress={onOpen}
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint="Opens the waiting line"
          style={({ pressed, hovered }) => [
            styles.main,
            hovered && { backgroundColor: colors.hover },
            pressed && { backgroundColor: colors.raised },
          ]}
        >
          {body}
        </Pressable>
      )}

      <View style={styles.divider} />

      <Toggle
        value={isOpen}
        onValueChange={onToggle}
        disabled={preview}
        label={`${service.name} open for check-in`}
        hint={
          isOpen
            ? 'Stops new check-ins. Patients already in line keep their place'
            : 'Lets patients check in again'
        }
        style={styles.toggle}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 76,
    paddingVertical: spacing.md,
    paddingRight: spacing.sm,
  },
  text: { flex: 1, paddingRight: spacing.md },
  name: { ...type.body, fontWeight: '700', lineHeight: 21 },
  meta: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: spacing.md,
    rowGap: spacing.xs,
    marginTop: spacing.xs,
  },
  wait: { fontFamily: fonts.mono, fontSize: 12, color: colors.muted, fontVariant: ['tabular-nums'] },
  closedTag: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 1,
  },
  closedTagText: { ...type.label, fontSize: 11, letterSpacing: 1 },
  count: { ...type.metric, fontSize: 28, minWidth: 40, textAlign: 'right' },
  chevron: { fontSize: 22, color: colors.faint, marginLeft: spacing.sm, marginTop: -2 },
  divider: { width: 1, backgroundColor: colors.line, marginVertical: spacing.md },
  toggle: { width: TOGGLE_WIDTH },
});
