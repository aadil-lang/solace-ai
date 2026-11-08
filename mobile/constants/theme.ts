/**
 * Solace AI - Design System Tokens & Theme Foundation
 *
 * Core aesthetic: Premium wellness, organic calm, generous whitespace,
 * restrained interaction feedback, accessible contrast.
 */

export const colors = {
  // Primary brand palette
  background: '#F8F6F1',       // Warm linen off-white
  surface: '#FFFFFF',          // Crisp white card surface
  surfaceMuted: '#F2EFE9',     // Slightly shaded background surface
  surfaceElevated: '#FFFFFF',  // Floating containers

  // Accent & Natural Tones
  sage: '#A8B9A0',             // Calming muted sage
  sageLight: '#E3EADF',        // Gentle sage tint
  sageDark: '#7A8E72',         // Deep sage for accents
  forest: '#34483D',           // Grounding deep pine/forest green
  forestLight: '#4B6354',      // Soft forest
  lavender: '#DCD7EE',         // Soothing meditative lavender
  lavenderLight: '#F1EFF8',    // Whisper lavender
  peach: '#F0D8C9',            // Warm organic peach
  peachLight: '#FAF2EC',       // Light morning peach

  // Typography & Content
  text: '#30332F',             // Deep charcoal slate (high contrast, softer than pure black)
  textSecondary: '#636A63',    // Midtone readable secondary
  textMuted: '#8D968D',        // Subtle helper text
  textInverse: '#F8F6F1',      // White/linen on dark backgrounds

  // Borders & Dividers
  border: '#E5E1D8',           // Soft warm hairline border
  borderFocus: '#A8B9A0',      // Sage active highlight

  // Status & Telemetry
  statusConnected: '#3F724D',  // Natural herbal green
  statusConnecting: '#D48C46', // Warm organic amber
  statusDisconnected: '#B5534B',// Terracotta red
  statusPillBgConnected: '#E5F1E8',
  statusPillBgDisconnected: '#F8E9E8',
  statusPillBgConnecting: '#FCF3E9',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 40,
  xxxl: 48,
} as const;

export const radius = {
  sm: 8,
  md: 14,
  lg: 20,
  xl: 28,
  full: 9999,
} as const;

export const typography = {
  sizes: {
    xs: 12,
    sm: 14,
    md: 16,
    lg: 18,
    xl: 22,
    xxl: 28,
    display: 34,
  },
  weights: {
    regular: '400' as const,
    medium: '500' as const,
    semibold: '600' as const,
    bold: '700' as const,
  },
  lineHeights: {
    tight: 1.25,
    normal: 1.5,
    relaxed: 1.65,
  },
} as const;

export const shadows = {
  soft: {
    shadowColor: '#30332F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  card: {
    shadowColor: '#34483D',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.07,
    shadowRadius: 16,
    elevation: 3,
  },
} as const;

export const theme = {
  colors,
  spacing,
  radius,
  typography,
  shadows,
} as const;

export type Theme = typeof theme;

