<template>
  <div
    class="flex gap-1 touch-pan-y select-none"
    :class="offset === 0 ? 'transition-transform' : ''"
    :style="{ transform: `translateX(${offset}px)` }"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="reset"
  >
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
import { ref } from "vue";
import { isHorizontalDrag, swipeDirection } from "~/composables/swipe";
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
const emit = defineEmits<{ select: [date: string]; swipe: [direction: "next" | "prev"] }>();

const sorted = runsFirst;

// Swiping the strip moves a week. Vertical drags are left to the page
// (touch-pan-y), and the strip only follows the finger once the drag is
// clearly sideways, so a tap on a day still selects it.
const offset = ref(0);
let start: { x: number; y: number } | null = null;
let following = false;

function onDown(event: PointerEvent) {
  start = { x: event.clientX, y: event.clientY };
  following = false;
}

function onMove(event: PointerEvent) {
  if (!start) return;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (!following && isHorizontalDrag(dx, dy)) {
    following = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  if (following) offset.value = dx * 0.5;
}

function onUp(event: PointerEvent) {
  if (start && following) {
    const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
    if (direction) emit("swipe", direction);
  }
  reset();
}

function reset() {
  start = null;
  following = false;
  offset.value = 0;
}
</script>
