/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica', 'Arial', 'sans-serif'],
        mono: ['Fira Code', 'Courier New', 'Courier', 'monospace'],
      },
      animation: {
        'ticker-scroll': 'ticker-scroll 25s linear infinite',
        'pulse-ring': 'pulse-ring 1.5s infinite',
        'fade-in': 'fade-in 0.2s ease-out',
        'scale-up': 'scale-up 0.25s cubic-bezier(0.34, 1.56, 0.64, 1)',
        'spin-slow': 'spin 0.8s linear infinite',
        'slide-in': 'slide-in 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-out': 'slide-out 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
      },
      keyframes: {
        'ticker-scroll': {
          '0%': { transform: 'translateX(0)' },
          '100%': { transform: 'translateX(-50%)' },
        },
        'pulse-ring': {
          '0%': { transform: 'scale(0.9)', opacity: '1' },
          '50%': { transform: 'scale(1.1)', opacity: '0.5' },
          '100%': { transform: 'scale(0.9)', opacity: '1' },
        },
        'fade-in': {
          'from': { opacity: '0', transform: 'translateY(4px)' },
          'to': { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-up': {
          'from': { transform: 'scale(0.95)', opacity: '0' },
          'to': { transform: 'scale(1)', opacity: '1' },
        },
        'slide-in': {
          'from': { opacity: '0', transform: 'translateX(-16px)' },
          'to': { opacity: '1', transform: 'translateX(0)' },
        },
        'slide-out': {
          'from': { opacity: '1', transform: 'translateX(0)' },
          'to': { opacity: '0', transform: 'translateX(-16px)' },
        },
      },
    },
  },
  plugins: [],
}
