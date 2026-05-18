/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Instrument Serif', 'Georgia', 'serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      colors: {
        ink: {
          DEFAULT: '#1a1916',
          soft: '#3d3b36',
          50: '#f4f1ec',
          100: '#ebe7df',
          200: '#d4cfc4',
          300: '#a8a59c',
          400: '#6b6962',
          500: '#3d3b36',
          600: '#2a2925',
          700: '#1a1916',
          800: '#111110',
          900: '#0a0a09',
        },
        muted: {
          DEFAULT: '#6b6962',
          2: '#a8a59c',
        },
        paper: {
          DEFAULT: '#f4f1ec',   // page background
          card: '#ffffff',       // surface
          sunken: '#ebe7df',     // surface-2
        },
        // Accent — coral
        accent: {
          50:  '#fdf2ee',
          100: '#fbe3d8',
          200: '#f5beab',
          300: '#ee947a',
          400: '#e26d4f',
          500: '#d6492a',   
          600: '#b73a1f',
          700: '#922f1c',
          800: '#75281b',
          900: '#60221a',
          950: '#3d1610', 
        },
        // Semantic
        success: '#3a8a5e',
        warning: '#d49521',
        danger:  '#c43e2b',
      },
      letterSpacing: {
        tightish: '-0.015em',
        tight2: '-0.02em',
        tight3: '-0.025em',
      },
      borderRadius: {
        'xl2': '1.25rem',
        '3xl': '1.5rem',
      },
      keyframes: {
        'fade-in-up': {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'scale-in': {
          '0%': { opacity: '0', transform: 'scale(0.97)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        'slide-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        'checkmark-pop': {
          '0%': { transform: 'scale(0)', opacity: '0' },
          '60%': { transform: 'scale(1.2)', opacity: '1' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        'flash-accent': {
          '0%': { backgroundColor: 'rgb(214 73 42 / 0.18)' },
          '100%': { backgroundColor: 'transparent' },
        },
        'slide-out-left': {
          '0%': { transform: 'translateX(0)', opacity: '1' },
          '100%': { transform: 'translateX(-100%)', opacity: '0' },
        },
      },
      animation: {
        'fade-in-up': 'fade-in-up 0.35s ease-out',
        'shimmer': 'shimmer 1.5s ease-in-out infinite',
        'scale-in': 'scale-in 0.25s ease-out',
        'slide-up': 'slide-up 0.3s ease-out',
        'checkmark-pop': 'checkmark-pop 0.4s ease-out',
        'flash-green': 'flash-accent 0.8s ease-out', 
        'flash-accent': 'flash-accent 0.8s ease-out',
        'slide-out-left': 'slide-out-left 0.3s ease-out forwards',
      },
    },
  },
  plugins: [],
};
