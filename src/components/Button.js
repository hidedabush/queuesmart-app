import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, radius, spacing } from '../theme';

/**
 * variant: 'primary' | 'secondary' | 'danger'
 * Button labels say what happens when the button is used ("Save service"),
 * not what the form does ("Submit").
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  disabled = false,
  style,
}) {
  const palette = PALETTES[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !disabled && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

const PALETTES = {
  primary: { bg: colors.indigo, fg: colors.surface, border: colors.indigo },
  secondary: { bg: colors.surface, fg: colors.indigo, border: colors.line },
  danger: { bg: colors.surface, fg: colors.red, border: colors.redSoft },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
  disabled: { opacity: 0.45 },
  label: { fontSize: 15, fontWeight: '600' },
});
