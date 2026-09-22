<template>
  <div
    class="rounded-card border bg-surface p-3.5 shadow-card transition-colors"
    :class="[isToday ? 'border-accent-500 ring-1 ring-accent-500/20' : 'border-line']"
  >
    <div class="flex items-start justify-between gap-3">
      <div class="min-w-0">
        <div class="flex items-center gap-2">
          <span class="text-xs font-semibold uppercase tracking-wide text-subtle">
            {{ weekdayShort(date) }} {{ dayOfMonth(date) }}
          </span>
          <StatPill v-if="isToday" tone="accent" label="Today" />
        </div>

        <p v-if="session" class="mt-1 truncate text-sm font-semibold text-ink">{{ session.label }}</p>
        <p v-else class="mt-1 text-sm font-medium text-subtle">Rest day</p>
      </div>

      <div class="flex shrink-0 items-center gap-2">
        <PhaseChip v-if="session" :phase="session.phase" />
        <span
          class="inline-flex h-6 w-6 items-center justify-center rounded-pill"
          :class="stateBadge.class"
          :title="stateBadge.title"
        >
          <AppIcon :name="stateBadge.icon" :size="13" :stroke-width="2.5" />
        </span>
      </div>
    </div>

    <!-- Planned vs actual, only once there's something to compare. -->
    <div v-if="session && showProgress" class="mt-3">
      <div class="flex items-baseline justify-between text-xs">
        <span class="tnum font-semibold text-ink">
          {{ formatDistance(completion.actualDistanceM) }}<span class="text-subtle"> / {{ targetLabel }}</span>
        </span>
        <span v-if="paceLabel" class="tnum text-subtle">{{ paceLabel }} /km</span>
      </div>
      <div class="mt-1.5 h-1.5 overflow-hidden rounded-pill bg-raised">
        <div class="h-full rounded-pill transition-all" :class="barClass" :style="{ width: `${barPct}%` }" />
      </div>
    </div>

    <!-- An unplanned run on a rest day still deserves credit. -->
    <div v-else-if="!session && completion.actualDistanceM > 0" class="mt-2 flex items-center gap-1.5 text-xs text-muted">
      <AppIcon name="run" :size="13" />
      <span class="tnum">{{ formatDistance(completion.actualDistanceM) }} km unplanned</span>
    </div>

    <p v-if="session?.changedBecause" class="mt-2 text-xs text-verdict-hold">{{ session.changedBecause }}</p>

    <!-- Engine approval state is separate from whether the run happened. -->
    <div v-if="session?.status === 'pending'" class="mt-2">
      <StatPill tone="warn" icon="alert" label="Revision pending approval" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Completion {
  state: string;
  actualDistanceM: number;
  actualMovingTimeS: number;
  targetDistanceM: number | null;
  targetDurationS: number | null;
  pct: number | null;
}

const props = defineProps<{
  date: string;
  isToday: boolean;
  session: {
    id: string;
    phase: string;
    type: string;
    label: string;
    status: string;
    changedBecause: string | null;
    targetDistanceM: number | null;
    targetDurationS: number | null;
  } | null;
  completion: Completion;
}>();

const STATE_BADGES: Record<string, { icon: string; class: string; title: string }> = {
  completed: { icon: "check", class: "bg-verdict-progress text-white", title: "Completed" },
  partial: { icon: "check", class: "bg-verdict-hold-soft text-verdict-hold", title: "Partially completed" },
  missed: { icon: "alert", class: "bg-verdict-regress-soft text-verdict-regress", title: "Missed" },
  today: { icon: "clock", class: "bg-accent-100 text-accent-700", title: "Due today" },
  upcoming: { icon: "clock", class: "bg-raised text-subtle", title: "Upcoming" },
  unplanned: { icon: "run", class: "bg-accent-100 text-accent-700", title: "Unplanned run" },
  rest: { icon: "rest", class: "bg-raised text-subtle", title: "Rest day" },
};

const stateBadge = computed(() => STATE_BADGES[props.completion.state] ?? STATE_BADGES.rest!);

// Only worth a bar once the session is under way or done — an untouched
// future session showing "0.0 / 5.0 km" reads as a failure rather than a plan.
const showProgress = computed(
  () => props.completion.actualDistanceM > 0 || ["completed", "partial", "missed"].includes(props.completion.state),
);

const targetLabel = computed(() => {
  if (props.session?.targetDistanceM != null) return `${formatDistance(props.session.targetDistanceM)} km`;
  if (props.session?.targetDurationS != null) return `${Math.round(props.session.targetDurationS / 60)} min`;
  return "—";
});

const barPct = computed(() => Math.min(Math.max((props.completion.pct ?? 0) * 100, 0), 100));

const barClass = computed(() =>
  ({
    completed: "bg-verdict-progress",
    partial: "bg-verdict-hold",
    missed: "bg-verdict-regress",
  })[props.completion.state] ?? "bg-accent-500",
);

const paceLabel = computed(() => {
  const p = paceFrom(props.completion.actualDistanceM, props.completion.actualMovingTimeS);
  return p ? formatPace(p) : null;
});
</script>
