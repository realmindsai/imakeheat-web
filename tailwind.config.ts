import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        rmai: {
          purple:   '#A77ACD',
          orange:   '#F26541',
          green:    '#22C55E',
          lavender: '#F0EBF4',
          stone:    '#EDEBE8',
          bg:       '#FAFAFA',
          fg1:      '#1A1B25',
          fg2:      '#555555',
          mut:      '#8D8D92',
          border:   '#E8E8EB',
        },
      },
      fontFamily: {
        sans: ['Epilogue', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
} satisfies Config
