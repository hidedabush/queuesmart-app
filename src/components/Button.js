import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';

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
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !disabled && { backgroundColor: palette.pressed },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

const PALETTES = {
  primary: { bg: colors.accent, fg: colors.text, border: colors.accent, pressed: '#B5141F' },
  secondary: { bg: 'transparent', fg: colors.text, border: colors.lineStrong, pressed: colors.raised },
  danger: { bg: 'transparent', fg: colors.accentText, border: colors.accent, pressed: colors.accentSoft },
};

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
});
