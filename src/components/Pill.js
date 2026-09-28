import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, priorityTone } from '../theme';

export default function Pill({ label, fg = colors.slate, bg = colors.paper }) {
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color: fg }]}>{label}</Text>
    </View>
  );
}

export function PriorityPill({ priority }) {
  const tone = priorityTone[priority] || priorityTone.low;
  return <Pill label={tone.label} fg={tone.fg} bg={tone.bg} />;
}

export function OpenPill({ isOpen }) {
  return isOpen ? (
    <Pill label="Open" fg={colors.green} bg={colors.greenSoft} />
  ) : (
    <Pill label="Closed" fg={colors.slate} bg={colors.paper} />
  );
}

const styles = StyleSheet.create({
  pill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: 'flex-start',
  },
  text: { fontSize: 12, fontWeight: '600' },
});
