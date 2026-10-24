import { Stack, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../frontend/components/Button';
import Field from '../frontend/components/Field';
import { useServices } from '../frontend/state/ServicesStore';
import { colors, spacing, type } from '../frontend/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { login, role } = useServices();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState('');

  // Move on once the server has accepted the login.
  useEffect(() => {
    if (role === 'user') router.replace('/user/dashboard');
  }, [role, router]);

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
    } else if (password.length < 8) {
      nextErrors.password = 'Password must be at least 8 characters.';
    }

    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleLogin = async () => {
    if (submitting) return;
    if (!validate()) {
      if (!email.trim() || !validateEmail(email)) {
        emailRef.current?.focus();
      } else {
        passwordRef.current?.focus();
      }
      return;
    }
    setServerError('');
    setSubmitting(true);
    const result = await login(email.trim(), password, 'user');
    setSubmitting(false);
    if (!result.error) return;
    if (result.fields) {
      setErrors((current) => ({ ...current, ...result.fields }));
    } else {
      setServerError(result.message);
    }
  };

  const handleEmailSubmit = () => {
    if (password.trim()) {
      handleLogin();
      return;
    }
    passwordRef.current?.focus();
  };

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
        <Stack.Screen options={{ title: 'Login', headerShown: false }} />

        <View style={styles.header}>
          <Text style={type.label}>QueueSmart</Text>
          <Text style={styles.title}>Welcome back</Text>
          <Text style={type.secondary}>Sign in to check in for a same-day visit and follow your place in line.</Text>
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
            onSubmitEditing={handleEmailSubmit}
            error={errors.email}
            placeholder="name@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            maxLength={254}
            helper="Use the email you registered with."
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
            onSubmitEditing={handleLogin}
            error={errors.password}
            placeholder="Enter your password"
            secureTextEntry={!showPassword}
            textContentType="password"
            maxLength={128}
            returnKeyType="done"
            blurOnSubmit={false}
            inputRef={passwordRef}
            required
            children={
              <Pressable
                style={styles.showToggle}
                onPress={() => setShowPassword((current) => !current)}
                accessibilityRole="button"
                accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              >
                <Text style={styles.showToggleText}>{showPassword ? 'Hide' : 'Show'}</Text>
              </Pressable>
            }
          />
        </View>

        {serverError ? <Text style={styles.serverError}>{serverError}</Text> : null}
        <Button label={submitting ? 'Signing in…' : 'Login'} onPress={handleLogin} />
        <View style={styles.metaRow}>
          <Text style={type.secondary}>Don’t have an account?</Text>
          <Pressable onPress={() => router.push('/register')} accessibilityRole="link">
            <Text style={styles.link}>Register here</Text>
          </Pressable>
        </View>

        <Pressable
          style={styles.adminCard}
          onPress={() => router.push('/admin-login')}
          accessibilityRole="button"
          accessibilityLabel="Open office staff sign in"
        >
          <View style={styles.adminIconWrap} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <View style={styles.lockShackle} />
            <View style={styles.lockBody} />
          </View>
          <Text style={styles.adminText}>Office staff sign in</Text>
          <Text style={styles.adminArrow}>→</Text>
        </Pressable>
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
  title: {
    ...type.display,
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    padding: spacing.xl,
    marginBottom: spacing.xl,
  },
  showToggle: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    marginLeft: spacing.sm,
  },
  showToggleText: {
    color: colors.accentText,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.xl,
    gap: 4,
  },
  link: {
    color: colors.accentText,
    fontWeight: '700',
  },
  adminCard: {
    marginTop: spacing.xl,
    borderWidth: 1,
    borderColor: colors.accentText,
    backgroundColor: 'rgba(255, 77, 90, 0.08)',
    borderRadius: 12,
    padding: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  adminIconWrap: {
    width: 18,
    height: 18,
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  lockShackle: {
    width: 10,
    height: 10,
    borderWidth: 2,
    borderColor: colors.accentText,
    borderBottomWidth: 0,
    borderRadius: 8,
    position: 'absolute',
    top: 0,
  },
  lockBody: {
    width: 14,
    height: 11,
    borderWidth: 2,
    borderColor: colors.accentText,
    borderRadius: 4,
    backgroundColor: 'transparent',
    marginTop: 4,
  },
  adminText: {
    flex: 1,
    color: colors.text,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  adminArrow: {
    color: colors.accentText,
    fontSize: 22,
    fontWeight: '700',
  },
  serverError: {
    color: colors.accentText,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: spacing.md,
  },
});
