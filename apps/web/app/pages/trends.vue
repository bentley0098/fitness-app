<template>
  <div class="p-4 space-y-6">
    <header>
      <h1 class="text-lg font-semibold">Trends</h1>
      <p class="text-sm text-gray-500 mt-1">Last {{ days }} days.</p>
    </header>

    <div v-if="pending" class="text-sm text-gray-500">Loading…</div>

    <template v-else-if="data">
      <section>
        <h2 class="text-sm text-gray-400 mb-2">Weekly volume (trailing 7-day, km)</h2>
        <LineChart :points="volumePoints" color-class="stroke-sky-400" />
      </section>

      <section>
        <h2 class="text-sm text-gray-400 mb-2">
          Workload ratio <span class="text-gray-600">(shaded band = sweet spot {{ sweetSpotMin }}–{{ sweetSpotMax }})</span>
        </h2>
        <LineChart :points="ratioPoints" :band="{ min: sweetSpotMin, max: sweetSpotMax }" color-class="stroke-emerald-400" />
      </section>

      <section>
        <h2 class="text-sm text-gray-400 mb-2">Engine verdict history</h2>
        <VerdictStrip :verdicts="verdicts" />
        <div class="flex gap-4 mt-2 text-xs text-gray-500">
          <span><span class="inline-block w-2 h-2 rounded-sm bg-emerald-500 mr-1" />progress</span>
          <span><span class="inline-block w-2 h-2 rounded-sm bg-amber-600 mr-1" />hold</span>
          <span><span class="inline-block w-2 h-2 rounded-sm bg-orange-600 mr-1" />regress</span>
          <span><span class="inline-block w-2 h-2 rounded-sm bg-red-500 mr-1" />stop</span>
        </div>
      </section>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const days = 42;

interface TrendPoint {
  date: string;
  weeklyVolumeM: number;
  workloadRatio: number | null;
  verdict: string;
}

const { data, pending } = await useFetch<{
  series: TrendPoint[];
  engineParams: { workloadRatioSweetSpotMin: number; workloadRatioSweetSpotMax: number };
}>("/api/trends", { query: { days } });

const volumePoints = computed(() => data.value?.series.map((p) => p.weeklyVolumeM / 1000) ?? []);
const ratioPoints = computed(() => data.value?.series.map((p) => p.workloadRatio) ?? []);
const verdicts = computed(() => data.value?.series.map((p) => p.verdict) ?? []);
const sweetSpotMin = computed(() => data.value?.engineParams.workloadRatioSweetSpotMin ?? 0.8);
const sweetSpotMax = computed(() => data.value?.engineParams.workloadRatioSweetSpotMax ?? 1.3);
</script>
