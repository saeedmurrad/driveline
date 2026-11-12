/** @type {import('tailwindcss').Config} */
// Theme-switchable palettes: these five colour families read CSS variables, so a theme
// (html[data-theme]) can recolour the whole site. Default values in src/styles.css are
// Tailwind's own, so the Default theme renders exactly as before.
const THEMED = ['rose', 'orange', 'stone', 'gray', 'slate'];
const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950];
const themed = Object.fromEntries(
  THEMED.map((name) => [name, Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--p-${name}-${s}) / <alpha-value>)`]))]),
);

module.exports = {
  content: [
    "./src/**/*.{html,ts}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      screens: {
        // Desktop header (full menu + actions) from here; narrower screens use the menu button
        nav: '1180px',
      },
      fontFamily: {
        // Font stacks come from the theme (--dl-font-*), see src/styles.css
        sans: ['var(--dl-font-sans)'],
        display: ['var(--dl-font-display)'],
        mono: ['var(--dl-font-mono)'],
      },
      // Design tokens: values live in src/styles.css (:root and html.dark).
      colors: {
        ...themed,
        surface: {
          DEFAULT: 'rgb(var(--dl-surface-rgb) / <alpha-value>)',
          raised: 'rgb(var(--dl-surface-raised-rgb) / <alpha-value>)',
          sunken: 'rgb(var(--dl-surface-sunken-rgb) / <alpha-value>)',
        },
        ink: {
          DEFAULT: 'rgb(var(--dl-ink-rgb) / <alpha-value>)',
          muted: 'rgb(var(--dl-ink-muted-rgb) / <alpha-value>)',
          faint: 'rgb(var(--dl-ink-faint-rgb) / <alpha-value>)',
        },
        line: 'rgb(var(--dl-line-rgb) / <alpha-value>)',
        brand: {
          DEFAULT: 'rgb(var(--dl-brand-rgb) / <alpha-value>)',
          deep: 'rgb(var(--dl-brand-deep-rgb) / <alpha-value>)',
          soft: 'rgb(var(--dl-brand-soft-rgb) / <alpha-value>)',
        },
        accent: 'rgb(var(--dl-accent-rgb) / <alpha-value>)',
        state: {
          reduced: 'rgb(var(--dl-state-reduced-rgb) / <alpha-value>)',
          reserved: 'rgb(var(--dl-state-reserved-rgb) / <alpha-value>)',
          sold: 'rgb(var(--dl-state-sold-rgb) / <alpha-value>)',
          ok: 'rgb(var(--dl-state-ok-rgb) / <alpha-value>)',
        },
      },
      borderRadius: {
        token: 'var(--dl-radius-md)',
        'token-lg': 'var(--dl-radius-lg)',
      },
      boxShadow: {
        card: 'var(--dl-shadow-card)',
        pop: 'var(--dl-shadow-pop)',
      },
      transitionTimingFunction: {
        'dl-out': 'var(--dl-ease-out)',
        'dl-spring': 'var(--dl-ease-spring)',
      },
    },
  },
  plugins: [],
};
