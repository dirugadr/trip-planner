/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        background: '#f8f9ff',
        surface: '#ffffff',
        'surface-container-low': '#eff4ff',
        'surface-container': '#e5eeff',
        'on-surface': '#0b1c30',
        'on-surface-variant': '#45464d',
        'outline-variant': '#c6c6cd',
        primary: '#000000',
        'on-primary': '#ffffff',
        secondary: '#0051d5',
        'on-secondary': '#ffffff',
        tertiary: '#b87500',
        'tertiary-container': '#ffe9c7',
        error: '#ba1a1a',
        'error-container': '#ffdad6',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
