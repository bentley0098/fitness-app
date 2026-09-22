<template>
  <div class="rounded-card border border-line bg-surface p-3 shadow-card">
    <div class="flex items-center gap-1.5 text-subtle">
      <AppIcon name="moon" :size="14" />
      <span class="text-[11px] font-medium uppercase tracking-wide">Sleep</span>
    </div>

    <div v-if="hasData" class="mt-1.5">
      <div class="flex items-baseline gap-1.5">
        <span class="tnum text-xl font-semibold text-ink">{{ formatHoursMinutes(sleep.timeS) }}</span>
        <span v-if="sleep.score != null" class="tnum text-xs font-semibold text-accent-700">
          {{ formatNumber(sleep.score) }}<span class="font-normal text-subtle">/100</span>
        </span>
      </div>

      <!-- Stage bar, only when Garmin returned the breakdown. -->
      <div v-if="stagesTotal > 0" class="mt-2 flex h-1.5 overflow-hidden rounded-pill bg-raised">
        <div v-for="s in stages" :key="s.key" :class="s.class" :style="{ width: `${(s.value / stagesTotal) * 100}%` }" :title="`${s.label}: ${formatHoursMinutes(s.value)}`" />
      </div>
      <div v-if="stagesTotal > 0" class="mt-1.5 flex flex-wrap gap-x-2.5 gap-y-0.5 text-[10px] text-subtle">
        <span v-for="s in stages" :key="s.key" class="inline-flex items-center gap-1">
          <span class="h-1.5 w-1.5 rounded-pill" :class="s.class" />{{ s.label }}
        </span>
      </div>
    </div>

    <div v-else class="mt-1.5">
      <span class="text-xl font-semibold text-ink">{{ DASH }}</span>
      <p class="mt-1 text-[11px] text-subtle">Not synced yet</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  sleep: {
    timeS: number | null;
    deepS: number | null;
    lightS: number | null;
    remS: number | null;
    awakeS: number | null;
    score: number | null;
  } | null;
}>();

const sleep = computed(() => props.sleep ?? { timeS: null, deepS: null, lightS: null, remS: null, awakeS: null, score: null });
const hasData = computed(() => sleep.value.timeS != null || sleep.value.score != null);

const stages = computed(() =>
  [
    { key: "deep", label: "Deep", value: sleep.value.deepS ?? 0, class: "bg-accent-700" },
    { key: "rem", label: "REM", value: sleep.value.remS ?? 0, class: "bg-accent-500" },
    { key: "light", label: "Light", value: sleep.value.lightS ?? 0, class: "bg-accent-300" },
    { key: "awake", label: "Awake", value: sleep.value.awakeS ?? 0, class: "bg-line-strong" },
  ].filter((s) => s.value > 0),
);

const stagesTotal = computed(() => stages.value.reduce((sum, s) => sum + s.value, 0));
</script>
