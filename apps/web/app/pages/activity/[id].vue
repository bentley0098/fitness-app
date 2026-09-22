<template>
  <div class="space-y-4 p-4">
    <header>
      <NuxtLink to="/activity" class="mb-2 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        <AppIcon name="chevron-left" :size="14" /> Activity
      </NuxtLink>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load this activity" :skeletons="4">
      <template v-if="data">
        <div class="rounded-card bg-ink p-4 text-white">
          <div class="text-[11px] uppercase tracking-wide text-white/60">
            {{ humanizeType(data.activityType) }} · {{ formatDate(data.date) }}
          </div>
          <div class="mt-1 flex items-baseline gap-1.5">
            <span class="tnum text-3xl font-bold">{{ formatDistance(data.distanceM) }}</span>
            <span class="text-sm text-white/60">km</span>
          </div>
          <div class="mt-3 grid grid-cols-3 gap-2 border-t border-white/15 pt-3">
            <div>
              <div class="text-[10px] uppercase tracking-wide text-white/50">Time</div>
              <div class="tnum text-sm font-semibold">{{ formatDuration(data.movingTimeS) }}</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-white/50">Pace</div>
              <div class="tnum text-sm font-semibold">{{ formatPace(data.avgPaceSPerKm) }} /km</div>
            </div>
            <div>
              <div class="text-[10px] uppercase tracking-wide text-white/50">Avg HR</div>
              <div class="tnum text-sm font-semibold">{{ formatNumber(data.avgHr) }}</div>
            </div>
          </div>
        </div>

        <!-- Which planned session this run satisfied, if any. -->
        <div v-if="data.planSession" class="rounded-card border border-accent-500/30 bg-accent-50 p-3.5">
          <div class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-accent-700">
            <AppIcon name="check" :size="13" :stroke-width="2.5" /> Matched to your plan
          </div>
          <p class="mt-1 text-sm font-semibold text-ink">{{ data.planSession.label }}</p>
          <p v-if="data.planSession.targetDistanceM" class="mt-0.5 text-xs text-muted">
            Prescribed {{ formatDistance(data.planSession.targetDistanceM) }} km ·
            ran {{ formatDistance(data.distanceM) }} km
          </p>
        </div>

        <section class="space-y-2">
          <SectionHeader title="Details" />
          <div class="grid grid-cols-2 gap-2">
            <MetricTile label="Max HR" :value="formatNumber(data.maxHr)" unit="bpm" icon="heart" />
            <MetricTile label="Cadence" :value="formatNumber(data.cadence)" unit="spm" />
            <MetricTile label="Elevation" :value="formatNumber(data.elevationM)" unit="m" />
            <MetricTile label="Calories" :value="formatNumber(data.calories)" unit="kcal" />
            <MetricTile v-if="data.vo2Max != null" label="VO2 max" :value="formatNumber(data.vo2Max, 1)" icon="trend" />
            <MetricTile v-if="data.aerobicTe != null" label="Aerobic TE" :value="formatNumber(data.aerobicTe, 1)" icon="gauge" />
          </div>
        </section>

        <section v-if="data.splits?.length" class="space-y-2">
          <SectionHeader title="Splits" />
          <div class="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <div v-for="(s, i) in data.splits" :key="i" class="flex items-center justify-between px-3 py-2 text-xs">
              <span class="tnum w-8 font-semibold text-subtle">{{ i + 1 }}</span>
              <span class="tnum flex-1 font-medium text-ink">{{ formatDistance(s.distanceM, 2) }} km</span>
              <span class="tnum w-16 text-right text-muted">{{ formatDuration(s.durationS) }}</span>
              <span class="tnum w-16 text-right text-subtle">{{ splitPace(s) }}</span>
            </div>
          </div>
        </section>

        <section v-if="data.note?.note || data.note?.rpe != null" class="space-y-2">
          <SectionHeader title="Your note" />
          <div class="rounded-card border border-line bg-surface p-3.5 shadow-card">
            <StatPill v-if="data.note.rpe != null" tone="neutral" :label="`RPE ${data.note.rpe}`" />
            <p v-if="data.note.note" class="mt-2 whitespace-pre-line text-sm text-muted">{{ data.note.note }}</p>
          </div>
        </section>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();

const { data, pending, error } = await useFetch(`/api/activities/${route.params.id}`);

function splitPace(s: { distanceM: number | null; durationS: number | null }): string {
  const p = paceFrom(s.distanceM, s.durationS);
  return p ? `${formatPace(p)} /km` : DASH;
}
</script>
