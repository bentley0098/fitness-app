<template>
  <div class="space-y-4 p-4">
    <header>
      <h1 class="text-xl font-bold text-ink">Your plan</h1>
    </header>

    <ProposalBanner />

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

          <div v-for="day in daysOf(w.sessions)" :key="day.date" class="mt-1.5 flex items-start gap-3 text-sm first:mt-3">
            <span class="w-9 shrink-0" :class="day.sessions.every((s) => s.state === 'completed') ? 'text-verdict-progress' : 'text-subtle'">{{ weekdayShort(day.date) }}</span>
            <ul class="min-w-0 flex-1 space-y-1.5">
              <li v-for="s in day.sessions" :key="s.id" class="flex items-stretch gap-2">
                <span class="w-1 shrink-0 rounded-pill" :class="KIND_BAR[sessionKind(s.type)]" />
                <span class="min-w-0 flex-1" :class="s.state === 'completed' ? DONE : 'text-ink'">{{ labelFor(s) }}</span>
              </li>
            </ul>
          </div>
        </NuxtLink>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from "vue";
import { KIND_BAR, runsFirst, sessionKind } from "~/composables/sessionKind";

const DONE = "text-verdict-progress line-through opacity-70";
const SHORT: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };

const { data, pending, error } = await useFetch("/api/plan-sessions", {
  query: { view: "overview" },
});

// One entry per day, in date order, with that day's runs ahead of its strength work.
function daysOf<T extends { date: string; type: string | null }>(sessions: T[]) {
  const byDate = new Map<string, T[]>();
  for (const s of sessions) byDate.set(s.date, [...(byDate.get(s.date) ?? []), s]);
  return [...byDate].sort(([a], [b]) => a.localeCompare(b)).map(([date, list]) => ({ date, sessions: runsFirst(list) }));
}

// Strength sessions are named after their template ("Gym A", "Physio: ankle");
// the overview only needs the kind.
function labelFor(s: { type: string | null; label: string }) {
  if (s.type === "strength_gym") return "Gym";
  if (s.type === "strength_physio") return "Physio";
  return s.label;
}

const currentPhase = computed(
  () => data.value?.weeks.find((w) => w.number === data.value?.currentWeekNumber)?.phase ?? null,
);

// 27 cards is a long scroll; land on this week rather than week 1.
onMounted(() => {
  if (data.value) document.getElementById(`week-${data.value.currentWeekNumber}`)?.scrollIntoView({ block: "start" });
});
</script>
