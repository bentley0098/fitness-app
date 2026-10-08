<template>
  <section class="space-y-2">
    <SectionHeader title="Your progress">
      <template #action>
        <NuxtLink to="/progress" class="text-xs font-medium text-accent-700">All →</NuxtLink>
      </template>
    </SectionHeader>

    <!-- Bleeds to the screen edges so the next card peeks in as a cue to swipe. -->
    <div
      ref="scroller"
      class="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      :class="dragging ? 'cursor-grabbing select-none' : 'cursor-grab'"
      @pointerdown="onDown"
      @pointermove="onMove"
      @pointerup="onUp"
      @pointercancel="onUp"
      @click.capture="onClickCapture"
    >
      <article class="card">
        <div class="label">Weekly distance</div>
        <div class="mt-2"><WeeklyVolumeChart :weeks="data.weeklyVolume" /></div>
      </article>

      <article class="card">
        <div class="label">Latest from Garmin</div>
        <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
          <div v-for="m in garminStats" :key="m.label">
            <dt class="text-[11px] text-subtle">{{ m.label }}</dt>
            <dd class="tnum text-lg font-semibold text-ink">
              {{ m.value }}<span v-if="m.unit && m.value !== DASH" class="ml-1 text-xs font-normal text-subtle">{{ m.unit }}</span>
            </dd>
          </div>
        </dl>
      </article>

      <article class="card">
        <div class="label">Marathon prediction</div>
        <template v-if="marathon">
          <div class="mt-1 flex items-baseline gap-2">
            <span class="tnum text-2xl font-bold text-ink">{{ formatDuration(marathon.latest) }}</span>
            <span
              v-if="marathon.delta !== 0"
              class="tnum text-xs font-semibold"
              :class="marathon.delta < 0 ? 'text-verdict-progress' : 'text-verdict-regress'"
            >
              {{ marathon.delta < 0 ? "−" : "+" }}{{ formatDuration(Math.abs(marathon.delta)) }}
            </span>
          </div>
          <div class="mt-2"><LineChart :points="marathon.points" fit area :show-baseline="false" /></div>
          <p class="mt-1 text-[11px] text-subtle">Garmin · since {{ formatDate(marathon.since, { day: "numeric", month: "short" }) }}</p>
        </template>
        <p v-else class="mt-3 text-sm text-subtle">Predictions build up as Garmin syncs. Check back in a few days.</p>
      </article>

      <article class="card">
        <div class="label">Since week one</div>
        <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-3">
          <div v-for="t in totalStats" :key="t.label">
            <dt class="text-[11px] text-subtle">{{ t.label }}</dt>
            <dd class="tnum text-lg font-semibold text-ink">
              {{ t.value }}<span v-if="t.unit" class="ml-1 text-xs font-normal text-subtle">{{ t.unit }}</span>
            </dd>
          </div>
        </dl>
      </article>

      <div class="card !border-0 !bg-transparent !p-0 !shadow-none">
        <RaceCountdown :race="data.race" :phase="data.week.phase" class="h-full" />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

// The page owns the fetch; this only lays the cards out.
import type { buildDashboard } from "~~/server/utils/dashboardData";

type Dashboard = Awaited<ReturnType<typeof buildDashboard>>;
const props = defineProps<{ data: Dashboard }>();

const metrics = computed(() => props.data.today.metrics);

const garminStats = computed(() => {
  const m = metrics.value;
  const load = props.data.load;
  return [
    { label: "Training load", value: load.unbounded ? "High" : load.insufficientHistory ? DASH : formatNumber(load.ratio, 2), unit: "" },
    { label: "VO2 max", value: formatNumber(props.data.vo2Max.current, 1), unit: "" },
    { label: "Resting HR", value: formatNumber(m?.restingHr), unit: "bpm" },
    { label: "HRV", value: m?.hrvStatus ? humanizePhase(m.hrvStatus) : DASH, unit: "" },
    { label: "Sleep score", value: formatNumber(m?.sleep?.score), unit: "" },
    { label: "Body battery", value: formatNumber(m?.bodyBatteryMax), unit: "" },
  ];
});

const marathon = computed(() => {
  const h = props.data.marathonHistory;
  if (h.length < 2) return null;
  return {
    points: h.map((r) => r.seconds),
    latest: h[h.length - 1]!.seconds,
    delta: h[h.length - 1]!.seconds - h[0]!.seconds,
    since: h[0]!.date,
  };
});

const totalStats = computed(() => {
  const t = props.data.totals;
  return [
    { label: "Distance", value: formatDistance(t.distanceM, 0), unit: "km" },
    { label: "Time running", value: formatHoursMinutes(t.movingTimeS), unit: "" },
    { label: "Runs", value: String(t.runs), unit: "" },
    { label: "Longest run", value: formatDistance(t.longestRunM), unit: "km" },
    { label: "Strength sessions", value: String(t.strengthSessions), unit: "" },
    { label: "Weeks done", value: `${t.weeksDone}/${props.data.race.totalWeeks}`, unit: "" },
  ];
});

// Touch and trackpads scroll natively; a mouse can't, so it drags the strip.
const scroller = ref<HTMLElement | null>(null);
const dragging = ref(false);
let startX = 0;
let startScroll = 0;
let moved = false;

function onDown(e: PointerEvent) {
  if (e.pointerType !== "mouse" || !scroller.value) return;
  startX = e.clientX;
  startScroll = scroller.value.scrollLeft;
  moved = false;
  dragging.value = true;
  scroller.value.style.scrollSnapType = "none";
  scroller.value.setPointerCapture(e.pointerId);
}
function onMove(e: PointerEvent) {
  if (!dragging.value || !scroller.value) return;
  const dx = e.clientX - startX;
  if (Math.abs(dx) > 4) moved = true;
  scroller.value.scrollLeft = startScroll - dx;
}
function onUp(e: PointerEvent) {
  if (!dragging.value || !scroller.value) return;
  dragging.value = false;
  scroller.value.style.scrollSnapType = "";
  scroller.value.releasePointerCapture(e.pointerId);
}
// A drag that ends over a link or chart dot shouldn't also activate it.
function onClickCapture(e: MouseEvent) {
  if (moved) {
    e.preventDefault();
    e.stopPropagation();
    moved = false;
  }
}
</script>

<style scoped>
.card {
  @apply w-[85%] max-w-sm shrink-0 snap-center rounded-card border border-line bg-surface p-4 shadow-card;
}
.label {
  @apply text-[11px] font-medium uppercase tracking-wide text-subtle;
}
</style>
