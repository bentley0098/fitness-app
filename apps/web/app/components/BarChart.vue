<template>
  <div class="flex items-end gap-0.5" :style="{ height: `${height}px` }">
    <div
      v-for="(b, i) in bars"
      :key="i"
      class="flex-1 rounded-t-sm transition-colors"
      :class="b.class"
      :style="{ height: `${b.pct}%` }"
      :title="b.title"
    />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

// LineChart can't do bars, and weekly volume reads far better as discrete
// columns than as a continuous line — each week is a separate quantity, not a
// sample of something continuous.
const props = withDefaults(
  defineProps<{
    values: (number | null)[];
    max?: number | null;
    height?: number;
    highlightIndex?: number | null;
    /** Indices to render as already-completed. */
    doneThrough?: number | null;
  }>(),
  { height: 40, max: null, highlightIndex: null, doneThrough: null },
);

const scale = computed(() => {
  if (props.max && props.max > 0) return props.max;
  const vals = props.values.filter((v): v is number => v != null && Number.isFinite(v) && v > 0);
  return vals.length ? Math.max(...vals) : 1;
});

const bars = computed(() =>
  props.values.map((v, i) => {
    const value = v != null && Number.isFinite(v) ? v : 0;
    // Floor at 2% so a zero-volume week still reads as a week rather than
    // vanishing from the chart entirely.
    const pct = Math.max((value / scale.value) * 100, 2);
    const isCurrent = props.highlightIndex === i;
    const isDone = props.doneThrough != null && i < props.doneThrough;
    return {
      pct,
      class: isCurrent ? "bg-accent-600" : isDone ? "bg-accent-300" : "bg-line-strong",
      title: `${value.toFixed(1)} km`,
    };
  }),
);
</script>
