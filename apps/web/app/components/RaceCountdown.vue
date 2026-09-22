<template>
  <div class="rounded-card bg-ink p-4 text-white">
    <div class="flex items-start justify-between gap-3">
      <div>
        <div class="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-white/60">
          <AppIcon name="flag" :size="13" />
          {{ race.name }}
        </div>
        <div class="mt-1 text-2xl font-bold tnum">
          {{ race.daysUntil > 0 ? race.daysUntil : 0 }}
          <span class="text-sm font-medium text-white/60">{{ race.daysUntil === 1 ? "day to go" : "days to go" }}</span>
        </div>
      </div>
      <div class="text-right">
        <div class="text-[11px] text-white/60">Week</div>
        <div class="tnum text-lg font-semibold">{{ race.weekNumber }}<span class="text-white/50">/{{ race.totalWeeks }}</span></div>
      </div>
    </div>

    <div class="mt-3">
      <div class="h-1.5 overflow-hidden rounded-pill bg-white/15">
        <div class="h-full rounded-pill bg-accent-500 transition-all" :style="{ width: `${progressPct}%` }" />
      </div>
      <div class="mt-1.5 flex justify-between text-[11px] text-white/50">
        <span v-if="phase">{{ humanizePhase(phase) }} phase</span>
        <span v-else>&nbsp;</span>
        <span>{{ formatDate(race.date, { day: "numeric", month: "short", year: "numeric" }) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  race: { name: string; date: string; daysUntil: number; weekNumber: number; totalWeeks: number };
  phase?: string | null;
}>();

const progressPct = computed(() =>
  Math.min(Math.max((props.race.weekNumber / props.race.totalWeeks) * 100, 0), 100),
);
</script>
