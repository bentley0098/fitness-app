<template>
  <div class="space-y-4 p-4">
    <header>
      <h1 class="text-xl font-bold text-ink">Plan</h1>
      <p v-if="data" class="mt-0.5 text-sm text-subtle">
        {{ data.race.name }} · {{ data.race.daysUntil }} days to go
      </p>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load your plan" :skeletons="5">
      <template v-if="data">
        <WeekNav :week="data.week" :nav="data.nav" :total-weeks="data.race.totalWeeks" @navigate="goToWeek" />

        <WeekStrip :days="data.days" />

        <!-- Week summary -->
        <div class="flex items-center gap-4 rounded-card border border-line bg-surface p-3.5 shadow-card">
          <ProgressRing :value="weekProgress" :size="56" :stroke="6">
            <span class="tnum text-xs font-bold text-ink">{{ Math.round(weekProgress * 100) }}%</span>
          </ProgressRing>
          <div class="min-w-0 flex-1">
            <div class="tnum text-base font-semibold text-ink">
              {{ formatDistance(data.week.actualDistanceM) }}
              <span class="text-sm font-normal text-subtle">/ {{ formatDistance(data.week.plannedDistanceM) }} km</span>
            </div>
            <p class="mt-0.5 text-xs text-subtle">
              {{ data.week.sessionsCompleted }} of {{ data.week.sessionsPlanned }} sessions ·
              {{ formatDuration(data.week.actualMovingTimeS) }} moving
            </p>
          </div>
        </div>

        <!-- Vertical day list. A 7-column grid is unreadable at phone width
             with labels like "15 min continuous (~2.5 km)". -->
        <section class="space-y-2">
          <SessionCard
            v-for="day in data.days"
            :key="day.date"
            :date="day.date"
            :is-today="day.isToday"
            :session="day.session"
            :completion="day.completion"
          />
        </section>

        <!-- Full 27-week plan, fetched only when opened. -->
        <section>
          <button
            type="button"
            class="flex w-full items-center justify-between rounded-card border border-line bg-surface p-3.5 text-left shadow-card transition-colors hover:bg-raised"
            @click="toggleOverview"
          >
            <span>
              <span class="block text-sm font-semibold text-ink">Full plan</span>
              <span class="block text-xs text-subtle">All {{ data.race.totalWeeks }} weeks to race day</span>
            </span>
            <AppIcon
              name="chevron-down"
              :size="18"
              class="text-subtle transition-transform"
              :class="overviewOpen ? 'rotate-180' : ''"
            />
          </button>

          <div v-if="overviewOpen" class="mt-3">
            <AsyncState :pending="overviewPending" :error="overviewError" title="Couldn't load the full plan">
              <PlanOverview v-if="overview" :overview="overview" @select="selectFromOverview" />
            </AsyncState>
          </div>
        </section>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const route = useRoute();
const router = useRouter();

// The selected week lives in the URL, not component state, so back/forward and
// a shared link both work. Pinia stays unused — this is the only cross-view
// state the app has.
const weekParam = computed(() => (typeof route.query.week === "string" ? route.query.week : undefined));

const { data, pending, error } = await useFetch("/api/plan-sessions", {
  query: computed(() => ({ week: weekParam.value })),
});

const overviewOpen = ref(false);
const {
  data: overview,
  pending: overviewPending,
  error: overviewError,
  execute: loadOverview,
} = await useFetch("/api/plan-sessions", {
  query: { view: "overview" },
  immediate: false,
});

async function toggleOverview() {
  overviewOpen.value = !overviewOpen.value;
  if (overviewOpen.value && !overview.value) await loadOverview();
}

function goToWeek(weekStart: string) {
  router.push({ query: { ...route.query, week: weekStart } });
}

function selectFromOverview(weekStart: string) {
  overviewOpen.value = false;
  goToWeek(weekStart);
}

const weekProgress = computed(() => {
  const w = data.value?.week;
  if (!w || !w.plannedDistanceM) return 0;
  return w.actualDistanceM / w.plannedDistanceM;
});
</script>
