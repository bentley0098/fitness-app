<template>
  <div class="space-y-4 p-4">
    <header class="flex items-baseline justify-between">
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
      class="-mt-2 text-right text-xs"
      :class="syncFailed ? 'text-verdict-regress' : 'text-subtle'"
      role="status"
    >
      {{ syncMessage }}
    </p>

    <ProposalBanner />

    <AsyncState :pending="pending && !data" :error="error" title="Couldn't load your week" :skeletons="3">
      <template v-if="data && selectedDay">
        <WeekDayStrip :days="data.days" :selected="selected" @select="selected = $event" @swipe="changeWeek" />

        <section class="space-y-2">
          <div class="flex items-center justify-between">
            <SectionHeader :title="selectedDay.isToday ? 'Today\'s workouts' : formatDate(selectedDay.date, DAY_FORMAT)" />
            <button
              v-if="!selectedDay.isToday"
              type="button"
              class="text-xs font-medium text-accent-700"
              @click="goToday"
            >
              Today
            </button>
          </div>

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
        </section>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { runsFirst } from "~/composables/sessionKind";

const DAY_FORMAT: Intl.DateTimeFormatOptions = { weekday: "long", day: "numeric", month: "short" };

// The week on screen; undefined means the current one.
const weekStart = ref<string | undefined>(undefined);
const { data, pending, error, refresh } = await useFetch("/api/plan-sessions", {
  query: computed(() => ({ week: weekStart.value })),
});

const selected = ref(data.value?.days.find((d) => d.isToday)?.date ?? data.value?.days[0]?.date ?? "");

// A new week lands on today if it is in that week, otherwise on the same
// weekday the user was looking at.
let keepIndex = 0;
watch(
  () => data.value?.week.startDate,
  () => {
    const days = data.value?.days;
    if (!days) return;
    selected.value = (days.find((d) => d.isToday) ?? days[keepIndex] ?? days[0]!).date;
  },
);

function changeWeek(direction: "next" | "prev") {
  const nav = data.value?.nav;
  const target = direction === "next" ? nav?.nextWeekStart : nav?.prevWeekStart;
  if (!target) return;
  keepIndex = Math.max(0, data.value!.days.findIndex((d) => d.date === selected.value));
  weekStart.value = target;
}

function goToday() {
  const nav = data.value?.nav;
  if (!nav) return;
  // Already in the current week: just reselect today, no refetch needed.
  const today = data.value?.days.find((d) => d.isToday);
  if (today) selected.value = today.date;
  else weekStart.value = nav.currentWeekStart;
}

const selectedDay = computed(() => data.value?.days.find((d) => d.date === selected.value) ?? null);
const sessions = computed(() => runsFirst(selectedDay.value?.sessions ?? []));
const hasSessions = computed(() => sessions.value.length > 0);

// The next planned day after the one on screen: this week first, then the
// first session of a later week.
const nextUp = computed(() => {
  const day = selectedDay.value;
  if (!day || !data.value) return null;
  const later = data.value.days.find((d) => d.date > day.date && d.sessions.length);
  if (later) return { date: later.date, label: runsFirst(later.sessions)[0]!.typeLabel };
  return data.value.nextAfterWeek;
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
