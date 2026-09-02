/** @type {import('tailwindcss').Config} */

const token = (name) => `rgb(var(${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        canvas: token('--color-canvas'),
        surface: token('--color-surface'),
        'surface-subtle': token('--color-surface-subtle'),
        'surface-strong': token('--color-surface-strong'),
        ink: token('--color-ink'),
        'ink-muted': token('--color-ink-muted'),
        'ink-subtle': token('--color-ink-subtle'),
        border: token('--color-border'),
        'border-strong': token('--color-border-strong'),
        brand: token('--color-brand'),
        'brand-strong': token('--color-brand-strong'),
        'brand-soft': token('--color-brand-soft'),
        focus: token('--color-focus'),
        danger: token('--color-danger'),
        'danger-soft': token('--color-danger-soft'),
        success: token('--color-success'),
        'success-soft': token('--color-success-soft'),
        warning: token('--color-warning'),
        'warning-soft': token('--color-warning-soft'),
      },
      fontFamily: {
        sans: ['Avenir Next', 'Segoe UI', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        control: '8px',
        panel: '12px',
      },
      boxShadow: {
        overlay: '0 16px 40px rgb(27 37 34 / 0.16)',
      },
      transitionDuration: {
        state: '200ms',
      },
    },
  },
  plugins: [],
}
