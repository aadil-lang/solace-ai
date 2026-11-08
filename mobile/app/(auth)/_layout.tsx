import React from 'react';
import { Stack } from 'expo-router';
import { theme } from '@/constants/theme';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.background,
        },
        headerTintColor: theme.colors.forest,
        headerTitleStyle: {
          fontWeight: theme.typography.weights.semibold,
          color: theme.colors.forest,
        },
        headerShadowVisible: false,
        contentStyle: {
          backgroundColor: theme.colors.background,
        },
      }}
    >
      <Stack.Screen name="login" options={{ headerShown: false }} />
      <Stack.Screen name="signup" options={{ headerShown: false }} />
    </Stack>
  );
}

