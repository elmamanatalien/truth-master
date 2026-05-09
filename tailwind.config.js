/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'apple-green': '#7CB342',
        'trust-blue': '#2E7BC4',
      },
      borderWidth: {
        '3': '3px',
      },
    },
  },
  plugins: [],
};
