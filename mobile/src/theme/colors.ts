import designTokens from './designTokens.json';

/**
 * Single source of truth: `designTokens.json`.
 * This module maps those tokens to the `colors` object used across the app and NativeWind.
 */

const c = designTokens.colors;

export const colors = {
  // —— Stitch / design-system names (prefer in new code) ——
  primary: c.primary,
  primaryContainer: c.primaryContainer,
  /** Level 0 canvas */
  surface: c.surface,
  /** Level 1 sectioning */
  surfaceContainerLow: c.surfaceContainerLow,
  /** Level 2 interactive / cards */
  surfaceContainerLowest: c.surfaceContainerLowest,
  /** Progress tracks, subtle elevation tier */
  surfaceContainerHighest: c.surfaceContainerHighest,
  secondary: c.secondary,
  secondaryContainer: c.secondaryContainer,
  onSecondaryContainer: c.onSecondaryContainer,
  tertiary: c.tertiary,
  onSurface: c.onSurface,
  onPrimary: c.onPrimary,
  outlineVariant: c.outlineVariant,
  danger: c.danger,
  googleBlue: c.googleBlue,
  textSecondary: c.textSecondary,
  textMuted: c.textMuted,
  primaryMuted: c.primaryMuted,
  scrim: c.scrim,
  ambientShadow: c.ambientShadow,
  /** Ghost border (15% outline_variant) — design-system fallback when contrast needs an edge */
  outlineGhost: c.outlineGhost,

  // —— Legacy aliases (existing screens) —— same as Stitch mapping where applicable
  /** Same as `surface` (canvas) */
  background: c.surface,
  /** Card / sheet / input surfaces — was previously named `surface` */
  surfaceElevated: c.surfaceContainerLowest,
  /** Same as `surfaceContainerLow` */
  surfaceMuted: c.surfaceContainerLow,
  /** Same as `onSurface` — do not use pure black per design system */
  text: c.onSurface,
  /** Accent text / labels that were `primaryDark` */
  primaryDark: c.secondary,
  /**
   * Prefer `outlineGhost` for dividers. Kept for gradual migration; avoid 1px section borders per spec.
   */
  border: c.outlineGhost,
} as const;

export type AppColors = typeof colors;
