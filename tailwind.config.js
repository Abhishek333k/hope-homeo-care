/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./index.html",
    "./patient-portal.html",
    "./consent.html",
    "./privacy.html",
    "./terms.html",
    "./404.html",
    "./assets/js/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          50: '#f0f4f8',
          100: '#d9e2ec',
          200: '#bcccdc',
          300: '#9fb3c8',
          400: '#829ab1',
          500: '#627d98',
          600: '#486581',
          700: '#334e68',
          800: '#243b53',
          900: '#0d1925',
          950: '#060c12'
        },
        slate: {
          700: '#1e293b',
          800: '#0f172a',
          900: '#0B1320',
          950: '#060B13',
        },
        teal: {
          50: '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
          800: '#166534',
          900: '#14532d'
        }
      },
      fontFamily: {
        sans: ['Outfit', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
