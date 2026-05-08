export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      boxShadow: {
        glow: '0 0 45px rgba(94, 140, 255, 0.28)',
        glass: '0 8px 40px rgba(9, 16, 39, 0.55)'
      },
      backgroundImage: {
        'grid-glow': 'radial-gradient(circle at top, rgba(94, 140, 255, 0.18), transparent 35%), radial-gradient(circle at 80% 20%, rgba(236, 72, 153, 0.14), transparent 30%), linear-gradient(180deg, rgba(8, 12, 26, 0.95), rgba(6, 10, 22, 0.95))'
      }
    }
  },
  plugins: []
};