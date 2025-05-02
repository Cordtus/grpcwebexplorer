/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#1e1e1e',
        'dark-surface': '#252525',
        'dark-border': '#3c3c3c',
        'dark-highlight': '#2d2d2d',
        'blue-accent': '#0a84ff',
        'blue-accent-hover': '#0074e0',
        'text-primary': '#f0f0f0',
        'text-secondary': '#888',
        'error-red': '#FF605C',
        'warning-yellow': '#FFBD44',
        'success-green': '#00CA4E',
      }
    },
  },
  plugins: [],
}
