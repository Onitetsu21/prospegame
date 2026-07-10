/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // ── Fonds (dark mode, teinte très légèrement bleu-vert) ──
        base: '#0A0F14',       // fond global
        surface: '#10171E',    // panneaux (sidebar, topbar)
        card: '#141C24',       // cartes
        'card-hover': '#18222C',
        // ── Bordures ──
        line: '#1E2A35',
        'line-strong': '#2A3A48',
        // ── Turquoise (couleur principale) ──
        turq: {
          DEFAULT: '#2DD4BF',
          50: '#EBFEFB',
          100: '#CFFAF3',
          200: '#99F0E4',
          300: '#5EEAD4',
          400: '#2DD4BF',
          500: '#14B8A6',
          600: '#0D9488',
          700: '#0F766E',
        },
        // ── Texte ──
        ink: '#E8EEF2',
        'ink-2': '#93A4B3',
        'ink-3': '#5F7183',
        // ── Accents secondaires (charts, statuts) ──
        violet: '#A78BFA',
        amber: '#FBBF24',
        rose: '#FB7185',
        sky: '#38BDF8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px rgba(0,0,0,0.4), 0 8px 24px -12px rgba(0,0,0,0.5)',
        glow: '0 0 0 1px rgba(45,212,191,0.25), 0 8px 30px -8px rgba(45,212,191,0.25)',
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.35s cubic-bezier(0.16,1,0.3,1) both',
      },
    },
  },
  plugins: [],
};
