<template>
  <div class="space-y-6 p-4">
    <header>
      <NuxtLink to="/more" class="mb-2 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        <AppIcon name="chevron-left" :size="14" /> More
      </NuxtLink>
      <h1 class="text-xl font-bold text-ink">Trends</h1>
      <p class="mt-0.5 text-sm text-subtle">Last {{ days }} days.</p>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load trends">
      <template v-if="data">
        <section class="rounded-card border border-line bg-surface p-4 shadow-card">
          <SectionHeader title="Weekly volume" sub="Trailing 7-day total, km" />
          <div class="mt-3">
            <LineChart :points="volumePoints" area />
          </div>
        </section>

        <section class="rounded-card border border-line bg-surface p-4 shadow-card">
          <SectionHeader
            title="Workload ratio"
            :sub="`Shaded band = sweet spot ${sweetSpotMin}–${sweetSpotMax}`"
          />
          <div class="mt-3">
            <LineChart :points="ratioPoints" :band="{ min: sweetSpotMin, max: sweetSpotMax }" />
          </div>
        </section>

        <section class="rounded-card border border-line bg-surface p-4 shadow-card">
          <SectionHeader title="Engine verdict history" />
          <div class="mt-3">
            <VerdictStrip :verdicts="verdicts" />
          </div>
          <div class="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-subtle">
            <span v-for="v in legend" :key="v" class="inline-flex items-center gap-1.5">
              <span class="inline-block h-2 w-2 rounded-sm" :class="verdictStyle(v).solid" />{{ v }}
            </span>
          </div>
        </section>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const days = 42;
const legend = ["progress", "hold", "regress", "stop"];

interface TrendPoint {
  date: string;
  weeklyVolumeM: number;
  workloadRatio: number | null;
  verdict: string;
}

const { data, pending, error } = await useFetch<{
  series: TrendPoint[];
  engineParams: { workloadRatioSweetSpotMin: number; workloadRatioSweetSpotMax: number };
}>("/api/trends", { query: { days } });

const volumePoints = computed(() => data.value?.series.map((p) => p.weeklyVolumeM / 1000) ?? []);
const ratioPoints = computed(() => data.value?.series.map((p) => p.workloadRatio) ?? []);
const verdicts = computed(() => data.value?.series.map((p) => p.verdict) ?? []);
const sweetSpotMin = computed(() => data.value?.engineParams.workloadRatioSweetSpotMin ?? 0.8);
const sweetSpotMax = computed(() => data.value?.engineParams.workloadRatioSweetSpotMax ?? 1.3);
</script>
