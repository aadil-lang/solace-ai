import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';

export default function IndexGateway() {
  const router = useRouter();
  const { user, isGuest, profile, isInitialized } = useAuthStore();

  useEffect(() => {
    if (!isInitialized) return;

    if (user || isGuest) {
      if (!isGuest && profile && !profile.onboarding_completed) {
        router.replace('/onboarding');
      } else {
        router.replace('/(tabs)');
      }
    } else {
      router.replace('/(auth)/login');
    }
  }, [user, isGuest, profile, isInitialized, router]);

  return (
    <View style={styles.container}>
      <View style={styles.logoBadge}>
        <View style={styles.logoInner} />
      </View>
      <Text style={styles.brandTitle}>Solace</Text>
      <Text style={styles.tagline}>A little space to feel understood.</Text>
      <ActivityIndicator size="small" color={theme.colors.forest} style={styles.spinner} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoBadge: {
    width: 68,
    height: 68,
    borderRadius: theme.radius.xl,
    backgroundColor: theme.colors.sageLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: theme.spacing.md,
  },
  logoInner: {
    width: 32,
    height: 32,
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
    marginTop: 4,
  },
  spinner: {
    marginTop: theme.spacing.xl,
  },
});
