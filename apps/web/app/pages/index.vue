<template>
  <div>
    <!-- The header and week strip sit together on their own panel. -->
    <div>
      <div class="rounded-b-3xl border-b border-line bg-gradient-to-t from-raised via-canvas via-60% to-canvas px-4 pb-3 pt-4 shadow-card">
        <header class="mb-3 flex items-baseline justify-between">
          <div>
            <div class="text-xs text-subtle">{{ todayLabel }}</div>
            <h1 class="text-xl font-bold text-ink">Today</h1>
          </div>
          <div class="flex items-center gap-3">
            <button
              type="button"
              class="flex items-center gap-1 text-xs font-medium text-accent-700 disabled:opacity-60"
              :disabled="syncing"
              @click="syncNow"
            >
              <AppIcon name="refresh" :size="14" :class="syncing ? 'animate-spin' : ''" />
              {{ syncing ? "Syncing…" : "Sync" }}
            </button>
            <NuxtLink to="/more/log" class="text-xs font-medium text-accent-700">Add note</NuxtLink>
          </div>
        </header>
        <p
          v-if="syncMessage"
          class="-mt-1 mb-2 text-right text-xs"
          :class="syncFailed ? 'text-verdict-regress' : 'text-subtle'"
          role="status"
        >
          {{ syncMessage }}
        </p>

        <WeekDayStrip
          v-if="initial"
          :weeks="stripWeeks"
          :selected="selected"
          :today-date="todayDate"
          @select="selected = $event"
          @swipe="changeWeek"
        />
      </div>
    </div>

    <div class="space-y-4 p-4">
      <ProposalBanner />

      <AsyncState :pending="pending && !initial" :error="error" title="Couldn't load your week" :skeletons="3">
        <template v-if="initial">
          <section class="space-y-2">
            <div class="flex items-center justify-between">
              <SectionHeader :title="selected === todayDate ? 'Today\'s workouts' : formatDate(selected, DAY_FORMAT)" />
              <button v-if="selected !== todayDate" type="button" class="text-xs font-medium text-accent-700" @click="goToday">
                Today
              </button>
            </div>

            <div v-if="!selectedDay" class="h-20 animate-pulse rounded-card bg-raised" />

            <template v-else>
              <template v-if="hasSessions">
                <DaySessionCard v-for="s in sessions" :key="s.id" :session="s" />
              </template>

              <div v-else class="rounded-card border border-line bg-surface p-4 shadow-card">
                <div class="flex items-center gap-2 text-sm font-medium text-ink">
                  <AppIcon name="rest" :size="16" class="text-subtle" />
                  Rest day
                </div>
                <p v-if="nextUp" class="mt-1 text-xs text-subtle">
                  Next up {{ formatDate(nextUp.date, DAY_FORMAT) }} · {{ nextUp.label }}
                </p>
                <div v-if="selectedDay.activities.length" class="mt-2.5 space-y-1.5 border-t border-line pt-2.5">
                  <p class="text-[11px] font-medium uppercase tracking-wide text-subtle">Logged anyway</p>
                  <ActivityRow v-for="a in selectedDay.activities" :key="a.id" :activity="a" compact />
                </div>
              </div>

              <!-- Work done on a planned day that no session claimed. -->
              <NuxtLink
                v-for="log in selectedDay.unplannedStrength"
                :key="log.id"
                :to="`/strength/log/${log.id}`"
                class="flex items-center gap-1.5 text-xs text-muted"
              >
                <AppIcon name="dumbbell" :size="13" />
                <span>{{ log.templateName }} · unplanned</span>
              </NuxtLink>
              <div v-if="hasSessions && selectedDay.unplanned.actualDistanceM > 0" class="flex items-center gap-1.5 text-xs text-muted">
                <AppIcon name="run" :size="13" />
                <span class="tnum">{{ formatDistance(selectedDay.unplanned.actualDistanceM) }} km unplanned</span>
              </div>
            </template>
          </section>
        </template>
      </AsyncState>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from "vue";
import type { StripWeek } from "~/components/WeekDayStrip.vue";
import { runsFirst } from "~/composables/sessionKind";

const DAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "short" };

const { data: initial, pending, error, refresh } = await useFetch("/api/plan-sessions");
type WeekData = NonNullable<typeof initial.value>;

