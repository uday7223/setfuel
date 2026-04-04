/**
 * Editorial type scale — “Mindful Kinetic” (Stitch).
 * Load Inter + Manrope via expo-font before relying on fontFamily on all platforms.
 */
export const typography = {
  fontFamily: {
    /** Display & headlines */
    sans: 'Inter',
    /** Labels / data (Manrope) */
    label: 'Manrope',
  },
  /** Display & headlines — Inter 800 */
  displayLg: { fontSize: 36, fontWeight: '800' as const, lineHeight: 42 },
  headlineLg: { fontSize: 28, fontWeight: '800' as const, lineHeight: 34 },
  /** Titles — Inter 600 */
  titleLg: { fontSize: 18, fontWeight: '600' as const, lineHeight: 24 },
  /** Body — Inter 400–500, 1.6 line height */
  bodyLg: { fontSize: 16, fontWeight: '400' as const, lineHeight: 25.6 },
  bodyMd: { fontSize: 15, fontWeight: '400' as const, lineHeight: 24 },
  /** Labels — Manrope 700 */
  labelMd: { fontSize: 13, fontWeight: '700' as const, lineHeight: 18 },
  labelSm: { fontSize: 11, fontWeight: '700' as const, lineHeight: 14, letterSpacing: 0.8 },
} as const;
