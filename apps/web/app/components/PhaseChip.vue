<template>
  <span
    class="inline-flex items-center rounded-pill px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
    :class="chipClass"
  >
    {{ humanizePhase(phase) }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

// One colour per training phase so the 27-week overview reads as blocks of
// intent rather than an undifferentiated list. Intensity roughly tracks the
// phase's demand: ramp/base cool, peak/race hot.
const PHASE_CLASSES: Record<string, string> = {
  ramp: "bg-raised text-muted",
  base: "bg-accent-100 text-accent-700",
  cutback: "bg-verdict-hold-soft text-verdict-hold",
  build: "bg-accent-500/20 text-accent-700",
  peak: "bg-verdict-regress-soft text-verdict-regress",
  taper: "bg-verdict-hold-soft text-verdict-hold",
  race: "bg-ink text-white",
};

const props = defineProps<{ phase: string | null | undefined }>();
const chipClass = computed(() => PHASE_CLASSES[props.phase ?? ""] ?? "bg-raised text-muted");
</script>
