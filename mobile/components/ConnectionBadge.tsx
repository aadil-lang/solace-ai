import React from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { theme } from '@/constants/theme';
import { ConnectionStatus } from '@/types';

interface ConnectionBadgeProps {
  status: ConnectionStatus;
}

export const ConnectionBadge: React.FC<ConnectionBadgeProps> = ({ status }) => {
  const getBadgeConfig = () => {
    switch (status) {
      case 'connected':
        return {
          bg: theme.colors.statusPillBgConnected,
          dotColor: theme.colors.statusConnected,
          text: 'Connected to Solace API',
          textColor: theme.colors.statusConnected,
        };
      case 'loading':
        return {
          bg: theme.colors.statusPillBgConnecting,
          dotColor: theme.colors.statusConnecting,
          text: 'Testing Connection...',
          textColor: theme.colors.statusConnecting,
        };
      case 'disconnected':
        return {
          bg: theme.colors.statusPillBgDisconnected,
          dotColor: theme.colors.statusDisconnected,
          text: 'Backend Unreachable',
          textColor: theme.colors.statusDisconnected,
        };
      case 'idle':
      default:
        return {
          bg: theme.colors.surfaceMuted,
          dotColor: theme.colors.textMuted,
          text: 'Backend Not Tested',
          textColor: theme.colors.textSecondary,
        };
    }
  };

  const config = getBadgeConfig();

  return (
    <View style={[styles.pill, { backgroundColor: config.bg }]}>
      {status === 'loading' ? (
        <ActivityIndicator size="small" color={config.textColor} style={styles.spinner} />
      ) : (
        <View style={[styles.dot, { backgroundColor: config.dotColor }]} />
      )}
      <Text style={[styles.label, { color: config.textColor }]}>
        {config.text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    borderRadius: theme.radius.full,
    alignSelf: 'center',
    gap: theme.spacing.sm,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  spinner: {
    marginRight: 2,
  },
  label: {
    fontSize: theme.typography.sizes.sm,
    fontWeight: theme.typography.weights.medium,
    letterSpacing: 0.2,
  },
});

