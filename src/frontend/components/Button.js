import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radius, spacing, touch } from '../theme';

/**
 * variant: 'primary' | 'secondary' | 'danger'
 * size: 'lg' (full-width actions) | 'sm' (inline and toolbar actions)
 * Button labels say what happens when the button is used ("Save service"),
 * not what the form does ("Submit").
 */
export default function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'lg',
  disabled = false,
  accessibilityHint,
  style,
}) {
  const palette = PALETTES[variant];
  const small = size === 'sm';

  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled }}
      style={({ pressed, hovered }) => [
        styles.base,
        small && styles.small,
        { backgroundColor: palette.bg, borderColor: palette.border },
        hovered && !disabled && { backgroundColor: palette.hover },
        pressed && !disabled && { backgroundColor: palette.pressed },
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.label, small && styles.smallLabel, { color: palette.fg }]}>{label}</Text>
    </Pressable>
  );
}

const PALETTES = {
  primary: {
    bg: colors.accent,
    fg: colors.text,
    border: colors.accent,
    hover: colors.accentHover,
    pressed: colors.accentPressed,
  },
  secondary: {
    bg: 'transparent',
    fg: colors.text,
    border: colors.control,
    hover: colors.hover,
    pressed: colors.raised,
  },
  danger: {
    bg: 'transparent',
    fg: colors.accentText,
    border: colors.accent,
    hover: colors.accentSoft,
    pressed: colors.accentSoft,
  },
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
  small: { minHeight: touch - 4, paddingHorizontal: spacing.md },
  disabled: { opacity: 0.4 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  smallLabel: { fontSize: 13 },
});
