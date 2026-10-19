import { Stack, useRouter } from 'expo-router';
import { useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../frontend/components/Button';
import Field from '../frontend/components/Field';
import { useServices } from '../frontend/state/ServicesStore';
import { colors, spacing, type } from '../frontend/theme';

const passwordRules = [
  { label: '8+ characters', test: (value) => value.length >= 8 },
  { label: '1 uppercase letter', test: (value) => /[A-Z]/.test(value) },
  { label: '1 lowercase letter', test: (value) => /[a-z]/.test(value) },
  { label: '1 number', test: (value) => /\d/.test(value) },
  { label: '1 special character', test: (value) => /[^A-Za-z0-9]/.test(value) },
];

// Accepts MM/DD/YYYY and returns YYYY-MM-DD, or null if it is not a real,
// plausible date of birth.
function parseDob(value) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const [, mm, dd, yyyy] = match;
  const date = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
  const real =
    date.getFullYear() === Number(yyyy) &&
    date.getMonth() === Number(mm) - 1 &&
    date.getDate() === Number(dd);
  const age = (Date.now() - date.getTime()) / (365.25 * 24 * 3600 * 1000);
  if (!real || age < 0 || age > 120) return null;
  return `${yyyy}-${mm}-${dd}`;
}

export default function RegisterScreen() {
  const router = useRouter();
  const { setPatient } = useServices();
  const nameRef = useRef(null);
  const dobRef = useRef(null);
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const confirmPasswordRef = useRef(null);
  const [name, setName] = useState('');
  const [dob, setDob] = useState('');
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

    if (!name.trim()) {
      nextErrors.name = 'Enter your full legal name.';
    } else if (name.trim().split(/\s+/).length < 2) {
      nextErrors.name = 'Enter your first and last name.';
    }

    if (!dob.trim()) {
      nextErrors.dob = 'Date of birth is required.';
    } else if (!parseDob(dob)) {
      nextErrors.dob = 'Enter a real date as MM/DD/YYYY.';
    }

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
    setPatient({ name: name.trim().replace(/\s+/g, ' '), dob: parseDob(dob), email: email.trim() });
    router.replace('/user/dashboard');
  };

  const handleEmailSubmit = () => {
    if (password.trim()) {
      handleRegister();
      return;
    }
    passwordRef.current?.focus();
  };

  const confirmPasswordStatus = confirmPassword
    ? confirmPassword === password
      ? 'Passwords match.'
      : 'Passwords do not match.'
    : undefined;

  const confirmPasswordError =
    confirmPassword && confirmPassword !== password
      ? 'Passwords do not match.'
      : errors.confirmPassword;

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 24}
    >
      <ScrollView
        style={styles.screen}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Stack.Screen options={{ title: 'Register', headerShown: false }} />

        <View style={styles.header}>
          <Text style={[type.label, styles.eyebrow]}>New patient</Text>
          <Text style={styles.title}>Register</Text>
          <Text style={type.secondary}>
            The front desk confirms your name and date of birth when you arrive, so
            enter them exactly as they appear on your photo ID.
          </Text>
        </View>

        <View style={styles.card}>
          <Field
            label="Full legal name"
            value={name}
            onChangeText={(value) => {
              setName(value);
              if (errors.name) {
                setErrors((current) => ({ ...current, name: undefined }));
              }
            }}
            onSubmitEditing={() => dobRef.current?.focus()}
            error={errors.name}
            placeholder="First and last name"
            autoCapitalize="words"
            textContentType="name"
            maxLength={100}
            returnKeyType="next"
            inputRef={nameRef}
            required
          />

          <Field
            label="Date of birth"
            value={dob}
            onChangeText={(value) => {
              setDob(value);
              if (errors.dob) {
                setErrors((current) => ({ ...current, dob: undefined }));
              }
            }}
            onSubmitEditing={() => emailRef.current?.focus()}
            error={errors.dob}
            placeholder="MM/DD/YYYY"
            keyboardType="numbers-and-punctuation"
            maxLength={10}
            returnKeyType="next"
            inputRef={dobRef}
            required
          />

          <Field
            label="Email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (errors.email) {
                setErrors((current) => ({ ...current, email: undefined }));
              }
            }}
            onSubmitEditing={handleEmailSubmit}
            error={errors.email}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            maxLength={254}
            helper="Check-in updates and visit reminders go here."
            returnKeyType="next"
            inputRef={emailRef}
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
            onSubmitEditing={() => confirmPasswordRef.current?.focus()}
            error={errors.password}
            placeholder="Create a password"
            secureTextEntry
            textContentType="newPassword"
            maxLength={128}
            helper="Use a strong password to protect your patient account."
            returnKeyType="next"
            inputRef={passwordRef}
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
            onSubmitEditing={handleRegister}
            error={confirmPasswordError}
            placeholder="Re-enter your password"
            secureTextEntry
            textContentType="newPassword"
            maxLength={128}
            helper={confirmPasswordStatus || 'Retype the same password to confirm.'}
            returnKeyType="done"
            blurOnSubmit={false}
            inputRef={confirmPasswordRef}
            required
          />
        </View>

        <View style={styles.buttonWrap}>
          <Button label="Create account" onPress={handleRegister} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
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
