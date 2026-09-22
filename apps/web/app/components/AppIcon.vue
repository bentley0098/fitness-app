<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    :stroke-width="strokeWidth"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    focusable="false"
  >
    <path v-for="(d, i) in paths" :key="i" :d="d" />
    <circle v-for="(c, i) in circles" :key="`c${i}`" :cx="c[0]" :cy="c[1]" :r="c[2]" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Inline SVG rather than an icon package. The repo already rejected a chart
// dependency for three charts (build-plan.md:93); a dozen glyphs don't justify
// one either, and the unicode glyphs the tab bar used (◉ ✎ ☰ ↗) render
// inconsistently across platforms.
type IconDef = { paths: string[]; circles?: [number, number, number][] };

const ICONS: Record<string, IconDef> = {
  home: { paths: ["M3 10.5 12 3l9 7.5", "M5 9.5V21h14V9.5"] },
  calendar: { paths: ["M8 2v4", "M16 2v4", "M3 10h18", "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"] },
  run: { paths: ["M13.5 5.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3", "M7 21l3-5 3 2 1.5 3", "M6 12l3.5-3.5 3 1.5 2 2.5 3 1"] },
  dots: { paths: [], circles: [[5, 12, 1.6], [12, 12, 1.6], [19, 12, 1.6]] },
  "chevron-left": { paths: ["M15 18l-6-6 6-6"] },
  "chevron-right": { paths: ["M9 18l6-6-6-6"] },
  "chevron-down": { paths: ["M6 9l6 6 6-6"] },
  check: { paths: ["M20 6L9 17l-5-5"] },
  moon: { paths: ["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8"] },
  heart: { paths: ["M20.8 5.6a5 5 0 0 0-7.1 0L12 7.3l-1.7-1.7a5 5 0 1 0-7.1 7.1L12 21l8.8-8.3a5 5 0 0 0 0-7.1"] },
  gauge: { paths: ["M12 15l4-4", "M3.5 17a9 9 0 1 1 17 0"] },
  battery: { paths: ["M3 8a2 2 0 0 1 2-2h11a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M21 10v4"] },
  trend: { paths: ["M3 17l6-6 4 4 8-8", "M15 7h6v6"] },
  flag: { paths: ["M5 22V4", "M5 4h12l-2 4 2 4H5"] },
  note: { paths: ["M4 4a2 2 0 0 1 2-2h8l6 6v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z", "M14 2v6h6"] },
  rest: { paths: ["M4 12h16"] },
  alert: { paths: ["M12 8v5", "M12 17h.01", "M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0"] },
  clock: { paths: ["M12 7v5l3 2"], circles: [[12, 12, 9]] },
};

const props = withDefaults(defineProps<{ name: string; size?: number | string; strokeWidth?: number | string }>(), {
  size: 20,
  strokeWidth: 1.75,
});

const def = computed<IconDef>(() => ICONS[props.name] ?? { paths: [] });
const paths = computed(() => def.value.paths);
const circles = computed(() => def.value.circles ?? []);
</script>
