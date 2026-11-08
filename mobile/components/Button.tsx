import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
  Platform,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import { theme } from '@/constants/theme';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  icon?: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled = false,
  style,
  textStyle,
  icon,
}) => {
  const handlePress = async () => {
    if (disabled || loading) return;
    if (Platform.OS !== 'web') {
      try {
        await Haptics.selectionAsync();
      } catch {
        // Fallback
      }
    }
    onPress();
  };

  const isInteractive = !disabled && !loading;

  return (
    <TouchableOpacity
      onPress={handlePress}
      disabled={!isInteractive}
      activeOpacity={0.82}
      style={[
        styles.base,
        styles[variant],
        styles[size],
        !isInteractive && styles.disabled,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={
            variant === 'primary' ? theme.colors.background : theme.colors.forest
          }
        />
      ) : (
        <>
          {icon}
          <Text
            style={[
              styles.textBase,
              styles[`${variant}Text` as keyof typeof styles],
              styles[`${size}Text` as keyof typeof styles],
              !isInteractive && styles.disabledText,
              icon ? styles.textWithIcon : null,
              textStyle,
            ]}
          >
            {title}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: theme.radius.md,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  primary: {
    backgroundColor: theme.colors.forest,
    borderColor: theme.colors.forest,
  },
  secondary: {
    backgroundColor: theme.colors.sage,
    borderColor: theme.colors.sage,
  },
  outline: {
    backgroundColor: 'transparent',
    borderColor: theme.colors.forest,
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  sm: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: theme.radius.sm,
  },
  md: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: theme.radius.md,
  },
  lg: {
    paddingVertical: 18,
    paddingHorizontal: 32,
    borderRadius: theme.radius.lg,
  },
  disabled: {
    opacity: 0.5,
  },
  textBase: {
    fontWeight: theme.typography.weights.semibold,
    textAlign: 'center',
    letterSpacing: 0.2,
  },
  primaryText: {
    color: theme.colors.background,
  },
  secondaryText: {
    color: theme.colors.text,
  },
  outlineText: {
    color: theme.colors.forest,
  },
  ghostText: {
    color: theme.colors.forest,
  },
  smText: {
    fontSize: theme.typography.sizes.sm,
  },
  mdText: {
    fontSize: theme.typography.sizes.md,
  },
  lgText: {
    fontSize: theme.typography.sizes.lg,
  },
  disabledText: {
    color: theme.colors.textMuted,
  },
  textWithIcon: {
    marginLeft: theme.spacing.sm,
  },
});

