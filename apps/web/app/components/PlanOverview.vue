<template>
  <div class="space-y-3">
    <PhaseBlocks :phases="overview.phases" :current-week="overview.currentWeekNumber" />

    <div class="overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <button
        v-for="w in overview.weeks"
        :key="w.number"
        type="button"
        class="flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-raised"
        :class="w.status === 'current' ? 'bg-accent-50' : ''"
        @click="$emit('select', w.startDate)"
      >
        <span
          class="tnum w-6 shrink-0 text-xs font-semibold"
          :class="w.status === 'current' ? 'text-accent-700' : 'text-subtle'"
        >
          {{ w.number }}
        </span>

        <span class="w-16 shrink-0">
          <PhaseChip :phase="w.phase" />
        </span>

        <!-- Bar scale comes from the server so it can't disagree per-component. -->
        <span class="flex h-8 flex-1 items-end">
          <span
            class="w-full rounded-sm transition-all"
            :class="barClass(w)"
            :style="{ height: `${barHeight(w.plannedDistanceM)}%` }"
          />
        </span>

        <span class="tnum w-20 shrink-0 text-right text-xs">
          <span class="font-semibold text-ink">{{ formatDistance(w.plannedDistanceM) }}</span>
          <span class="text-subtle"> km</span>
          <span v-if="w.status !== 'upcoming' && w.actualDistanceM > 0" class="block text-[10px] text-accent-700">
            {{ formatDistance(w.actualDistanceM) }} done
          </span>
        </span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Week {
  number: number;
  startDate: string;
  phase: string | null;
  plannedDistanceM: number;
  actualDistanceM: number;
  status: string;
}

const props = defineProps<{
  overview: {
    weeks: Week[];
    phases: { phase: string; startWeek: number; endWeek: number }[];
    currentWeekNumber: number;
    maxPlannedDistanceM: number;
  };
}>();

defineEmits<{ select: [weekStart: string] }>();

// Floored so a zero-volume week (week 1 has no distance-prescribed sessions)
// still renders as a row rather than vanishing.
function barHeight(planned: number): number {
  return Math.max((planned / props.overview.maxPlannedDistanceM) * 100, 4);
}

function barClass(w: Week): string {
  if (w.status === "current") return "bg-accent-600";
  if (w.status === "done") return "bg-accent-300";
  return "bg-line-strong";
}
</script>
