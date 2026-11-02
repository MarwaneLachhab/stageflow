import type { Config } from 'tailwindcss'

/**
 * Tailwind configuration.
 *
 * The design tokens below were extracted from the reference mockups in
 * `stageflow_11_mockups/`. See `docs/DESIGN_REFERENCE_MAP.md` for the mapping
 * between each token and the screen it was measured from.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        /* Primary action blue — buttons, links, active navigation (mockups) */
        primary: {
          DEFAULT: '#2563EB',
          50: '#EFF4FF',
          100: '#DBE6FE',
          200: '#BFD3FE',
          300: '#93B4FD',
          400: '#6090FA',
          500: '#3B76F6',
          600: '#2563EB',
          700: '#1D4ED8',
          800: '#1E40AF',
          900: '#1E3A8A',
        },
        /* Navy sidebar / dark brand surface */
        navy: {
          DEFAULT: '#0B1736',
          700: '#111C3D',
          800: '#0E1830',
          900: '#0B1736',
          950: '#070F23',
        },
        /* Neutral canvas and surfaces */
        canvas: '#F8FAFC',
        surface: '#FFFFFF',
        border: {
          DEFAULT: '#E9EEF6',
          strong: '#DCE3EE',
        },
        /* Text scale */
        ink: {
          DEFAULT: '#0F172A',
          muted: '#64748B',
          subtle: '#94A3B8',
          faint: '#CBD5E1',
        },
        /* Semantic status colours (badges, KPI tiles) */
        success: { DEFAULT: '#047857', bg: '#ECFDF5', border: '#A7F3D0' },
        warning: { DEFAULT: '#B45309', bg: '#FFFBEB', border: '#FDE68A' },
        danger: { DEFAULT: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
        info: { DEFAULT: '#1D4ED8', bg: '#EFF6FF', border: '#BFDBFE' },
        neutral: { DEFAULT: '#475569', bg: '#F1F5F9', border: '#E2E8F0' },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '14px',
        control: '10px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(15, 23, 42, 0.04)',
        raised: '0 4px 16px -2px rgba(15, 23, 42, 0.08)',
        overlay: '0 24px 48px -12px rgba(15, 23, 42, 0.25)',
        focus: '0 0 0 3px rgba(37, 99, 235, 0.18)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(16px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'slide-in-right': 'slide-in-right 220ms ease-out',
        shimmer: 'shimmer 1.6s infinite',
      },
    },
  },
  plugins: [],
}

export default config
