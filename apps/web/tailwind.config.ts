import type { Config } from "tailwindcss";

// Semantic tokens only — no raw palette names in templates. Every colour
// resolves to a CSS variable declared in app/assets/css/tailwind.css, so
// retuning the theme (or adding a dark mode later) is a change to that file
// alone rather than a sweep through every component.
//
// The `rgb(var(--x) / <alpha-value>)` form is load-bearing: without it
// Tailwind cannot generate opacity variants and `bg-accent-500/10` silently
// emits nothing.
const v = (name: string) => `rgb(var(${name}) / <alpha-value>)`;

export default {
  // No toggle ships today; this just keeps the door open so a `.dark` block
  // of variable overrides is all a dark theme would need.
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        canvas: v("--c-canvas"),
        surface: v("--c-surface"),
        raised: v("--c-raised"),
        line: v("--c-line"),
        "line-strong": v("--c-line-strong"),
        ink: v("--c-ink"),
        muted: v("--c-ink-muted"),
        subtle: v("--c-ink-subtle"),
        accent: {
          50: v("--c-accent-50"),
          100: v("--c-accent-100"),
          300: v("--c-accent-300"),
          500: v("--c-accent-500"),
          600: v("--c-accent-600"),
          700: v("--c-accent-700"),
          DEFAULT: v("--c-accent-600"),
        },
        verdict: {
          progress: v("--c-progress"),
          "progress-soft": v("--c-progress-soft"),
          hold: v("--c-hold"),
          "hold-soft": v("--c-hold-soft"),
          regress: v("--c-regress"),
          "regress-soft": v("--c-regress-soft"),
          stop: v("--c-stop"),
          "stop-soft": v("--c-stop-soft"),
        },
      },
      borderRadius: {
        card: "1rem",
        pill: "999px",
      },
      boxShadow: {
        // Light themes need elevation where the old dark theme used borders.
        card: "0 1px 2px 0 rgb(15 23 42 / 0.04), 0 1px 3px 0 rgb(15 23 42 / 0.06)",
        raised: "0 4px 12px -2px rgb(15 23 42 / 0.08), 0 2px 4px -2px rgb(15 23 42 / 0.04)",
      },
    },
  },
} satisfies Config;
