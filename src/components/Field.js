import React from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radius, spacing, type } from '../theme';

/**
 * A labelled text input that shows its own validation error.
 *
 * Errors describe what to do rather than only what is wrong, and they appear
 * under the field they belong to so the person does not have to hunt for the
 * problem.
 */
export default function Field({
  label,
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
}) {
  const hasError = Boolean(error);

  return (
    <View style={styles.wrapper}>
      <View style={styles.labelRow}>
        <Text style={type.label}>
          {label}
          {required ? <Text style={styles.required}> (required)</Text> : null}
        </Text>
        {showCounter && maxLength ? (
          <Text style={styles.counter}>
            {value.length}/{maxLength}
          </Text>
        ) : null}
      </View>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.slate}
        maxLength={maxLength}
        multiline={multiline}
        keyboardType={keyboardType}
        accessibilityLabel={label}
        style={[
          styles.input,
          multiline && styles.multiline,
          hasError && styles.inputError,
        ]}
      />

      {hasError ? (
        <Text style={styles.error}>{error}</Text>
      ) : helper ? (
        <Text style={styles.helper}>{helper}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: spacing.lg },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  required: { fontSize: 13, fontWeight: '400', color: colors.slate },
  counter: { fontSize: 12, color: colors.slate },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
    color: colors.ink,
    minHeight: 48,
  },
  multiline: { minHeight: 96, textAlignVertical: 'top' },
  inputError: { borderColor: colors.red, borderWidth: 1.5 },
  error: { marginTop: spacing.xs, fontSize: 13, color: colors.red },
  helper: { marginTop: spacing.xs, fontSize: 13, color: colors.slate },
});
