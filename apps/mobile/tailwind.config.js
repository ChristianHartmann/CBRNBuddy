/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        fw: {
          red: '#C62828',
          orange: '#FF8F00',
        },
        surface: {
          DEFAULT: '#1E1E1E',
          light: '#2C2C2C',
        },
        danger: '#F44336',
        success: '#4CAF50',
        warning: '#FF9800',
        info: '#2196F3',
      },
      backgroundColor: {
        app: '#121212',
      },
    },
  },
  plugins: [],
};
