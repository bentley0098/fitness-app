<template>
  <div class="flex items-center gap-3">
    <span
      class="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill"
      :class="activity.planSessionId ? 'bg-accent-100 text-accent-700' : 'bg-raised text-subtle'"
    >
      <AppIcon name="run" :size="16" />
    </span>

    <div class="min-w-0 flex-1">
      <div class="flex items-baseline gap-2">
        <span class="tnum text-sm font-semibold text-ink">{{ formatDistance(activity.distanceM) }} km</span>
        <span class="tnum text-xs text-subtle">{{ formatDuration(activity.movingTimeS) }}</span>
        <span v-if="pace" class="tnum text-xs text-subtle">{{ pace }} /km</span>
      </div>
      <div class="mt-0.5 flex items-center gap-2 text-[11px] text-subtle">
        <span>{{ formatDate(activity.date, { weekday: "short", day: "numeric", month: "short" }) }}</span>
        <span v-if="activity.avgHr" class="tnum">{{ formatNumber(activity.avgHr) }} bpm</span>
        <span v-if="!compact && activity.vo2Max" class="tnum">VO2 {{ formatNumber(activity.vo2Max, 1) }}</span>
      </div>
    </div>

    <StatPill v-if="activity.planSessionId" tone="accent" icon="check" label="Plan" />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    activity: {
      id: string;
      date: string;
      distanceM: number | null;
      movingTimeS: number | null;
      avgHr: number | null;
      vo2Max?: number | null;
      avgPaceSPerKm?: number | null;
      planSessionId?: string | null;
    };
    compact?: boolean;
  }>(),
  { compact: false },
);

const pace = computed(() => {
  const p = props.activity.avgPaceSPerKm ?? paceFrom(props.activity.distanceM, props.activity.movingTimeS);
  return p ? formatPace(p) : null;
});
</script>
