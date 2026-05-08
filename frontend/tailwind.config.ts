import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        prime: {
          50:  '#f0edff',
          100: '#e3defe',
          200: '#cabffd',
          300: '#a897fb',
          400: '#8a6df8',
          500: '#6d46f5',
          600: '#5a2eeb',
          700: '#4a22d0',
          800: '#3d1eaa',
          900: '#331c87',
          950: '#1e0f5c',
        },
        surface: {
          DEFAULT: '#12121a',
          1: '#16161f',
          2: '#1c1c28',
          3: '#232334',
          4: '#2a2a40',
          5: '#32324c',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-jetbrains)', 'Menlo', 'monospace'],
      },
      animation: {
        'glow': 'glow 2s ease-in-out infinite alternate',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'orb-float': 'orbFloat 8s ease-in-out infinite',
        'spin-slow': 'spin 8s linear infinite',
        'typing': 'typing 1.4s steps(3) infinite',
      },
      keyframes: {
        glow: {
          '0%':   { boxShadow: '0 0 20px rgba(109, 70, 245, 0.3), 0 0 60px rgba(109, 70, 245, 0.1)' },
          '100%': { boxShadow: '0 0 40px rgba(109, 70, 245, 0.6), 0 0 100px rgba(109, 70, 245, 0.2)' },
        },
        slideUp: {
          '0%':   { opacity: '0', transform: 'translateY(16px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%':   { opacity: '0' },
          '100%': { opacity: '1' },
        },
        orbFloat: {
          '0%, 100%': { transform: 'translateY(0px) scale(1)' },
          '33%':      { transform: 'translateY(-30px) scale(1.05)' },
          '66%':      { transform: 'translateY(15px) scale(0.97)' },
        },
        typing: {
          '0%':   { content: '.' },
          '33%':  { content: '..' },
          '66%':  { content: '...' },
          '100%': { content: '' },
        },
      },
      backdropBlur: {
        xs: '2px',
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'prime-gradient': 'linear-gradient(135deg, #6d46f5 0%, #3b82f6 50%, #06b6d4 100%)',
        'prime-gradient-subtle': 'linear-gradient(135deg, rgba(109,70,245,0.15) 0%, rgba(59,130,246,0.15) 50%, rgba(6,182,212,0.15) 100%)',
      },
      boxShadow: {
        'glow-sm': '0 0 15px rgba(109, 70, 245, 0.3)',
        'glow-md': '0 0 30px rgba(109, 70, 245, 0.4)',
        'glow-lg': '0 0 60px rgba(109, 70, 245, 0.5)',
        'glass':   '0 4px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
      },
    },
  },
  plugins: [],
}

export default config
