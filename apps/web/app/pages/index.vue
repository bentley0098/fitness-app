<template>
  <div class="space-y-4 p-4">
    <header class="flex items-baseline justify-between">
      <div>
        <div class="text-xs text-subtle">{{ todayLabel }}</div>
        <h1 class="text-xl font-bold text-ink">Today</h1>
      </div>
      <NuxtLink to="/more/log" class="text-xs font-medium text-accent-700">Add note</NuxtLink>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load your dashboard" :skeletons="4">
      <template v-if="data">
        <RaceCountdown :race="data.race" :phase="data.week.phase" />

        <AdaptationBanner :verdict="data.verdict" :reason="data.reason" :signals="data.signals" />

        <!-- Today's session -->
        <section class="space-y-2">
          <SectionHeader title="Today's session" />
          <SessionCard
            v-if="data.today.session"
            :date="data.asOfDate"
            :is-today="true"
            :session="data.today.session"
            :completion="data.today.completion!"
          />
          <div v-else class="rounded-card border border-line bg-surface p-4 shadow-card">
            <div class="flex items-center gap-2 text-sm font-medium text-ink">
              <AppIcon name="rest" :size="16" class="text-subtle" />
              Rest day
            </div>
            <p v-if="data.nextSession" class="mt-1 text-xs text-subtle">
              Next up {{ formatDate(data.nextSession.date, { weekday: "long", day: "numeric", month: "short" }) }}
            </p>
            <div v-if="data.today.activities.length" class="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
              <p class="text-[11px] font-medium uppercase tracking-wide text-subtle">Logged today anyway</p>
              <ActivityRow v-for="a in data.today.activities" :key="a.id" :activity="a" compact />
            </div>
          </div>
        </section>

        <!-- This week -->
        <section class="space-y-2">
          <SectionHeader title="This week" :sub="`Week ${data.week.number} of ${data.race.totalWeeks}`">
            <template #action>
              <NuxtLink to="/plan" class="text-xs font-medium text-accent-700">Full plan →</NuxtLink>
            </template>
          </SectionHeader>

          <div class="flex items-center gap-4 rounded-card border border-line bg-surface p-4 shadow-card">
            <ProgressRing :value="weekProgress" :size="72" :stroke="7">
              <span class="tnum text-base font-bold text-ink">{{ Math.round(weekProgress * 100) }}<span class="text-[10px] font-medium text-subtle">%</span></span>
            </ProgressRing>
            <div class="min-w-0 flex-1">
              <div class="tnum text-lg font-semibold text-ink">
                {{ formatDistance(data.week.actualDistanceM) }}
                <span class="text-sm font-normal text-subtle">/ {{ formatDistance(data.week.plannedDistanceM) }} km</span>
              </div>
              <p class="mt-0.5 text-xs text-subtle">
                {{ data.week.sessionsCompleted }} of {{ data.week.sessionsPlanned }} sessions done
              </p>
              <div class="mt-2">
                <Sparkline :points="data.sparklines.weeklyVolumeKm" />
                <p class="mt-0.5 text-[10px] text-subtle">Weekly volume, last 8 weeks</p>
              </div>
            </div>
          </div>
        </section>

        <!-- Garmin stats -->
        <section class="space-y-2">
          <SectionHeader title="Latest from Garmin" :sub="lastSyncLabel" />

          <div class="grid grid-cols-2 gap-2">
            <MetricTile
              label="Training load"
              icon="gauge"
              :value="loadValue"
              :sub="loadSub"
            />
            <MetricTile
              label="VO2 max"
              icon="trend"
              :value="formatNumber(data.vo2Max.current, 1)"
              :trend="data.vo2Max.delta30d"
              trend-good="up"
              :sub="data.vo2Max.current == null ? 'No qualifying run yet' : '30-day change'"
            />
            <MetricTile
              label="Resting HR"
              icon="heart"
              :value="formatNumber(metrics?.restingHr)"
              unit="bpm"
              :trend="data.today.restingHrDelta28d"
              trend-good="down"
              sub="vs 28-day avg"
            >
              <div class="mt-2"><Sparkline :points="data.sparklines.restingHr" variant="danger" /></div>
            </MetricTile>
            <MetricTile
              label="HRV"
              icon="trend"
              :value="metrics?.hrvStatus ? humanizePhase(metrics.hrvStatus) : null"
              :sub="metrics?.hrvLastNightAvg != null ? `${formatNumber(metrics.hrvLastNightAvg)} ms last night` : undefined"
            />
            <SleepCard :sleep="metrics?.sleep ?? null" />
            <MetricTile
              label="Body battery"
              icon="battery"
              :value="formatNumber(metrics?.bodyBatteryMax)"
              :sub="metrics?.bodyBatteryMin != null ? `low of ${formatNumber(metrics.bodyBatteryMin)}` : undefined"
            >
              <div class="mt-2"><Sparkline :points="data.sparklines.bodyBattery" /></div>
            </MetricTile>
          </div>

          <div
            v-if="data.signals.lowBodyBatteryToday"
            class="rounded-card border border-line bg-raised p-3 text-xs text-muted"
          >
            Body battery is low today — a same-day caution, not a change to the plan. Consider an easier session if
            you have the flexibility.
          </div>
        </section>

        <!-- Recent activity -->
        <section v-if="data.recentActivities.length" class="space-y-2">
          <SectionHeader title="Recent runs">
            <template #action>
              <NuxtLink to="/activity" class="text-xs font-medium text-accent-700">All →</NuxtLink>
            </template>
          </SectionHeader>
          <div class="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <NuxtLink
              v-for="a in data.recentActivities"
              :key="a.id"
              :to="`/activity/${a.id}`"
              class="block p-3 transition-colors hover:bg-raised"
            >
              <ActivityRow :activity="a" />
            </NuxtLink>
          </div>
        </section>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const { data, pending, error } = await useFetch("/api/dashboard");

const todayLabel = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
});

const metrics = computed(() => data.value?.today.metrics ?? null);

const weekProgress = computed(() => {
  const w = data.value?.week;
  if (!w || !w.plannedDistanceM) return 0;
  return w.actualDistanceM / w.plannedDistanceM;
});

// Garmin's own Training Load isn't reachable through the Node SDK, so this is
// the engine's acute:chronic ratio — labelled honestly rather than dressed up
// as the vendor metric.
const loadValue = computed(() => {
  const l = data.value?.load;
  if (!l) return null;
  if (l.unbounded) return "High";
  if (l.insufficientHistory) return DASH;
  return formatNumber(l.ratio, 2);
});

const loadSub = computed(() => {
  const l = data.value?.load;
  if (!l) return undefined;
  if (l.insufficientHistory) return `Building baseline · ${l.historyDays}/${l.minHistoryDays} days`;
  return `Sweet spot ${l.sweetSpotMin}–${l.sweetSpotMax}`;
});

const lastSyncLabel = computed(() => {
  const d = data.value?.lastActivityAt;
  return d ? `Last activity ${formatDate(d, { day: "numeric", month: "short" })}` : undefined;
});
</script>
