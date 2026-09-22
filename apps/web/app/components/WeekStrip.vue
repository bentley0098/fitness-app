<template>
  <div class="flex gap-1">
    <button
      v-for="day in days"
      :key="day.date"
      type="button"
      class="flex flex-1 flex-col items-center gap-1 rounded-lg py-2 transition-colors"
      :class="day.isToday ? 'bg-accent-100' : 'hover:bg-raised'"
      :disabled="!selectable"
      @click="$emit('select', day.date)"
    >
      <span class="text-[10px] font-medium uppercase" :class="day.isToday ? 'text-accent-700' : 'text-subtle'">
        {{ weekdayShort(day.date).slice(0, 1) }}
      </span>
      <span class="tnum text-xs font-semibold" :class="day.isToday ? 'text-accent-700' : 'text-ink'">
        {{ dayOfMonth(day.date) }}
      </span>
      <span class="h-1.5 w-1.5 rounded-pill" :class="dotClass(day)" />
    </button>
  </div>
</template>

<script setup lang="ts">
interface Day {
  date: string;
  isToday: boolean;
  session: unknown | null;
  completion: { state: string };
}

withDefaults(defineProps<{ days: Day[]; selectable?: boolean }>(), { selectable: false });
defineEmits<{ select: [date: string] }>();

// The dot carries the day's state at a glance: filled green for done, amber
// for partial, red for missed, outlined for a session still ahead, and nothing
// at all for a rest day.
function dotClass(day: Day): string {
  switch (day.completion.state) {
    case "completed":
      return "bg-verdict-progress";
    case "partial":
      return "bg-verdict-hold";
    case "missed":
      return "bg-verdict-regress";
    case "unplanned":
      return "bg-accent-300";
    case "rest":
      return "bg-transparent";
    default:
      return day.session ? "bg-line-strong" : "bg-transparent";
  }
}
</script>
