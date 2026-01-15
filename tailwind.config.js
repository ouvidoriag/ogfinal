/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./public/**/*.html",
    "./public/scripts/**/*.{js,ts}",
  ],
  theme: {
    extend: {
      colors: {
        bg: '#0b1020',
        panel: '#0f172a',
        muted: '#94a3b8',
        primary: '#22d3ee',
        accent: '#a78bfa',
        success: '#34d399',
        danger: '#fb7185',
        'text-primary': '#f1f5f9',
        'text-secondary': '#cbd5e1',
        border: 'rgba(255,255,255,0.08)',
      },
      fontFamily: {
        sans: ['Rajdhani', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

