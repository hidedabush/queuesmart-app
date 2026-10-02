import { Stack, useRouter } from 'expo-router';
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Button from '../frontend/components/Button';
import Field from '../frontend/components/Field';
import { spacing, type } from '../frontend/theme';

export default function AdminLoginScreen() {
  const router = useRouter();
  const emailRef = useRef(null);
  const passwordRef = useRef(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState({});

  const validateEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

  const validate = () => {
    const nextErrors = {};

    if (!email.trim()) {
      nextErrors.email = 'Administrator email is required.';
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

  const handleLogin = () => {
    if (!validate()) return;
    router.replace('/admin/dashboard');
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
        <Stack.Screen options={{ title: 'Admin Login', headerShown: false }} />

        <View style={styles.header}>
          <Text style={type.label}>QueueSmart admin</Text>
          <Text style={styles.title}>Administrator access</Text>
          <Text style={type.secondary}>Use your organization-issued credentials to manage services and queues.</Text>
        </View>

        <View style={styles.card}>
          <Field
            label="Admin email"
            value={email}
            onChangeText={(value) => {
              setEmail(value);
              if (errors.email) {
                setErrors((current) => ({ ...current, email: undefined }));
              }
            }}
            onSubmitEditing={handleEmailSubmit}
            error={errors.email}
            placeholder="admin@school.edu"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            textContentType="emailAddress"
            maxLength={254}
            helper="Use the email assigned to your administrator account."
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
            placeholder="Enter password"
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

        <Button label="Admin login" onPress={handleLogin} />

        <Pressable
          style={styles.backLink}
          onPress={() => router.back()}
          accessibilityRole="button"
          accessibilityLabel="Return to user login"
        >
          <Text style={styles.backText}>← Back to user login</Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#090909',
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
    color: '#F5F5F5',
    marginTop: spacing.sm,
    marginBottom: spacing.sm,
  },
  card: {
    backgroundColor: '#121212',
    borderWidth: 3,
    borderColor: '#4A2F2A',
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
    color: '#A24A4A',
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  backLink: {
    marginTop: spacing.xl,
    alignItems: 'center',
  },
  backText: {
    color: '#A24A4A',
    fontWeight: '700',
  },
});
