import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['Russo One', 'sans-serif'],
        sans:    ['Chakra Petch', 'sans-serif'],
      },
      colors: {
        void:    '#0F0F23',
        surface: '#13132B',
        elevated:'#1C1C40',
        'neon-purple':       '#7C3AED',
        'neon-purple-light': '#A78BFA',
        'neon-pink':         '#F43F5E',
        'neon-cyan':         '#06B6D4',
        'bg': {
          primary: '#0F0F23',
          surface: '#13132B',
        },
        'game-border': '#2D3148',
        correct: '#22C55E',
        partial: '#EAB308',
        wrong:   '#374151',
        arrow:   '#EF4444',
      },
      boxShadow: {
        'neon-purple': '0 0 20px rgba(124, 58, 237, 0.4)',
        'neon-pink':   '0 0 20px rgba(244, 63, 94, 0.4)',
        'neon-cyan':   '0 0 20px rgba(6, 182, 212, 0.4)',
        'neon-sm':     '0 0 10px rgba(124, 58, 237, 0.3)',
      },
      backgroundImage: {
        'grid-pattern': "linear-gradient(rgba(124,58,237,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.03) 1px, transparent 1px)",
      },
      backgroundSize: {
        'grid': '40px 40px',
      },
    },
  },
  plugins: [],
}

export default config
