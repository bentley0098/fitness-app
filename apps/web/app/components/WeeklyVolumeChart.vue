<template>
  <div>
    <div class="flex items-baseline justify-between">
      <div class="tnum text-lg font-semibold text-ink">
        {{ formatDistance(selected.distanceM) }}
        <span class="text-sm font-normal text-subtle">km</span>
      </div>
      <div class="tnum text-lg font-semibold text-ink">
        {{ selected.sessionsCompleted }}
        <span class="text-sm font-normal text-subtle">{{ selected.sessionsCompleted === 1 ? "session" : "sessions" }}</span>
      </div>
    </div>
    <p class="mt-0.5 text-xs text-subtle">
      {{ formatHoursMinutes(selected.movingTimeS) }} running · {{ weekLabel(selected) }}
    </p>

    <div class="relative mt-3 h-24 w-full">
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" class="absolute inset-0 h-full w-full overflow-visible">
        <polygon v-if="areaPoints" :points="areaPoints" class="fill-accent-500/15" />
        <polyline
          :points="linePoints"
          fill="none"
          class="stroke-accent-600"
          stroke-width="1.5"
          vector-effect="non-scaling-stroke"
          stroke-linejoin="round"
          stroke-linecap="round"
        />
      </svg>

      <button
        v-for="(w, i) in weeks"
        :key="w.weekStart"
        type="button"
        class="absolute inset-y-0 flex -translate-x-1/2 justify-center"
        style="width: 28px"
        :style="{ left: `${xPct(i)}%` }"
        :aria-label="`Week of ${w.weekStart}, ${formatDistance(w.distanceM)} km`"
        :aria-pressed="i === activeIndex"
        @mouseenter="selectedIndex = i"
        @focus="selectedIndex = i"
        @click="selectedIndex = i"
      >
        <span
          class="absolute left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-all"
          :class="dotClass(i)"
          :style="{ top: `${yPct(w.distanceM)}%` }"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

interface Week {
  weekStart: string;
  weekEnd: string;
  number: number;
  distanceM: number;
  movingTimeS: number;
  sessionsCompleted: number;
  isCurrent: boolean;
}

const props = defineProps<{ weeks: Week[] }>();

const selectedIndex = ref<number | null>(null);

const currentIndex = computed(() => {
  const idx = props.weeks.findIndex((w) => w.isCurrent);
  return idx === -1 ? props.weeks.length - 1 : idx;
});

const activeIndex = computed(() => selectedIndex.value ?? currentIndex.value);
const selected = computed(() => props.weeks[activeIndex.value]!);

function weekLabel(w: Week): string {
  if (w.isCurrent) return "This week";
  return `${formatDate(w.weekStart, { day: "numeric", month: "short" })} – ${formatDate(w.weekEnd, { day: "numeric", month: "short" })}`;
}

const maxDistanceM = computed(() => Math.max(...props.weeks.map((w) => w.distanceM), 1));

function xPct(i: number): number {
  return props.weeks.length > 1 ? (i / (props.weeks.length - 1)) * 100 : 50;
}

const PAD = 12;
function yPct(distanceM: number): number {
  return 100 - PAD - (distanceM / maxDistanceM.value) * (100 - PAD * 2);
}

const linePoints = computed(() =>
  props.weeks.map((w, i) => `${xPct(i)},${yPct(w.distanceM)}`).join(" "),
);

const areaPoints = computed(() => {
  if (props.weeks.length < 2) return null;
  const base = 100 - PAD;
  return `${xPct(0)},${base} ${linePoints.value} ${xPct(props.weeks.length - 1)},${base}`;
});

function dotClass(i: number): string {
  if (i === activeIndex.value) return "h-3 w-3 bg-accent-600 ring-4 ring-accent-500/20";
  if (props.weeks[i]!.isCurrent) return "h-2 w-2 bg-accent-600/60";
  return "h-1.5 w-1.5 bg-line-strong";
}
</script>
