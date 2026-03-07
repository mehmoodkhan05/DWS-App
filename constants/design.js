/**
 * Design system constants for consistent layout and styling.
 * All values use 4px grid for pixel-perfect placement.
 */

import { Platform } from 'react-native';

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  section: 20,
  screen: 16,
};

export const COLORS = {
  gold: '#d4af37',
  goldLight: '#fffbeb',
  white: '#ffffff',
  background: '#f9fafb',
  border: '#e5e7eb',
  borderLight: '#f3f4f6',
  text: '#111827',
  textSecondary: '#374151',
  textMuted: '#6b7280',
  textHint: '#9ca3af',
  inactive: '#b0b0b0',
};

export const CARD = {
  padding: 16,
  borderRadius: 12,
  borderWidth: 1,
  borderColor: COLORS.border,
  shadowColor: '#000',
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.08,
  shadowRadius: 6,
  elevation: 4,
};

export const TAB = {
  paddingH: 16,
  paddingV: 10,
  minHeight: 44,
  borderRadius: 22,
  gap: 8,
};

export const BOTTOM_TAB = {
  height: Platform.OS === 'ios' ? 72 : 64,
  paddingBottom: Platform.OS === 'ios' ? 24 : 12,
  marginH: 16,
  marginBottom: Platform.OS === 'ios' ? 28 : 12,
  borderRadius: 28,
  elevation: 16,
  shadowRadius: 12,
};
