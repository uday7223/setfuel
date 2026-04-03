/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./App.tsx', './index.ts', './src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors: {
        background: '#F0F4F8',
        surface: '#FFFFFF',
        'surface-muted': '#E8EEF4',
        text: '#0F172A',
        'text-secondary': '#64748B',
        'text-muted': '#94A3B8',
        primary: '#0D9488',
        'primary-dark': '#0F766E',
        'primary-muted': '#CCFBF1',
        border: '#E2E8F0',
        danger: '#DC2626',
        'google-blue': '#4285F4',
      },
    },
  },
  plugins: [],
};
