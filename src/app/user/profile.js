import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../../frontend/components/Button';
import Field from '../../frontend/components/Field';
import { useServices } from '../../frontend/state/ServicesStore';
import { colors, radius, spacing, type } from '../../frontend/theme';

const passwordRules = [
  { label: '8+ characters', test: (value) => value.length >= 8 },
  { label: '1 uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: '1 lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: '1 number', test: (value) => /\d/.test(value) },
  { label: '1 special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export default function UserProfile() {
  const router = useRouter();
  const { userEmail, setUserEmail } = useServices();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const passwordChecks = useMemo(
    () => passwordRules.map((rule) => ({ ...rule, met: rule.test(newPassword) })),
    [newPassword]
  );
  const confirmStatus = confirmPassword
    ? confirmPassword === newPassword
      ? 'Passwords match.'
      : 'Passwords do not match.'
    : 'Re-enter your new password.';
  const confirmError = confirmPassword && confirmPassword !== newPassword
    ? 'Passwords do not match.'
    : undefined;

  function savePassword() {
    setMessage('');
    setError('');
    if (passwordChecks.some((rule) => !rule.met)) {
      setError('Password does not meet all requirements.');
      return;
    }
    if (!confirmPassword || confirmPassword !== newPassword) {
      setError(confirmPassword ? 'Passwords do not match.' : 'Please confirm your password.');
      return;
    }
    setNewPassword('');
    setConfirmPassword('');
    setMessage('Password updated.');
  }

  function handleLogout() {
    setUserEmail('');
    router.replace('/login');
  }

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <Stack.Screen options={{ title: 'Profile' }} />
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Text style={type.title}>Profile</Text>

        <View style={styles.section}>
          <Text style={styles.sectionLabel}>ACCOUNT EMAIL</Text>
          <Text style={styles.email}>{userEmail || 'No email on file'}</Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Change password</Text>
          <Field
            label="New password"
            value={newPassword}
            onChangeText={(value) => {
              setNewPassword(value);
              setMessage('');
              setError('');
            }}
            placeholder="Enter a new password"
            secureTextEntry
            textContentType="none"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            maxLength={128}
            returnKeyType="next"
            required
          >
            <View style={styles.requirements}>
              <Text style={[type.label, styles.requirementsTitle]}>Password requirements</Text>
              {passwordChecks.map((rule) => (
                <View key={rule.label} style={styles.ruleRow}>
                  <Text style={[styles.ruleMark, rule.met && styles.ruleMarkMet]}>{rule.met ? '✓' : '•'}</Text>
                  <Text style={[type.secondary, rule.met && styles.ruleTextMet]}>{rule.label}</Text>
                </View>
              ))}
            </View>
          </Field>

          <Field
            label="Confirm new password"
            value={confirmPassword}
            onChangeText={(value) => {
              setConfirmPassword(value);
              setMessage('');
              setError('');
            }}
            error={confirmError}
            placeholder="Re-enter new password"
            helper={confirmStatus}
            secureTextEntry
            textContentType="none"
            autoComplete="off"
            autoCapitalize="none"
            autoCorrect={false}
            spellCheck={false}
            maxLength={128}
            returnKeyType="done"
            onSubmitEditing={savePassword}
            required
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}
          <Button label="Update password" onPress={savePassword} style={styles.updateButton} />
        </View>

        <Button
          label="Back to dashboard"
          variant="secondary"
          onPress={() => router.replace('/user/dashboard')}
          style={styles.dashboardButton}
        />
        <Button label="Log out" variant="danger" onPress={handleLogout} style={styles.logoutButton} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: spacing.lg,
    paddingBottom: spacing.xxxl,
  },
  section: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  sectionLabel: { ...type.label, fontSize: 10 },
  email: { ...type.body, marginTop: spacing.sm },
  sectionTitle: { ...type.heading, marginBottom: spacing.lg },
  requirements: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.raised,
    borderRadius: radius.sm,
  },
  requirementsTitle: { marginBottom: spacing.xs, fontSize: 10 },
  ruleRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing.xs },
  ruleMark: { width: 18, color: colors.muted, fontSize: 16, textAlign: 'center' },
  ruleMarkMet: { color: colors.accentText, fontWeight: '700' },
  ruleTextMet: { color: colors.accentText },
  error: { color: colors.accentText, fontSize: 13, fontWeight: '600' },
  success: { color: colors.accentText, fontSize: 13, fontWeight: '600' },
  updateButton: { marginTop: spacing.md },
  dashboardButton: { marginTop: spacing.xxl },
  logoutButton: { marginTop: spacing.md },
});
