<template>
  <!-- Three weeks sit side by side (previous, this, next); dragging slides
       the track, and letting go slides the neighbour fully into view before
       the parent re-centres on it. -->
  <div
    ref="viewport"
    class="touch-pan-y select-none overflow-hidden"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="settle(null)"
  >
    <div
      ref="track"
      class="flex w-[300%]"
      :class="animating ? 'transition-transform duration-200 ease-out' : ''"
      :style="{ transform: `translateX(calc(-33.3333% + ${offset}px))` }"
      @transitionend.self="onTransitionEnd"
    >
      <div v-for="(week, i) in weeks" :key="week?.start ?? `empty-${i}`" class="flex w-1/3 gap-1">
        <button
          v-for="day in week?.days ?? []"
          :key="day.date"
          type="button"
          class="flex flex-1 flex-col items-center gap-1.5 rounded-lg py-2 transition-colors hover:bg-raised"
          :aria-pressed="day.date === selected"
          :tabindex="i === 1 ? 0 : -1"
          @click="$emit('select', day.date)"
        >
          <span class="text-[10px] font-medium uppercase text-subtle">{{ weekdayShort(day.date) }}</span>
          <span
            class="tnum flex h-8 w-8 items-center justify-center rounded-pill text-sm font-semibold"
            :class="[
              day.date === todayDate ? 'bg-accent-600 text-white' : 'text-ink',
              day.date === selected && day.date !== todayDate ? 'ring-2 ring-accent-600' : '',
              day.date === selected && day.date === todayDate ? 'ring-2 ring-accent-600 ring-offset-2 ring-offset-canvas' : '',
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
    </div>
  </div>
</template>

<script setup lang="ts">
import { nextTick, ref } from "vue";
import { isHorizontalDrag, swipeDirection } from "~/composables/swipe";
import { KIND_BAR, KIND_BORDER, runsFirst, sessionKind } from "~/composables/sessionKind";

interface StripSession {
  id: string;
  type: string;
  completion: { state: string };
}
export interface StripWeek {
  start: string;
  days: { date: string; sessions: StripSession[] }[];
}

const props = defineProps<{
  /** [previous, current, next]; null where the plan has no such week. */
  weeks: (StripWeek | null)[];
  selected: string;
  todayDate: string;
}>();
const emit = defineEmits<{ select: [date: string]; swipe: [direction: "next" | "prev"] }>();

const sorted = runsFirst;

const viewport = ref<HTMLElement | null>(null);
const offset = ref(0);
const animating = ref(false);

let start: { x: number; y: number } | null = null;
let following = false;
let width = 0;
let pending: "next" | "prev" | null = null;
let fallback: ReturnType<typeof setTimeout> | null = null;

function onDown(event: PointerEvent) {
  if (animating.value) return;
  start = { x: event.clientX, y: event.clientY };
  following = false;
  width = viewport.value?.clientWidth ?? 0;
}

function onMove(event: PointerEvent) {
  if (!start) return;
  const dx = event.clientX - start.x;
  const dy = event.clientY - start.y;
  if (!following && isHorizontalDrag(dx, dy)) {
    following = true;
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }
  if (!following) return;
  // Past the first or last week there is nothing to pull in: resist.
  const blocked = dx < 0 ? !props.weeks[2] : !props.weeks[0];
  offset.value = blocked ? dx * 0.25 : Math.max(-width, Math.min(width, dx));
}

function onUp(event: PointerEvent) {
  if (!start || !following) {
    start = null;
    return;
  }
  const direction = swipeDirection(event.clientX - start.x, event.clientY - start.y);
  start = null;
  following = false;
  const available = direction === "next" ? props.weeks[2] : direction === "prev" ? props.weeks[0] : null;
  settle(available ? direction : null);
}

// Slide to the neighbour (or back home), then hand over to the parent.
function settle(direction: "next" | "prev" | null) {
  start = null;
  following = false;
  pending = direction;
  animating.value = true;
  offset.value = direction === "next" ? -width : direction === "prev" ? width : 0;
  fallback = setTimeout(finish, 300);
}

function onTransitionEnd() {
  finish();
}

async function finish() {
  if (!animating.value) return;
  if (fallback) clearTimeout(fallback);
  fallback = null;
  const direction = pending;
  pending = null;
  if (direction) {
    // Re-centre without animation in the same frame the parent swaps weeks.
    animating.value = false;
    emit("swipe", direction);
    await nextTick();
    offset.value = 0;
  } else {
    animating.value = false;
  }
}
</script>
