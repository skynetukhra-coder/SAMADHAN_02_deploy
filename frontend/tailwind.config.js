/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        govBlue: {
          light: '#2B589A',
          DEFAULT: '#0B3366', // Deep government blue
          dark: '#051D3D',
        },
        govGold: {
          light: '#E2C275',
          DEFAULT: '#B3913B', // Golden accents
          dark: '#826521',
        },
        govGray: {
          light: '#F8F9FC',
          DEFAULT: '#E9ECF4',
          dark: '#6E7A8A',
        }
      },
      fontFamily: {
        outfit: ['Outfit', 'Inter', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
