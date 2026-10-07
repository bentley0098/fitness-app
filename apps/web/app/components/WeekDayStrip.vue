<template>
  <div class="flex gap-1">
    <button
      v-for="day in days"
      :key="day.date"
      type="button"
      class="flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2 transition-colors hover:bg-raised"
      :aria-pressed="day.date === selected"
      @click="$emit('select', day.date)"
    >
      <span class="text-[10px] font-medium uppercase text-subtle">{{ weekdayShort(day.date) }}</span>
      <span
        class="tnum flex h-8 w-8 items-center justify-center rounded-pill text-sm font-semibold"
        :class="[
          day.isToday ? 'bg-accent-600 text-white' : 'text-ink',
          day.date === selected && !day.isToday ? 'ring-2 ring-accent-600' : '',
          day.date === selected && day.isToday ? 'ring-2 ring-accent-600 ring-offset-2 ring-offset-canvas' : '',
        ]"
      >
        {{ dayOfMonth(day.date) }}
      </span>
      <!-- One dot per session, runs first: filled once done, outlined while ahead. -->
      <span class="flex h-2 items-center gap-0.5">
        <span
          v-for="s in sorted(day.sessions)"
          :key="s.id"
          class="h-1.5 w-1.5 rounded-pill border"
          :class="[KIND_BORDER[sessionKind(s.type)], s.completion.state === 'completed' ? KIND_BAR[sessionKind(s.type)] : '']"
        />
      </span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { KIND_BAR, KIND_BORDER, runsFirst, sessionKind } from "~/composables/sessionKind";

interface StripSession {
  id: string;
  type: string;
  completion: { state: string };
}

defineProps<{
  days: { date: string; isToday: boolean; sessions: StripSession[] }[];
  selected: string;
}>();
defineEmits<{ select: [date: string] }>();

const sorted = runsFirst;
</script>
