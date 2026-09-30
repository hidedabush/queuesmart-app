import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, priorityLevels, radius, spacing } from '../theme';

export default function Pill({ label, fg = colors.muted, border = colors.lineStrong, bg = 'transparent' }) {
  return (
    <View style={[styles.pill, { borderColor: border, backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

// Signal-strength style meter: 1, 2 or 3 bars plus the word.
export function PriorityMeter({ priority, showLabel = true }) {
  const tone = priorityLevels[priority] || priorityLevels.low;
  const fill = priority === 'high' ? colors.accentText : colors.text;

  return (
    <View
      style={styles.meter}
      accessible
      accessibilityLabel={`${tone.label} priority`}
    >
      <View style={styles.bars}>
        {[1, 2, 3].map((n) => (
          <View
            key={n}
            style={[
              styles.bar,
              { height: 4 + n * 4 },
              { backgroundColor: n <= tone.level ? fill : colors.lineStrong },
            ]}
          />
        ))}
      </View>
      {showLabel ? (
        <Text style={[styles.meterLabel, priority === 'high' && { color: colors.accentText }]}>
          {tone.label}
        </Text>
      ) : null}
    </View>
  );
}

export function PriorityPill({ priority }) {
  return <PriorityMeter priority={priority} />;
}

export function OpenPill({ isOpen }) {
  return isOpen ? (
    <Pill label="● Open" fg={colors.text} border={colors.text} />
  ) : (
    <Pill label="Closed" fg={colors.faint} border={colors.line} />
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  text: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  meter: { flexDirection: 'row', alignItems: 'flex-end' },
  bars: { flexDirection: 'row', alignItems: 'flex-end', height: 16 },
  bar: { width: 4, marginRight: 2 },
  meterLabel: {
    fontFamily: fonts.mono,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.muted,
    marginLeft: spacing.xs,
  },
});
