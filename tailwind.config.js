/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        denim: {
          canvas: '#0A0A0B',
          card: '#141518',
          elevated: '#1C1D22',
          input: '#1F2126',
          border: 'rgba(255, 255, 255, 0.08)',
        },
        harley: {
          orange: '#FF6600',
          amber: '#F58220',
          glow: 'rgba(255, 102, 0, 0.22)',
        },
        ios: {
          text: '#F5F5F7',
          secondary: '#8E8E93',
          tertiary: '#636366',
          green: '#30D158',
          yellow: '#FFD60A',
          red: '#FF453A',
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          '"SF Pro Display"',
          '"SF Pro Text"',
          'system-ui',
          'sans-serif',
        ],
      },
      transitionTimingFunction: {
        'ios-spring': 'cubic-bezier(0.32, 0.72, 0, 1)',
      },
    },
  },
  plugins: [],
};
