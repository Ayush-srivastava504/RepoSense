/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f8f4f0',
          100: '#f0e8e0',
          500: '#e38024',
          600: '#cb471b',
          700: '#a54c1f',
          800: '#8b3d1b',
          900: '#6b3018',
        },
      },
    },
  },
  plugins: [],
};