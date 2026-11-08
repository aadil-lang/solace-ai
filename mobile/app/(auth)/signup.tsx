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

export default function SignupScreen() {
  const router = useRouter();
  const { signUp, isLoading, authError, clearError } = useAuthStore();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [fullNameError, setFullNameError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const [isSuccessMessage, setIsSuccessMessage] = useState<string | null>(null);

  const validate = (): boolean => {
    let isValid = true;
    setFullNameError(null);
    setEmailError(null);
    setPasswordError(null);
    setConfirmPasswordError(null);
    clearError();

    if (!fullName.trim()) {
      setFullNameError('Please let us know how to address you.');
      isValid = false;
    }

    const emailTrimmed = email.trim();
    if (!emailTrimmed) {
      setEmailError('Please enter your email address.');
      isValid = false;
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
      setEmailError('Please enter a valid email address.');
      isValid = false;
    }

    if (!password) {
      setPasswordError('Please create a password.');
      isValid = false;
    } else if (password.length < 6) {
      setPasswordError('Password must be at least 6 characters.');
      isValid = false;
    }

    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwords do not match.');
      isValid = false;
    }

    return isValid;
  };

  const handleSignup = async () => {
    if (!validate()) return;
    const res = await signUp(email, password, fullName);
    if (!res.error) {
      // If immediate session created, proceed to onboarding
      router.replace('/onboarding');
    } else if (res.error.toLowerCase().includes('confirm') || res.error.toLowerCase().includes('registered')) {
      setIsSuccessMessage(res.error);
    }
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
            <Text style={styles.cardHeading}>Begin Your Journey</Text>
            <Text style={styles.cardSubheading}>
              Create your private, mindful wellness account.
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

            {isSuccessMessage && (
              <View style={styles.successBanner}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={theme.colors.statusConnected}
                  style={styles.errorIcon}
                />
                <Text style={styles.successBannerText}>{isSuccessMessage}</Text>
              </View>
            )}

            <Input
              label="Your Name"
              placeholder="e.g. Aadil"
              value={fullName}
              onChangeText={(text) => {
                setFullName(text);
                if (fullNameError) setFullNameError(null);
              }}
              error={fullNameError}
              leftIcon="person-outline"
            />

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
              label="Create Password"
              placeholder="At least 6 characters"
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

            <Input
              label="Confirm Password"
              placeholder="Re-enter password"
              isPassword
              value={confirmPassword}
              onChangeText={(text) => {
                setConfirmPassword(text);
                if (confirmPasswordError) setConfirmPasswordError(null);
              }}
              error={confirmPasswordError}
              leftIcon="shield-checkmark-outline"
            />

            <Button
              title="Create Account"
              onPress={handleSignup}
              loading={isLoading}
              style={styles.signupButton}
            />

            <Text style={styles.privacyNote}>
              Your reflections are encrypted and private. We never share emotional data.
            </Text>
          </Card>

          {/* Footer Switcher */}
          <View style={styles.footerRow}>
            <Text style={styles.footerPrompt}>Already have an account?</Text>
            <TouchableOpacity onPress={() => router.push('/(auth)/login')}>
              <Text style={styles.footerLink}> Sign in</Text>
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
    paddingBottom: Platform.OS === 'android' ? 56 : theme.spacing.xxl,
    justifyContent: 'center',
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    marginBottom: theme.spacing.lg,
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
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.colors.statusPillBgConnected,
    padding: theme.spacing.sm,
    borderRadius: theme.radius.sm,
    marginBottom: theme.spacing.md,
    borderWidth: 1,
    borderColor: '#C2E0C9',
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
  successBannerText: {
    flex: 1,
    fontSize: theme.typography.sizes.xs,
    color: theme.colors.statusConnected,
    fontWeight: theme.typography.weights.medium,
  },
  signupButton: {
    marginTop: theme.spacing.sm,
  },
  privacyNote: {
    fontSize: 11,
    color: theme.colors.textMuted,
    textAlign: 'center',
    marginTop: theme.spacing.md,
    lineHeight: 16,
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

