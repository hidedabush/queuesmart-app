import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, spacing, type } from '../theme';

/**
 * A labelled text input that shows its own validation error.
 *
 * Errors describe what to do rather than only what is wrong, and they appear
 * under the field they belong to so the person does not have to hunt for the
 * problem.
 */
export default function Field({
  label,
  index,
  value,
  onChangeText,
  error,
  required = false,
  helper,
  maxLength,
  multiline = false,
  keyboardType = 'default',
  placeholder,
  showCounter = false,
  suffix,
  children,
}) {
  const [focused, setFocused] = useState(false);
  const hasError = Boolean(error);
  const counter =
    showCounter && maxLength
      ? `${String(value.length).padStart(String(maxLength).length, '0')}/${maxLength}`
      : null;

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={type.label}>
          {index ? <Text style={styles.index}>{index} </Text> : null}
          {label}
          {required ? <Text style={styles.required}> *</Text> : null}
        </Text>
        {counter ? (
          <Text
            style={[
              type.label,
              value.length >= maxLength && { color: colors.accentText },
            ]}
          >
            {counter}
          </Text>
        ) : null}
      </View>

      <View
        style={[
          styles.inputBox,
          focused && styles.inputFocused,
          hasError && styles.inputError,
        ]}
      >
        <TextInput
          value={value}
          onChangeText={onChangeText}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.faint}
          selectionColor={colors.accent}
          keyboardAppearance="dark"
          maxLength={maxLength}
          multiline={multiline}
          keyboardType={keyboardType}
          accessibilityLabel={label}
          accessibilityHint={hasError ? error : helper}
          style={[
            styles.input,
            multiline && styles.multiline,
            suffix && styles.inputWithSuffix,
          ]}
        />
        {suffix ? <Text style={styles.suffix}>{suffix}</Text> : null}
      </View>

      {children}

      {hasError ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          ✕ {error}
        </Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.xl },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  index: { color: colors.accentText },
  required: { color: colors.accentText },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.sm,
  },
  inputFocused: { borderColor: colors.text },
  inputError: { borderColor: colors.accentText, borderLeftWidth: 4 },
  input: {
    flex: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.text,
    minHeight: 52,
  },
  inputWithSuffix: { fontFamily: fonts.mono, fontSize: 20, fontWeight: '700' },
  multiline: { minHeight: 104, textAlignVertical: 'top' },
  suffix: { ...type.label, paddingRight: spacing.md },
  error: {
    marginTop: spacing.sm,
    fontSize: 14,
    fontWeight: '600',
    color: colors.accentText,
  },
  helper: { ...type.secondary, marginTop: spacing.sm },
});
