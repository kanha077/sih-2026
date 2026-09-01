/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        topo: {
          canvas: 'var(--topo-canvas)',
          panel: 'var(--topo-panel)',
          surface: 'var(--topo-surface)',
          border: 'var(--topo-border)',
          borderFocus: 'var(--topo-border-focus)',
          ochre: 'var(--topo-ochre)',
          terra: 'var(--topo-terra)',
          pine: 'var(--topo-pine)',
          sand: 'var(--topo-sand)',
          ink: 'var(--topo-ink)',
          inkMuted: 'var(--topo-ink-muted)',
          inkDim: 'var(--topo-ink-dim)',
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        mono: ['Space Mono', 'JetBrains Mono', 'monospace'],
        sans: ['Plus Jakarta Sans', 'Inter', 'system-ui', 'sans-serif'],
      },
      animation: {
        'scan': 'scan 2.5s ease-in-out infinite',
        'pulse-subtle': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        scan: {
          '0%, 100%': { transform: 'translateY(0%)' },
          '50%': { transform: 'translateY(100%)' },
        }
      }
    },
  },
  plugins: [],
}
