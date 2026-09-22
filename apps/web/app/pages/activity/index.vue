<template>
  <div class="space-y-4 p-4">
    <header>
      <h1 class="text-xl font-bold text-ink">Activity</h1>
      <p v-if="data" class="mt-0.5 text-sm text-subtle">
        {{ data.total }} {{ data.total === 1 ? "activity" : "activities" }} from Garmin
      </p>
    </header>

    <AsyncState :pending="pending && !loaded.length" :error="error" title="Couldn't load your activities" :skeletons="6">
      <template v-if="loaded.length">
        <section v-for="group in grouped" :key="group.month" class="space-y-2">
          <SectionHeader :title="group.label" :sub="groupSub(group)" />
          <div class="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
            <NuxtLink
              v-for="a in group.activities"
              :key="a.id"
              :to="`/activity/${a.id}`"
              class="block p-3 transition-colors hover:bg-raised"
            >
              <ActivityRow :activity="a" />
            </NuxtLink>
          </div>
        </section>

        <button
          v-if="hasMore"
          type="button"
          :disabled="loadingMore"
          class="w-full rounded-card border border-line bg-surface py-3 text-sm font-medium text-accent-700 shadow-card transition-colors hover:bg-raised disabled:opacity-50"
          @click="loadMore"
        >
          {{ loadingMore ? "Loading…" : "Load more" }}
        </button>
      </template>

      <div v-else class="rounded-card border border-line bg-surface p-6 text-center shadow-card">
        <AppIcon name="run" :size="28" class="mx-auto text-subtle" />
        <p class="mt-2 text-sm font-medium text-ink">No activities yet</p>
        <p class="mt-1 text-xs text-subtle">They'll appear here once the Garmin sync runs.</p>
      </div>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const PAGE_SIZE = 30;

interface ActivityItem {
  id: string;
  date: string;
  distanceM: number | null;
  movingTimeS: number | null;
  avgHr: number | null;
  vo2Max: number | null;
  avgPaceSPerKm: number | null;
  planSessionId: string | null;
}

const { data, pending, error } = await useFetch<{ activities: ActivityItem[]; total: number }>("/api/activities", {
  query: { limit: PAGE_SIZE, offset: 0 },
});

// Accumulated across pages; the initial fetch seeds it.
const extra = ref<ActivityItem[]>([]);
const loadingMore = ref(false);

const loaded = computed(() => [...(data.value?.activities ?? []), ...extra.value]);
const hasMore = computed(() => loaded.value.length < (data.value?.total ?? 0));

async function loadMore() {
  loadingMore.value = true;
  try {
    const next = await $fetch<{ activities: ActivityItem[] }>("/api/activities", {
      query: { limit: PAGE_SIZE, offset: loaded.value.length },
    });
    extra.value.push(...next.activities);
  } finally {
    loadingMore.value = false;
  }
}

const grouped = computed(() => {
  const groups = new Map<string, ActivityItem[]>();
  for (const a of loaded.value) {
    const month = a.date.slice(0, 7);
    if (!groups.has(month)) groups.set(month, []);
    groups.get(month)!.push(a);
  }
  return [...groups.entries()].map(([month, activities]) => ({
    month,
    label: formatMonthLabel(`${month}-01`),
    activities,
  }));
});

function groupSub(group: { activities: ActivityItem[] }): string {
  const km = group.activities.reduce((sum, a) => sum + (a.distanceM ?? 0), 0);
  return `${group.activities.length} runs · ${formatDistance(km)} km`;
}
</script>
