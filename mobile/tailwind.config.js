/** @type {import('tailwindcss').Config} */
const { colors: dt } = require('./src/theme/designTokens.json');

module.exports = {
  content: ['./App.tsx', './index.ts', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      borderRadius: {
        xl: '24px',
        '2xl': '24px',
      },
      colors: {
        primary: dt.primary,
        'primary-container': dt.primaryContainer,
        surface: dt.surface,
        'surface-container-low': dt.surfaceContainerLow,
        'surface-container-lowest': dt.surfaceContainerLowest,
        'surface-container-highest': dt.surfaceContainerHighest,
        secondary: dt.secondary,
        'secondary-container': dt.secondaryContainer,
        'on-secondary-container': dt.onSecondaryContainer,
        tertiary: dt.tertiary,
        'on-surface': dt.onSurface,
        'on-primary': dt.onPrimary,
        'outline-variant': dt.outlineVariant,
        'outline-ghost': dt.outlineGhost,
        danger: dt.danger,
        'google-blue': dt.googleBlue,
        'text-secondary': dt.textSecondary,
        'text-muted': dt.textMuted,
        'primary-muted': dt.primaryMuted,
        scrim: dt.scrim,
        // Legacy utility names (align with `colors.ts` aliases)
        background: dt.surface,
        text: dt.onSurface,
        border: dt.outlineGhost,
      },
    },
  },
  plugins: [],
};