// Weeks already loaded, by Monday. The strip shows the previous, current and
// next week at once, so a swipe has its destination ready.
const cache = reactive(new Map<string, WeekData>());
const centerStart = ref(initial.value?.week.startDate ?? "");
if (initial.value) cache.set(initial.value.week.startDate, initial.value);

const todayDate = initial.value?.days.find((d) => d.isToday)?.date ?? "";
const currentWeekStart = initial.value?.nav.currentWeekStart ?? centerStart.value;
const selected = ref(todayDate || (initial.value?.days[0]?.date ?? ""));

const inflight = new Set<string>();
async function loadWeek(start: string) {
  if (cache.has(start) || inflight.has(start)) return;
  inflight.add(start);
  try {
    cache.set(start, await $fetch<WeekData>("/api/plan-sessions", { query: { week: start } }));
  } catch {
    // A neighbour that fails to load just shows without its dots.
  } finally {
    inflight.delete(start);
  }
}

async function loadAround() {
  await loadWeek(centerStart.value);
  const nav = cache.get(centerStart.value)?.nav;
  await Promise.all([nav?.prevWeekStart, nav?.nextWeekStart].map((w) => (w ? loadWeek(w) : undefined)));
}
onMounted(loadAround);
watch(centerStart, loadAround);

function panel(start: string | null | undefined): StripWeek | null {
  if (!start) return null;
  const loaded = cache.get(start);
  return {
    start,
    days: loaded ? loaded.days : weekDatesFrom(start).map((date) => ({ date, sessions: [] })),
  };
}

const stripWeeks = computed(() => {
  const nav = cache.get(centerStart.value)?.nav;
  return [panel(nav?.prevWeekStart), panel(centerStart.value), panel(nav?.nextWeekStart)];
});

const allDays = computed(() => [...cache.values()].flatMap((w) => w.days));
const selectedDay = computed(() => allDays.value.find((d) => d.date === selected.value) ?? null);
const sessions = computed(() => runsFirst(selectedDay.value?.sessions ?? []));
const hasSessions = computed(() => sessions.value.length > 0);

// A new week lands on today if it is in that week, otherwise on the same
// weekday the user was looking at.
function changeWeek(direction: "next" | "prev") {
  const nav = cache.get(centerStart.value)?.nav;
  const target = direction === "next" ? nav?.nextWeekStart : nav?.prevWeekStart;
  if (!target) return;
  const dates = weekDatesFrom(target);
  const index = Math.max(0, weekDatesFrom(centerStart.value).indexOf(selected.value));
  selected.value = dates.includes(todayDate) ? todayDate : dates[index]!;
  centerStart.value = target;
}

function goToday() {
  centerStart.value = currentWeekStart;
  selected.value = todayDate;
}

// The next planned day after the one on screen, else the first session of a
// later week.
const nextUp = computed(() => {
  const day = selectedDay.value;
  if (!day) return null;
  const later = allDays.value
    .filter((d) => d.date > day.date && d.sessions.length)
    .sort((a, b) => a.date.localeCompare(b.date))[0];
  if (later) return { date: later.date, label: runsFirst(later.sessions)[0]!.typeLabel };
  return cache.get(centerStart.value)?.nextAfterWeek ?? null;
});

const syncing = ref(false);
const syncMessage = ref("");
const syncFailed = ref(false);

async function syncNow() {
  if (syncing.value) return;
  syncing.value = true;
  syncFailed.value = false;
  syncMessage.value = "";
  try {
    const res = await $fetch<{ newActivities: number; errors: string[] }>("/api/sync", { method: "POST" });
    await refresh();
    cache.clear();
    if (initial.value) cache.set(initial.value.week.startDate, initial.value);
    await loadAround();
    const found = res.newActivities
      ? `${res.newActivities} new ${res.newActivities === 1 ? "activity" : "activities"}`
      : "no new activities";
    syncFailed.value = res.errors.length > 0;
    syncMessage.value = res.errors.length ? `Synced with ${res.errors.length} error(s): ${res.errors[0]}` : `Synced · ${found}`;
  } catch (e: any) {
    syncFailed.value = true;
    syncMessage.value = e?.data?.statusMessage ?? e?.statusMessage ?? "Sync failed";
  } finally {
    syncing.value = false;
  }
}

const todayLabel = new Date().toLocaleDateString(undefined, {
  weekday: "long",
  day: "numeric",
  month: "long",
});
</script>
