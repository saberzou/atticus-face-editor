/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Instrument Serif"', 'serif'],
        sans: ['Sora', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      colors: {
        bg: { DEFAULT: 'oklch(0.16 0.012 55)', deep: 'oklch(0.11 0.010 55)' },
        surface: { DEFAULT: 'oklch(0.20 0.014 55)', 2: 'oklch(0.24 0.016 55)' },
        line: { DEFAULT: 'oklch(0.30 0.020 55)' },
        ink: { DEFAULT: 'oklch(0.96 0.012 80)', dim: 'oklch(0.74 0.014 70)', faint: 'oklch(0.55 0.014 65)' },
        orange: { DEFAULT: 'oklch(0.78 0.18 55)', deep: 'oklch(0.66 0.21 45)' },
        good: 'oklch(0.78 0.16 145)',
        bad: 'oklch(0.68 0.20 25)',
      },
      boxShadow: {
        stage: '0 24px 60px oklch(0 0 0 / 0.55), inset 0 0 0 1px oklch(0.30 0.020 55)',
        glow: '0 4px 14px oklch(0.78 0.18 55 / 0.30)',
      },
    },
  },
  plugins: [],
}
