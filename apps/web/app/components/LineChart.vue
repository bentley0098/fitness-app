<template>
  <svg :viewBox="`0 0 ${width} ${height}`" class="w-full" :class="heightClass" preserveAspectRatio="none">
    <rect
      v-if="band"
      :x="0"
      :y="yFor(band.max)"
      :width="width"
      :height="Math.max(yFor(band.min) - yFor(band.max), 1)"
      class="fill-accent-500/10"
    />

    <line v-if="showBaseline" :x1="0" :y1="yFor(0)" :x2="width" :y2="yFor(0)" class="stroke-line" stroke-width="1" />

    <polygon v-if="area && areaPoints" :points="areaPoints" :class="palette.area" />
    <polyline
      :points="polylinePoints"
      fill="none"
      :class="palette.stroke"
      :stroke-width="strokeWidth"
      stroke-linejoin="round"
      stroke-linecap="round"
    />

    <circle v-if="lastPoint" :cx="lastPoint.x" :cy="lastPoint.y" :r="dotRadius" :class="palette.dot" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Palettes are literal class strings, deliberately.
//
// This used to derive the fill from the stroke at runtime
// (`colorClass.replace('stroke','fill')`), which Tailwind's scanner can never
// see — the generated `fill-accent-600/10` was purged and every area and
// endpoint dot rendered as default black. Any colour a chart can use has to
// appear verbatim in the source.
const PALETTES = {
  accent: { stroke: "stroke-accent-600", area: "fill-accent-500/15", dot: "fill-accent-600" },
  danger: { stroke: "stroke-verdict-regress", area: "fill-verdict-regress/15", dot: "fill-verdict-regress" },
  warn: { stroke: "stroke-verdict-hold", area: "fill-verdict-hold/15", dot: "fill-verdict-hold" },
  ink: { stroke: "stroke-ink", area: "fill-ink/10", dot: "fill-ink" },
} as const;

export type ChartVariant = keyof typeof PALETTES;

const props = withDefaults(
  defineProps<{
    points: (number | null)[];
    band?: { min: number; max: number };
    variant?: ChartVariant;
    area?: boolean;
    compact?: boolean;
    showBaseline?: boolean;
  }>(),
  { variant: "accent", area: false, compact: false, showBaseline: true },
);

const palette = computed(() => PALETTES[props.variant] ?? PALETTES.accent);

const width = 300;
const height = computed(() => (props.compact ? 40 : 120));
const padding = computed(() => (props.compact ? 4 : 8));
const heightClass = computed(() => (props.compact ? "h-10" : "h-32"));
const strokeWidth = 2;
const dotRadius = computed(() => (props.compact ? 2.5 : 3));

const values = computed(() => props.points.filter((v): v is number => v != null && Number.isFinite(v)));
const maxVal = computed(() => Math.max(...(values.value.length ? values.value : [1]), props.band?.max ?? 0));
// Sparklines of a narrow series (resting HR hovering 53-57) are flat against a
// zero floor, so compact charts scale to their own range instead.
const minVal = computed(() => {
  const floor = props.compact ? Math.min(...(values.value.length ? values.value : [0])) : 0;
  return Math.min(...(values.value.length ? values.value : [0]), props.band?.min ?? floor, floor);
});

function yFor(v: number): number {
  const range = maxVal.value - minVal.value || 1;
  return height.value - padding.value - ((v - minVal.value) / range) * (height.value - padding.value * 2);
}

const step = computed(() => (props.points.length > 1 ? width / (props.points.length - 1) : 0));

// Nulls are dropped rather than splitting the line, so a gap in the data joins
// across it. Acceptable for these series (a missing day is "not synced", not
// "zero"), but it does imply continuity that isn't there.
const plotted = computed(() =>
  props.points
    .map((v, i) => (v == null || !Number.isFinite(v) ? null : { x: i * step.value, y: yFor(v) }))
    .filter((p): p is { x: number; y: number } => p !== null),
);

const polylinePoints = computed(() => plotted.value.map((p) => `${p.x},${p.y}`).join(" "));

const areaPoints = computed(() => {
  const pts = plotted.value;
  if (pts.length < 2) return null;
  const base = height.value - padding.value;
  return `${pts[0]!.x},${base} ${polylinePoints.value} ${pts[pts.length - 1]!.x},${base}`;
});

const lastPoint = computed(() => plotted.value[plotted.value.length - 1] ?? null);
</script>
