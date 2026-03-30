import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fff5ef',
          100: '#ffe8d7',
          200: '#ffd0ae',
          300: '#ffb37f',
          400: '#f88d4d',
          500: '#ea6f27',
          600: '#d45a16',
          700: '#ae4513',
          800: '#8b3815',
          900: '#7c3316',
        },
        olive: {
          50: '#f6f8ed',
          100: '#e7ecd0',
          200: '#d1daa7',
          300: '#b6c475',
          400: '#99aa4f',
          500: '#7f8d3a',
          600: '#64702d',
          700: '#4d5625',
          800: '#404620',
          900: '#373d1f',
        },
        ink: '#1f1a17',
        sand: '#f6efe6',
      },
      boxShadow: {
        soft: '0 20px 50px -30px rgba(66, 31, 10, 0.35)',
        card: '0 16px 32px -24px rgba(29, 18, 11, 0.24)',
      },
      borderRadius: {
        '4xl': '2rem',
      },
      fontFamily: {
        sans: ['Noto Sans Arabic', 'IBM Plex Sans Arabic', 'Segoe UI', 'Tahoma', 'sans-serif'],
        display: ['Noto Sans Arabic', 'IBM Plex Sans Arabic', 'Segoe UI', 'Tahoma', 'sans-serif'],
      },
      backgroundImage: {
        grain:
          "radial-gradient(circle at top left, rgba(255,255,255,0.88), transparent 42%), radial-gradient(circle at bottom right, rgba(255,203,145,0.22), transparent 34%)",
      },
    },
  },
  plugins: [],
} satisfies Config;
