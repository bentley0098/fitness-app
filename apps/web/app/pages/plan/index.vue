<template>
  <div class="space-y-4 p-4">
    <header>
      <h1 class="text-xl font-bold text-ink">Your plan</h1>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load your plan" :skeletons="5">
      <template v-if="data">
        <RaceCountdown :race="data.race" :phase="currentPhase" />

        <NuxtLink
          v-for="w in data.weeks"
          :id="`week-${w.number}`"
          :key="w.number"
          :to="{ path: '/plan/week', query: { week: w.startDate } }"
          class="block rounded-card border bg-surface p-4 shadow-card transition-colors hover:bg-raised"
          :class="w.status === 'current' ? 'border-accent-600' : 'border-line'"
        >
          <div class="flex items-center justify-between gap-3">
            <div class="text-[11px] font-semibold uppercase tracking-wide text-subtle">
              {{ formatDate(w.startDate, SHORT) }} – {{ formatDate(w.endDate, SHORT) }}
            </div>
            <PhaseChip :phase="w.phase" />
          </div>

          <div class="flex items-baseline justify-between gap-3">
            <div class="text-lg font-bold text-ink">Week {{ w.number }}</div>
            <div class="tnum text-sm font-semibold text-ink">
              <template v-if="w.status !== 'upcoming'">{{ formatDistance(w.actualDistanceM) }} / </template>{{ formatDistance(w.plannedDistanceM) }} km
            </div>
          </div>

          <ul class="mt-3 space-y-1.5">
            <li v-for="s in w.sessions" :key="s.id" class="flex items-baseline gap-3 text-sm">
              <span class="w-9 shrink-0" :class="s.state === 'completed' ? 'text-verdict-progress' : 'text-subtle'">{{ weekdayShort(s.date) }}</span>
              <span class="min-w-0 flex-1" :class="s.state === 'completed' ? DONE : 'text-ink'">{{ s.label }}</span>
            </li>
          </ul>
        </NuxtLink>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";

const DONE = "text-verdict-progress line-through opacity-70";
const SHORT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

const { data, pending, error } = await useFetch("/api/plan-sessions", {
  query: { view: "overview" },
});

const currentPhase = computed(
  () => data.value?.weeks.find((w) => w.number === data.value?.currentWeekNumber)?.phase ?? null,
);

// 27 cards is a long scroll; land on this week rather than week 1.
onMounted(() => {
  if (data.value) document.getElementById(`week-${data.value.currentWeekNumber}`)?.scrollIntoView({ block: "start" });
});
</script>
