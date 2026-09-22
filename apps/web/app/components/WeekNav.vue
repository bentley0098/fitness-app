<template>
  <div class="flex items-center justify-between gap-2">
    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-pill border border-line bg-surface text-muted transition-colors enabled:hover:bg-raised disabled:opacity-30"
      :disabled="!nav.prevWeekStart"
      aria-label="Previous week"
      @click="$emit('navigate', nav.prevWeekStart!)"
    >
      <AppIcon name="chevron-left" :size="18" />
    </button>

    <div class="text-center">
      <div class="text-sm font-semibold text-ink">Week {{ week.number }} of {{ totalWeeks }}</div>
      <div class="mt-0.5 flex items-center justify-center gap-1.5">
        <span class="text-[11px] text-subtle">
          {{ formatDate(week.startDate, { day: "numeric", month: "short" }) }} –
          {{ formatDate(week.endDate, { day: "numeric", month: "short" }) }}
        </span>
        <PhaseChip v-if="week.phase" :phase="week.phase" />
      </div>
    </div>

    <button
      type="button"
      class="flex h-9 w-9 items-center justify-center rounded-pill border border-line bg-surface text-muted transition-colors enabled:hover:bg-raised disabled:opacity-30"
      :disabled="!nav.nextWeekStart"
      aria-label="Next week"
      @click="$emit('navigate', nav.nextWeekStart!)"
    >
      <AppIcon name="chevron-right" :size="18" />
    </button>
  </div>

  <!-- Only offered when you've navigated away from it. -->
  <div v-if="!isCurrentWeek" class="mt-2 text-center">
    <button
      type="button"
      class="text-xs font-medium text-accent-700"
      @click="$emit('navigate', nav.currentWeekStart)"
    >
      Jump to this week
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  week: { number: number; startDate: string; endDate: string; phase: string | null };
  nav: {
    prevWeekStart: string | null;
    nextWeekStart: string | null;
    currentWeekStart: string;
  };
  totalWeeks: number;
}>();

defineEmits<{ navigate: [weekStart: string] }>();

const isCurrentWeek = computed(() => props.week.startDate === props.nav.currentWeekStart);
</script>
