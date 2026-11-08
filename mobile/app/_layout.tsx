import React, { useEffect } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '@/constants/theme';
import { useAuthStore } from '@/store/useAuthStore';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function NavigationGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const segments = useSegments();
  const { isInitialized, isLoading, user, isGuest, profile, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, [initialize]);

  useEffect(() => {
    if (!isInitialized) return;

    const inAuthGroup = segments[0] === '(auth)';
    const inOnboarding = segments[0] === 'onboarding';
    const isAuthenticated = Boolean(user || isGuest);

    if (!isAuthenticated) {
      // Unauthenticated users belong in (auth)
      if (!inAuthGroup) {
        router.replace('/(auth)/login');
      }
    } else {
      // Authenticated users
      if (inAuthGroup) {
        if (!isGuest && profile && !profile.onboarding_completed) {
          router.replace('/onboarding');
        } else {
          router.replace('/(tabs)');
        }
      }
    }
  }, [isInitialized, user, isGuest, profile, segments, router]);

  if (!isInitialized || isLoading) {
    return (
      <View style={styles.splashContainer}>
        <View style={styles.logoBadge}>
          <View style={styles.logoInner} />
        </View>
        <Text style={styles.brandTitle}>Solace</Text>
        <Text style={styles.tagline}>A little space to feel understood.</Text>
        <ActivityIndicator
          size="small"
          color={theme.colors.forest}
          style={styles.spinner}
        />
      </View>
    );
  }

  return <>{children}</>;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <StatusBar style="dark" />
        <NavigationGuard>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: {
                backgroundColor: theme.colors.background,
              },
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="(auth)" options={{ headerShown: false }} />
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="onboarding" options={{ headerShown: false }} />
          </Stack>
        </NavigationGuard>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    backgroundColor: theme.colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: theme.spacing.xl,
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
