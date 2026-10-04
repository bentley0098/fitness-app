<template>
  <div class="rounded-card border border-line bg-surface p-4 shadow-card">
    <div class="grid grid-cols-4 gap-2">
      <div v-for="d in predictions.distances" :key="d.key" class="min-w-0">
        <div class="text-[11px] font-medium uppercase tracking-wide text-subtle">{{ d.label }}</div>
        <div class="tnum mt-1 text-base font-semibold text-ink">{{ formatDuration(d.seconds) }}</div>
        <div v-if="d.deltaS != null && d.deltaS !== 0" class="tnum mt-0.5 text-[11px] font-semibold" :class="d.deltaS < 0 ? 'text-verdict-progress' : 'text-verdict-regress'">
          {{ d.deltaS < 0 ? "−" : "+" }}{{ formatDuration(Math.abs(d.deltaS)) }}
        </div>
      </div>
    </div>
    <p v-if="predictions.priorDate" class="mt-2.5 text-[11px] text-subtle">
      Change since {{ formatDate(predictions.priorDate, { day: "numeric", month: "short" }) }}
    </p>
  </div>
</template>

<script setup lang="ts">
interface Distance {
  key: string;
  label: string;
  seconds: number | null;
  deltaS: number | null;
}

defineProps<{
  predictions: { date: string; priorDate: string | null; distances: Distance[] };
}>();
</script>
