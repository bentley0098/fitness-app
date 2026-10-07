<template>
  <div class="space-y-4 p-4">
    <header>
      <NuxtLink :to="backTo" class="mb-2 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        <AppIcon name="chevron-left" :size="14" /> {{ backTo === "/activity" ? "Activity" : "Plan" }}
      </NuxtLink>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load this activity" :skeletons="4">
      <!-- A session that hasn't produced an activity: what the plan asks for. -->
      <template v-if="planned && plannedData">
        <div class="rounded-card bg-ink p-4 text-white">
          <div class="text-[11px] uppercase tracking-wide text-white/60">
            {{ plannedData.typeLabel }} · {{ formatDate(plannedData.date) }}
          </div>
          <div class="mt-1 flex items-baseline gap-1.5">
            <template v-if="plannedData.targetDistanceM != null">
              <span class="tnum text-3xl font-bold">{{ formatDistance(plannedData.targetDistanceM) }}</span>
              <span class="text-sm text-white/60">km</span>
            </template>
            <template v-else-if="plannedData.targetDurationS != null">
              <span class="tnum text-3xl font-bold">{{ Math.round(plannedData.targetDurationS / 60) }}</span>
              <span class="text-sm text-white/60">min</span>
            </template>
            <span v-else class="text-xl font-bold">{{ plannedData.label }}</span>
          </div>
          <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-white/15 pt-3 text-xs text-white/70">
            <span>Status: {{ plannedData.completion.state }}</span>
            <span v-if="plannedData.phase">Phase: {{ plannedData.phase }}</span>
          </div>
        </div>

        <p v-if="plannedData.changedBecause" class="rounded-card bg-verdict-hold-soft p-3 text-xs text-verdict-hold">
          {{ plannedData.changedBecause }}
        </p>

        <section v-if="plannedDetails.length" class="space-y-2">
          <SectionHeader title="Details" />
          <dl class="divide-y divide-line rounded-card border border-line bg-surface px-3.5 shadow-card">
            <div v-for="d in plannedDetails" :key="d.label" class="flex justify-between gap-3 py-2.5 text-sm">
              <dt class="text-subtle">{{ d.label }}</dt>
              <dd class="text-right font-medium text-ink">{{ d.value }}</dd>
            </div>
          </dl>
        </section>

        <section v-if="plannedData.isStrength" class="space-y-2">
          <SectionHeader :title="plannedData.label" />
          <div class="space-y-2">
            <div
              v-for="(group, i) in plannedData.template?.groups ?? []"
              :key="i"
              class="divide-y divide-line rounded-card border bg-surface px-3.5 shadow-card"
              :class="group.superset ? 'border-accent-500/40' : 'border-line'"
            >
              <p v-if="group.superset" class="pt-2 text-[10px] font-semibold uppercase tracking-wide text-accent-700">Superset</p>
              <div v-for="slot in group.slots" :key="slot.id" class="flex items-baseline justify-between gap-3 py-2.5 text-sm">
                <span class="font-medium text-ink">{{ slot.exercise }}</span>
                <span class="tnum text-subtle">{{ slot.target }}</span>
              </div>
            </div>
            <p v-if="!plannedData.template?.groups?.length" class="text-sm text-subtle">No exercises found for this session.</p>
          </div>

          <div class="flex items-center gap-3 pt-1">
            <NuxtLink
              v-if="plannedData.completion.logId"
              :to="`/strength/log/${plannedData.completion.logId}`"
              class="rounded-lg bg-raised px-3 py-1.5 text-xs font-semibold text-accent-700"
            >
              {{ plannedData.completion.state === "completed" ? "View session" : "Resume" }}
            </NuxtLink>
            <button
              v-else-if="plannedData.templateId"
              type="button"
              class="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
              :disabled="starting"
              @click="start"
            >
              {{ starting ? "Starting…" : "Start" }}
            </button>
            <span v-if="startError" class="text-xs text-verdict-regress" role="alert">{{ startError }}</span>
          </div>
        </section>
      </template>

      <template v-else-if="data">
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
import { computed } from "vue";

const route = useRoute();

// ?planned=1 means the id is a plan session, not a Garmin activity.
const planned = computed(() => route.query.planned === "1");

// Only the fetch that applies runs; the other stays idle.
const { data, pending: activityPending, error: activityError } = await useFetch(`/api/activities/${route.params.id}`, {
  immediate: !planned.value,
});
const {
  data: plannedData,
  pending: plannedPending,
  error: plannedError,
} = await useFetch(`/api/plan-sessions/${route.params.id}`, { immediate: planned.value });

const pending = computed(() => (planned.value ? plannedPending.value : activityPending.value));
const error = computed(() => (planned.value ? plannedError.value : activityError.value));

const backTo = computed(() => {
  if (planned.value) return plannedData.value ? `/plan/week?week=${plannedData.value.weekStart}` : "/plan";
  // Arrived from the week page: go back to the week this activity is in.
  if (route.query.from === "plan" && data.value) return `/plan/week?week=${data.value.date}`;
  return "/activity";
});

const { starting, startError, start } = useStartSession(() => ({
  id: plannedData.value?.id ?? "",
  templateId: plannedData.value?.templateId,
}));

// Whatever else the prescription carries, shown as-is.
const plannedDetails = computed(() => {
  const p = (plannedData.value?.prescription ?? {}) as Record<string, unknown>;
  const rows: { label: string; value: string }[] = [];
  const add = (label: string, v: unknown, suffix = "") => {
    if (v != null && v !== "") rows.push({ label, value: `${v}${suffix}` });
  };
  if (plannedData.value?.targetDistanceM != null && plannedData.value.targetDurationS != null) {
    add("Duration", Math.round(plannedData.value.targetDurationS / 60), " min");
  }
  add("Goal", p.goal);
  add("Pace", p.pace);
  add("Ratio", p.ratio, " run/walk");
  if (plannedData.value?.targetDistanceM == null || p.distanceKm == null) add("Approx distance", p.approxKm, " km");
  add("Note", p.note);
  return rows;
});

function splitPace(s: { distanceM: number | null; durationS: number | null }): string {
  const p = paceFrom(s.distanceM, s.durationS);
  return p ? `${formatPace(p)} /km` : DASH;
}
</script>
