<template>
  <div
    class="rounded-lg transition-all"
    :class="[
      // -webkit-touch-callout stops iOS popping its selection/callout UI on
      // the long press, which would fight the drag for the same gesture.
      draggable ? 'cursor-grab select-none [-webkit-touch-callout:none]' : '',
      // Held rows shrink a little rather than growing: at phone width the
      // ghost sits exactly over the day it's aiming at, so it has to leave a
      // margin for that day's highlight to show around it.
      dragging ? 'scale-[0.96] bg-surface p-3.5 shadow-lifted' : '',
      isSourceGap ? 'opacity-30' : '',
    ]"
  >
    <div class="flex items-start justify-between gap-3">
      <p class="min-w-0 flex-1 truncate text-sm font-semibold text-ink">{{ session.label }}</p>

      <div class="flex shrink-0 items-center gap-2">
        <PhaseChip :phase="session.phase" />
        <span
          class="inline-flex h-6 w-6 items-center justify-center rounded-pill"
          :class="stateBadge.class"
          :title="stateBadge.title"
        >
          <AppIcon :name="stateBadge.icon" :size="13" :stroke-width="2.5" />
        </span>
      </div>
    </div>

    <!-- Strength is done in the logger, not measured against a distance. -->
    <div v-if="session.isStrength" class="mt-2.5 flex items-center gap-3">
      <NuxtLink
        v-if="completion.logId"
        :to="`/strength/log/${completion.logId}`"
        class="rounded-lg bg-raised px-3 py-1.5 text-xs font-semibold text-accent-700"
      >
        {{ completion.state === "completed" ? "View session" : "Resume" }}
      </NuxtLink>
      <button
        v-else-if="session.templateId"
        type="button"
        class="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
        :disabled="starting"
        @click="start"
      >
        {{ starting ? "Starting…" : "Start" }}
      </button>
      <span v-if="startError" class="text-xs text-verdict-regress" role="alert">{{ startError }}</span>
    </div>

    <!-- Planned vs actual, only once there's something to compare. -->
    <div v-else-if="showProgress" class="mt-3">
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

    <p v-if="session.changedBecause" class="mt-2 text-xs text-verdict-hold">{{ session.changedBecause }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

interface Completion {
  state: string;
  actualDistanceM: number;
  actualMovingTimeS: number;
  targetDistanceM: number | null;
  targetDurationS: number | null;
  pct: number | null;
}

export interface SessionRowData {
  id: string;
  date?: string;
  phase: string;
  type: string;
  label: string;
  status: string;
  changedBecause: string | null;
  targetDistanceM: number | null;
  targetDurationS: number | null;
  completion: Completion & { logId?: string | null; activityIds?: string[] };
  /** Strength work: started in the logger from a template, rather than run. */
  isStrength?: boolean;
  templateId?: string | null;
}

const props = withDefaults(
  defineProps<{
    session: SessionRowData;
    /** Long-press drag affordances — the gesture itself lives in the parent. */
    draggable?: boolean;
    dragging?: boolean;
    /** This session is currently in hand, so show the hole it left. */
    isSourceGap?: boolean;
  }>(),
  { draggable: false, dragging: false, isSourceGap: false },
);

const completion = computed(() => props.session.completion);

const { starting, startError, start } = useStartSession(() => props.session);

const STATE_BADGES: Record<string, { icon: string; class: string; title: string }> = {
  completed: { icon: "check", class: "bg-verdict-progress text-white", title: "Completed" },
  partial: { icon: "check", class: "bg-verdict-hold-soft text-verdict-hold", title: "Partially completed" },
  missed: { icon: "alert", class: "bg-verdict-regress-soft text-verdict-regress", title: "Missed" },
  today: { icon: "clock", class: "bg-accent-100 text-accent-700", title: "Due today" },
  upcoming: { icon: "clock", class: "bg-raised text-subtle", title: "Upcoming" },
  unplanned: { icon: "run", class: "bg-accent-100 text-accent-700", title: "Unplanned run" },
  rest: { icon: "rest", class: "bg-raised text-subtle", title: "Rest day" },
};

const stateBadge = computed(() => STATE_BADGES[completion.value.state] ?? STATE_BADGES.rest!);

// Only worth a bar once the session is under way or done — an untouched
// future session showing "0.0 / 5.0 km" reads as a failure rather than a plan.
const showProgress = computed(
  () => completion.value.actualDistanceM > 0 || ["completed", "partial", "missed"].includes(completion.value.state),
);

const targetLabel = computed(() => {
  if (props.session.targetDistanceM != null) return `${formatDistance(props.session.targetDistanceM)} km`;
  if (props.session.targetDurationS != null) return `${Math.round(props.session.targetDurationS / 60)} min`;
  return "—";
});

const barPct = computed(() => Math.min(Math.max((completion.value.pct ?? 0) * 100, 0), 100));

const barClass = computed(() =>
  ({
    completed: "bg-verdict-progress",
    partial: "bg-verdict-hold",
    missed: "bg-verdict-regress",
  })[completion.value.state] ?? "bg-accent-500",
);

const paceLabel = computed(() => {
  const p = paceFrom(completion.value.actualDistanceM, completion.value.actualMovingTimeS);
  return p ? formatPace(p) : null;
});
</script>
