/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        primary: '#1C7C54',
        secondary: '#FFB400',
        background: '#F5F7FA',
        surface: '#FFFFFF',
        success: '#2EA44F',
        error: '#D03801',
        text: {
          primary: '#1F2933',
          secondary: '#52606D',
        },
      },
      fontFamily: {
        sans: ['Inter', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        sm: '8px',
        md: '16px',
      },
      boxShadow: {
        card: '0 8px 16px rgba(15,23,42,0.08)',
      },
    },
  },
  plugins: [],
}
