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
  sessions: { completion: { state: string } }[];
  unplanned: { state: string };
}

withDefaults(defineProps<{ days: Day[]; selectable?: boolean }>(), { selectable: false });
defineEmits<{ select: [date: string] }>();

// The dot carries the day's state at a glance: filled green for done, amber
// for partial, red for missed, outlined for a session still ahead, and nothing
// at all for a rest day.
function dotClass(day: Day): string {
  const states = day.sessions.map((s) => s.completion.state);
  if (states.length === 0) return day.unplanned.state === "unplanned" ? "bg-accent-300" : "bg-transparent";
  // The dot reads as the least finished session of the day.
  for (const state of ["missed", "partial"]) {
    if (states.includes(state)) return state === "missed" ? "bg-verdict-regress" : "bg-verdict-hold";
  }
  if (states.every((state) => state === "completed")) return "bg-verdict-progress";
  return "bg-line-strong";
}
</script>
