<template>
  <svg :viewBox="`0 0 ${width} ${height}`" class="w-full h-32">
    <rect
      v-if="band"
      :x="0"
      :y="yFor(band.max)"
      :width="width"
      :height="Math.max(yFor(band.min) - yFor(band.max), 1)"
      class="fill-emerald-500/10"
    />
    <line :x1="0" :y1="yFor(0)" :x2="width" :y2="yFor(0)" class="stroke-gray-800" stroke-width="1" />
    <polyline :points="polylinePoints" fill="none" :class="colorClass" stroke-width="2" />
    <circle v-if="points.length" :cx="width" :cy="yFor(points[points.length - 1]!)" r="3" :class="colorClass.replace('stroke', 'fill')" />
  </svg>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  points: (number | null)[];
  band?: { min: number; max: number };
  colorClass?: string;
}>();

const width = 300;
const height = 120;
const padding = 8;

const values = computed(() => props.points.filter((v): v is number => v != null && Number.isFinite(v)));
const maxVal = computed(() => Math.max(...(values.value.length ? values.value : [1]), props.band?.max ?? 0));
const minVal = computed(() => Math.min(...(values.value.length ? values.value : [0]), props.band?.min ?? 0, 0));

function yFor(v: number): number {
  const range = maxVal.value - minVal.value || 1;
  return height - padding - ((v - minVal.value) / range) * (height - padding * 2);
}

const colorClass = computed(() => props.colorClass ?? "stroke-emerald-400");

const polylinePoints = computed(() => {
  const step = props.points.length > 1 ? width / (props.points.length - 1) : 0;
  return props.points
    .map((v, i) => (v == null || !Number.isFinite(v) ? null : `${i * step},${yFor(v)}`))
    .filter((p): p is string => p !== null)
    .join(" ");
});
</script>
