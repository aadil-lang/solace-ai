import React from 'react';
import { View, StyleSheet, ViewProps } from 'react-native';
import { theme } from '@/constants/theme';

interface CardProps extends ViewProps {
  variant?: 'elevated' | 'flat' | 'outline';
  children: React.ReactNode;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = 'elevated',
  style,
  ...rest
}) => {
  return (
    <View
      style={[
        styles.base,
        variant === 'elevated' && styles.elevated,
        variant === 'flat' && styles.flat,
        variant === 'outline' && styles.outline,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    backgroundColor: theme.colors.surface,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  elevated: {
    ...theme.shadows.card,
  },
  flat: {
    backgroundColor: theme.colors.surfaceMuted,
  },
  outline: {
    borderWidth: 1,
    borderColor: theme.colors.border,
    backgroundColor: 'transparent',
  },
});

