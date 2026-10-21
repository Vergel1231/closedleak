/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#FDF8EB',
          100: '#FAEFC6',
          200: '#F3DD8A',
          300: '#E9C954',
          400: '#D4AF37',
          500: '#BD962C',
          600: '#9C7A22',
          700: '#7B5E1A',
          800: '#5A4313',
          900: '#3A2C0C',
        },
        accent: {
          50: '#F0FDF4',
          100: '#DCFCE7',
          200: '#BBF7D0',
          300: '#86EFAC',
          400: '#22C55E',
          500: '#16A34A',
          600: '#15803D',
          700: '#166534',
          800: '#14532D',
          900: '#052E16',
        },
        ink: {
          50: '#F8F7F5',
          100: '#EDEAE5',
          200: '#D6D0C6',
          300: '#A89F8E',
          400: '#7A7060',
          500: '#5C5345',
          600: '#443C30',
          700: '#332C22',
          800: '#221E17',
          900: '#15120E',
        },
      },
    },
  },
  plugins: [],
};
