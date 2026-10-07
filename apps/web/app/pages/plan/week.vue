<template>
  <div class="space-y-4 p-4">
    <header>
      <NuxtLink to="/plan" class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        ← All weeks
      </NuxtLink>
      <h1 class="text-xl font-bold text-ink">{{ data ? `Week ${data.week.number}` : "Week" }}</h1>
      <p v-if="data" class="mt-0.5 text-sm text-subtle">
        {{ data.race.name }} · {{ data.race.daysUntil }} days to go
      </p>
    </header>

    <ProposalBanner />

    <AsyncState :pending="pending" :error="error" title="Couldn't load your plan" :skeletons="5">
      <template v-if="data">
        <WeekNav :week="data.week" :nav="data.nav" :total-weeks="data.race.totalWeeks" @navigate="goToWeek" />

        <WeekStrip :days="data.days" />

        <!-- Week summary -->
        <div class="flex items-center gap-4 rounded-card border border-line bg-surface p-3.5 shadow-card">
          <ProgressRing :value="weekProgress" :size="56" :stroke="6">
            <span class="tnum text-xs font-bold text-ink">{{ Math.round(weekProgress * 100) }}%</span>
          </ProgressRing>
          <div class="min-w-0 flex-1">
            <div class="tnum text-base font-semibold text-ink">
              {{ formatDistance(data.week.actualDistanceM) }}
              <span class="text-sm font-normal text-subtle">/ {{ formatDistance(data.week.plannedDistanceM) }} km</span>
            </div>
            <p class="mt-0.5 text-xs text-subtle">
              {{ data.week.sessionsCompleted }} of {{ data.week.sessionsPlanned }} sessions ·
              {{ formatDuration(data.week.actualMovingTimeS) }} moving
            </p>
            <p v-if="data.week.strengthPlanned" class="mt-0.5 text-xs text-subtle">
              Strength {{ data.week.strengthCompleted }} of {{ data.week.strengthPlanned }} sessions
            </p>
          </div>
        </div>

        <!-- Vertical day list. A 7-column grid is unreadable at phone width
             with labels like "15 min continuous (~2.5 km)". -->
        <section
          ref="dayList"
          class="space-y-2"
          :class="drag.isDragging.value ? 'touch-none' : ''"
          @pointermove="drag.onPointerMove"
          @pointerup="drag.onPointerUp"
          @pointercancel="drag.cancel"
        >
          <div v-for="day in data.days" :key="day.date" :data-drop-key="day.date">
            <SessionCard
              :date="day.date"
              :is-today="day.isToday"
              :sessions="day.sessions"
              :unplanned="day.unplanned"
              :unplanned-strength="day.unplannedStrength"
              draggable
              :dragging-id="drag.activeKey.value"
              :is-drop-target="drag.isDragging.value && drag.overKey.value === day.date && draggedFrom?.date !== day.date"
              @grab="(event, sessionId) => drag.onPointerDown(event, sessionId, dateOf(sessionId) ?? day.date)"
            />
          </div>
        </section>

        <p v-if="moveError" class="text-xs text-verdict-regress">{{ moveError }}</p>

        <p v-else-if="!hasDragged" class="px-1 text-xs text-muted">
          Press and hold a session to move it to another day this week.
        </p>
      </template>
    </AsyncState>

    <!-- The card in hand. Fixed, so lifting it reflows nothing underneath and
         the drop-target rects stay valid for the whole gesture. -->
    <div
      v-if="drag.ghost.value && draggedSession"
      class="pointer-events-none fixed z-50"
      :style="{
        left: `${drag.ghost.value.x}px`,
        top: `${drag.ghost.value.y}px`,
        width: `${drag.ghost.value.width}px`,
      }"
    >
      <SessionRow :session="draggedSession" dragging />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const route = useRoute();
const router = useRouter();

// The selected week lives in the URL, not component state, so back/forward and
// a shared link both work. Pinia stays unused — this is the only cross-view
// state the app has.
const weekParam = computed(() => (typeof route.query.week === "string" ? route.query.week : undefined));

const { data, pending, error, refresh } = await useFetch("/api/plan-sessions", {
  query: computed(() => ({ week: weekParam.value })),
});

function goToWeek(weekStart: string) {
  router.push({ query: { ...route.query, week: weekStart } });
}

// --- Moving a session to another day -----------------------------------

const dayList = ref<HTMLElement | null>(null);
const moveError = ref<string | null>(null);
const hasDragged = ref(false);

const drag = useLongPressDrag({
  container: dayList,
  onDrop: (sessionId, toDate) => void moveSession(sessionId, toDate),
});

function dateOf(sessionId: string): string | undefined {
  return data.value?.days.find((d) => d.sessions.some((s) => s.id === sessionId))?.date;
}

const draggedFrom = computed(() => data.value?.days.find((d) => d.sessions.some((s) => s.id === drag.activeKey.value)) ?? null);
const draggedSession = computed(() => draggedFrom.value?.sessions.find((s) => s.id === drag.activeKey.value) ?? null);

async function moveSession(sessionId: string, toDate: string) {
  const days = data.value?.days;
  const from = days?.find((d) => d.sessions.some((s) => s.id === sessionId));
  const to = days?.find((d) => d.date === toDate);
  const session = from?.sessions.find((s) => s.id === sessionId);
  if (!days || !from || !to || !session || from === to) return;

  moveError.value = null;
  hasDragged.value = true;

  // Move it locally first so the card lands where it was dropped instead of
  // snapping back for the length of a round trip. Completion state can't be
  // re-derived here — it depends on which activities fall on which day — so
  // the response below replaces it a moment later.
  from.sessions = from.sessions.filter((s) => s.id !== sessionId);
  to.sessions = [...to.sessions, session];

  try {
    data.value = await $fetch("/api/plan-sessions/move", {
      method: "POST",
      body: { sessionId, toDate },
    });
  } catch (e) {
    // $fetch stringifies to '[POST] "/api/…": 500 …'; the useful part is the
    // statusMessage the endpoint set, which rides along on `data`.
    const detail = (e as { data?: { statusMessage?: string } })?.data?.statusMessage;
    moveError.value = detail || "Couldn't move that session.";
    await refresh();
  }
}

const weekProgress = computed(() => {
  const w = data.value?.week;
  if (!w || !w.plannedDistanceM) return 0;
  return w.actualDistanceM / w.plannedDistanceM;
});
</script>
