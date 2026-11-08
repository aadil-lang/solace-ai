import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';
import { Input } from '@/components/Input';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, continueAsGuest, isLoading, authError, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const validate = (): boolean => {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);
    clearError();

    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setEmailError('Please enter your email address.');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Please enter your password.');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      isValid = false;
    }

    return isValid;
  };

  const handleLogin = async () => {
    if (!validate()) return;
    const res = await signIn(email, password);
    if (!res.error) {
      // Navigation will be handled automatically by auth guard or router
      router.replace('/(tabs)');
    }
  };

  const handleGuest = async () => {
    await continueAsGuest();
    router.replace('/(tabs)');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header Branding */}
          <View style={styles.header}>
            <View style={styles.logoBadge}>
              <View style={styles.logoInner} />
            </View>
            <Text style={styles.brandTitle}>Solace</Text>
            <Text style={styles.tagline}>A little space to feel understood.</Text>
          </View>

          {/* Form Card */}
          <Card style={styles.formCard}>
            <Text style={styles.cardHeading}>Welcome Back</Text>
            <Text style={styles.cardSubheading}>
              Take a breath and settle into your mindful space.
            </Text>

            {authError && (
              <View style={styles.errorBanner}>
                <Ionicons
                  name="alert-circle-outline"
                  size={18}
                  color={theme.colors.statusDisconnected}
                  style={styles.errorIcon}
                />
                <Text style={styles.errorBannerText}>{authError}</Text>
              </View>
            )}

            <Input
              label="Email Address"
              placeholder="you@example.com"
              keyboardType="email-address"
              autoComplete="email"
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (emailError) setEmailError(null);
                if (authError) clearError();
              }}
              error={emailError}
              leftIcon="mail-outline"
            />

            <Input
              label="Password"
              placeholder="••••••••"
              isPassword
              value={password}
              onChangeText={(text) => {
                setPassword(text);
                if (passwordError) setPasswordError(null);
                if (authError) clearError();
              }}
              error={passwordError}
              leftIcon="lock-closed-outline"
            />

            <Button
              title="Sign In"
              onPress={handleLogin}
              loading={isLoading}
              style={styles.signInButton}
            />

            <View style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or</Text>
              <View style={styles.dividerLine} />
            </View>

            {/* Guest Experience Access */}
            <Button
              title="Explore as Guest"
              variant="outline"
              onPress={handleGuest}
              style={styles.guestButton}
              icon={
                <Ionicons
                  name="leaf-outline"
                  size={18}
                  color={theme.colors.forest}
                  style={{ marginRight: 6 }}
                />
              }
            />
            <Text style={styles.guestDisclaimer}>
              Guest mode lets you explore Solace without registering. Emotional data is kept locally on this device only.
            </Text>
          </Card>

          {/* Footer Switcher */}
          <View style={styles.footerRow}>
            <Text style={styles.footerPrompt}>Don&apos;t have an account yet?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/signup')}>
              <Text style={styles.footerLink}> Create account</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: theme.spacing.lg,
    paddingTop: theme.spacing.xl,
    paddingBottom: theme.spacing.xxl,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.xl,
  },
  logoBadge: {
    width: 60,
    height: 60,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.sm,
  },
  logoInner: {
    width: 28,
    height: 28,
    borderRadius: theme.radius.sm,
    backgroundColor: theme.colors.forest,
  },
  brandTitle: {
    fontSize: theme.typography.sizes.display,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    fontStyle: 'italic',
    marginTop: 2,
  },
  formCard: {
    backgroundColor: theme.colors.surface,
    padding: theme.spacing.xl,
    borderRadius: theme.radius.xl,
  },
  cardHeading: {
    fontSize: theme.typography.sizes.xl,
    fontWeight: theme.typography.weights.bold,
    color: theme.colors.forest,
    marginBottom: 4,
  },
  cardSubheading: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
    marginBottom: theme.spacing.lg,
    lineHeight: 18,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.statusPillBgDisconnected,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#F2C5C3',
  },
  errorIcon: {
    marginRight: theme.spacing.xs,
  },
  errorBannerText: {
    flex: 1,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.statusDisconnected,
    fontWeight: theme.typography.weights.medium,
  },
  signInButton: {
    marginTop: theme.spacing.sm,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: theme.spacing.lg,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: theme.colors.border,
  },
  dividerText: {
    paddingHorizontal: theme.spacing.md,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.textMuted,
  },
  guestButton: {
    borderColor: theme.colors.sage,
  },
  guestDisclaimer: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.sm,
    lineHeight: 15,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: theme.spacing.xl,
  },
  footerPrompt: {
    fontSize: theme.typography.sizes.sm,
    color: theme.colors.textSecondary,
  },
  footerLink: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.semibold,
    color: theme.colors.forest,
  },
});

