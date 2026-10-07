<template>
  <div class="space-y-4 p-4">
    <header>
      <NuxtLink to="/strength/exercises" class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        ← Exercises
      </NuxtLink>
      <h1 class="text-xl font-bold text-ink">{{ data?.exercise.name ?? "Exercise" }}</h1>
      <p v-if="data" class="mt-0.5 text-sm text-subtle">
        {{ data.exercise.measure === "hold" ? "Timed hold" : "Reps and weight" }}{{ data.exercise.perSide ? " · per side" : "" }}
      </p>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load this exercise" :skeletons="3">
      <template v-if="data">
        <section class="rounded-card border border-line bg-surface p-4 shadow-card">
          <template v-if="data.series.points.length">
            <SectionHeader :title="chartTitle" />
            <div class="mt-3">
              <LineChart :points="data.series.points.map((p) => p.value)" fit :show-baseline="false" />
            </div>
            <div class="mt-1 flex justify-between text-[11px] text-subtle">
              <span>{{ formatDate(data.series.points[0]!.date, { day: "numeric", month: "short" }) }}</span>
              <span class="tnum">{{ data.series.points.at(-1)!.value }} {{ data.series.unit }}</span>
            </div>
          </template>
          <p v-else class="text-sm text-subtle">Nothing logged for this exercise yet.</p>
        </section>

        <section v-if="data.recent.length" class="space-y-2">
          <SectionHeader title="Recent sessions" />
          <NuxtLink
            v-for="s in data.recent"
            :key="s.logId"
            :to="`/strength/log/${s.logId}`"
            class="block rounded-card border border-line bg-surface p-3.5 shadow-card transition-colors hover:bg-raised"
          >
            <div class="flex items-baseline justify-between gap-3">
              <span class="text-sm font-semibold text-ink">{{ s.templateName }}</span>
              <span class="text-xs text-subtle">{{ formatDate(s.date, { weekday: "short", day: "numeric", month: "short" }) }}</span>
            </div>
            <p class="tnum mt-1 text-xs text-muted">{{ s.sets.map(describeSet).join(" · ") }}</p>
          </NuxtLink>
        </section>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const route = useRoute();
const { data, pending, error } = await useFetch(() => `/api/strength/exercises/${route.params.id}`);

const chartTitle = computed(() => {
  const metric = data.value?.series.metric;
  return metric === "weight" ? "Top set weight" : metric === "hold" ? "Longest hold" : "Most reps in a set";
});

function describeSet(s: { reps: number | null; holdSeconds: number | null; weightKg: number | null }): string {
  if (s.holdSeconds != null) return `${s.holdSeconds} s`;
  if (s.reps == null) return "—";
  return s.weightKg != null ? `${s.reps} × ${s.weightKg}` : `${s.reps}`;
}
</script>
