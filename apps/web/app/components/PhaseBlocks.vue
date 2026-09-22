<template>
  <div>
    <div class="flex gap-0.5 overflow-hidden rounded-pill">
      <div
        v-for="p in phases"
        :key="`${p.phase}-${p.startWeek}`"
        class="h-2 transition-opacity"
        :class="[blockClass(p.phase), currentWeek >= p.startWeek && currentWeek <= p.endWeek ? '' : 'opacity-40']"
        :style="{ flexGrow: p.endWeek - p.startWeek + 1 }"
        :title="`${humanizePhase(p.phase)} — weeks ${p.startWeek}–${p.endWeek}`"
      />
    </div>
    <div class="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-subtle">
      <span v-for="p in phases" :key="`l-${p.phase}-${p.startWeek}`" class="inline-flex items-center gap-1">
        <span class="h-1.5 w-1.5 rounded-pill" :class="blockClass(p.phase)" />
        {{ humanizePhase(p.phase) }} {{ p.startWeek }}–{{ p.endWeek }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// Fills, not chips — PhaseChip's classes carry text colours these don't need.
const PHASE_FILLS: Record<string, string> = {
  ramp: "bg-line-strong",
  base: "bg-accent-300",
  cutback: "bg-verdict-hold-soft",
  build: "bg-accent-500",
  peak: "bg-verdict-regress",
  taper: "bg-verdict-hold",
  race: "bg-ink",
};

defineProps<{
  phases: { phase: string; startWeek: number; endWeek: number }[];
  currentWeek: number;
}>();

function blockClass(phase: string): string {
  return PHASE_FILLS[phase] ?? "bg-line-strong";
}
</script>
