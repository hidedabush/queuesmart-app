import { Stack, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../frontend/components/Button';
import Field from '../frontend/components/Field';
import { colors, spacing, type } from '../frontend/theme';

const passwordRules = [
  { label: '8+ characters', test: (value) => value.length >= 8 },
  { label: '1 uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: '1 lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: '1 number', test: (value) => /\d/.test(value) },
  { label: '1 special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

export default function RegisterScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errors, setErrors] = useState({});

  const passwordChecks = useMemo(
    () => passwordRules.map((rule) => ({ ...rule, met: rule.test(password) })),
    [password]
  );

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const validate = () => {
    const nextErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'Email is required.';
    } else if (!validateEmail(email)) {
      nextErrors.email = 'Enter a valid email address.';
    }

    if (!password) {
      nextErrors.password = 'Password is required.';
    } else if (passwordChecks.some((rule) => !rule.met)) {
      nextErrors.password = 'Password does not meet all requirements.';
    }

    if (!confirmPassword) {
      nextErrors.confirmPassword = 'Please confirm your password.';
    } else if (confirmPassword !== password) {
      nextErrors.confirmPassword = 'Passwords do not match.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleRegister = () => {
    if (!validate()) return;
    router.replace('/user/join-queue');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: 'Register', headerShown: false }} />

      <View style={styles.header}>
        <Text style={[type.label, styles.eyebrow]}>Create account</Text>
        <Text style={styles.title}>Register</Text>
        <Text style={type.secondary}>Your email will be used as your username for queue access.</Text>
      </View>

      <View style={styles.card}>
        <Field
          label="Email"
          value={email}
          onChangeText={(value) => {
            setEmail(value);
            if (errors.email) {
              setErrors((current) => ({ ...current, email: undefined }));
            }
          }}
          error={errors.email}
          placeholder="name@school.edu"
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          textContentType="emailAddress"
          maxLength={254}
          helper="Use your school or office email address."
          required
        />

        <Field
          label="Password"
          value={password}
          onChangeText={(value) => {
            setPassword(value);
            if (errors.password) {
              setErrors((current) => ({ ...current, password: undefined }));
            }
          }}
          error={errors.password}
          placeholder="Create a password"
          secureTextEntry
          textContentType="newPassword"
          maxLength={128}
          helper="Use a strong password to protect your queue account."
          required
        >
          <View style={styles.requirementsBox}>
            <Text style={[type.label, styles.requirementsTitle]}>Password requirements</Text>
            {passwordChecks.map((rule) => (
              <View key={rule.label} style={styles.ruleRow}>
                <Text style={[styles.ruleDot, rule.met && styles.ruleDotMet]}>{rule.met ? '✓' : '•'}</Text>
                <Text style={[type.secondary, rule.met && styles.ruleMet]}>{rule.label}</Text>
              </View>
            ))}
          </View>
        </Field>

        <Field
          label="Confirm password"
          value={confirmPassword}
          onChangeText={(value) => {
            setConfirmPassword(value);
            if (errors.confirmPassword) {
              setErrors((current) => ({ ...current, confirmPassword: undefined }));
            }
          }}
          error={errors.confirmPassword}
          placeholder="Re-enter your password"
          secureTextEntry
          textContentType="newPassword"
          maxLength={128}
          helper="Retype the same password to confirm."
          required
        />
      </View>

      <View style={styles.buttonWrap}>
        <Button label="Create account" onPress={handleRegister} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: 72,
    paddingBottom: spacing.xxl,
  },
  header: {
    marginBottom: spacing.xl,
  },
  eyebrow: {
    color: colors.accentText,
  },
  title: {
    ...type.display,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.accentSoftStrong,
    borderTopWidth: 3,
    borderTopColor: colors.accent,
    borderRadius: 12,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  requirementsBox: {
    marginTop: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.accentSoftStrong,
    backgroundColor: colors.accentSoft,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingBottom: spacing.sm,
  },
  requirementsTitle: {
    marginBottom: spacing.sm,
  },
  ruleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  ruleDot: {
    width: 18,
    color: colors.muted,
    fontSize: 18,
    textAlign: 'center',
  },
  ruleDotMet: {
    color: colors.accentText,
    fontWeight: '700',
  },
  ruleMet: {
    color: colors.accentText,
  },
  buttonWrap: {
    marginTop: spacing.sm,
  },
});
