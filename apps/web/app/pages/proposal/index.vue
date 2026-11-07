<template>
  <div class="space-y-4 p-4" :class="{ 'pb-28': pendingList.length }">
    <header>
      <NuxtLink to="/plan" class="mb-2 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        <AppIcon name="chevron-left" :size="14" /> Plan
      </NuxtLink>
      <h1 class="text-xl font-bold text-ink">Plan changes</h1>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load proposals" :skeletons="3">
      <template v-if="data">
        <p v-if="!pendingList.length && !data.recent.length" class="text-sm text-muted">No proposals yet.</p>

        <section v-if="pendingList.length" class="space-y-3">
          <div class="flex items-center justify-between">
            <SectionHeader title="Waiting for you" />
            <button v-if="pendingList.length > 1" class="text-xs font-medium text-accent-700" @click="toggleAll">
              {{ allSelected ? "Clear" : "Select all" }}
            </button>
          </div>

          <article
            v-for="p in pendingList"
            :key="p.id"
            class="rounded-card border bg-surface p-3.5 shadow-card transition-colors"
            :class="selected.has(p.id) ? 'border-accent-600' : 'border-line'"
          >
            <label class="flex cursor-pointer items-start gap-3">
              <input
                type="checkbox"
                class="mt-0.5 h-5 w-5 shrink-0 accent-accent-600"
                :checked="selected.has(p.id)"
                :disabled="busy"
                @change="toggle(p.id)"
              />
              <span class="text-sm text-ink">{{ p.rationale }}</span>
            </label>
            <div class="mt-3"><ProposalChanges :rows="p.rows" /></div>
            <ul v-if="p.volume.length" class="mt-2 space-y-0.5 text-xs text-muted">
              <li v-for="v in p.volume" :key="v.weekStart" class="tnum">
                Week of {{ formatDate(v.weekStart, SHORT) }}: {{ formatDistance(v.beforeM) }} → {{ formatDistance(v.afterM) }} km
              </li>
            </ul>
            <p v-if="errors[p.id]" class="mt-2 text-xs text-verdict-stop">{{ errors[p.id] }}</p>
          </article>
        </section>

        <section v-if="data.recent.length" class="space-y-2">
          <SectionHeader title="Earlier" />
          <NuxtLink
            v-for="p in data.recent"
            :key="p.id"
            :to="`/proposal/${p.id}`"
            class="block rounded-card border border-line bg-surface p-3.5 shadow-card"
          >
            <p class="text-sm text-ink">{{ p.rationale }}</p>
            <p class="mt-1 text-xs capitalize text-subtle">{{ p.status }}</p>
          </NuxtLink>
        </section>
      </template>
    </AsyncState>

    <div v-if="pendingList.length" class="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface/95 p-3 backdrop-blur" style="padding-bottom: calc(0.75rem + env(safe-area-inset-bottom))">
      <div class="mx-auto flex max-w-xl gap-3">
        <button
          class="flex-1 rounded-card bg-accent-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
          :disabled="busy || !selected.size"
          @click="decide('approve')"
        >
          Approve{{ selected.size ? ` (${selected.size})` : "" }}
        </button>
        <button
          class="flex-1 rounded-card border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink disabled:opacity-50"
          :disabled="busy || !selected.size"
          @click="decide('reject')"
        >
          Reject{{ selected.size ? ` (${selected.size})` : "" }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const SHORT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };

// ?detail=1 makes `pending` carry each proposal's rows and volume.
const { data, pending, error, refresh } = useApiFetch("/api/plan-proposals", { query: { detail: "1" } });

interface PendingView {
  id: string;
  rationale: string;
  rows: { kind: string; date: string | null; toDate: string | null; before: string | null; after: string | null }[];
  volume: { weekStart: string; beforeM: number; afterM: number }[];
}
const pendingList = computed(() => (data.value?.pending ?? []) as unknown as PendingView[]);

// Nothing is pre-selected: approving rewrites the plan, so it should be deliberate.
const selected = ref(new Set<string>());
const busy = ref(false);
const errors = ref<Record<string, string>>({});

const allSelected = computed(() => pendingList.value.length > 0 && pendingList.value.every((p) => selected.value.has(p.id)));

function toggle(id: string) {
  const next = new Set(selected.value);
  if (!next.delete(id)) next.add(id);
  selected.value = next;
}

function toggleAll() {
  selected.value = allSelected.value ? new Set() : new Set(pendingList.value.map((p) => p.id));
}

async function decide(action: "approve" | "reject") {
  busy.value = true;
  errors.value = {};
  // One at a time: each approval re-checks the plan as the last one left it.
  for (const id of [...selected.value]) {
    try {
      await $fetch(`/api/plan-proposals/${id}/${action}`, { method: "POST" });
      const next = new Set(selected.value);
      next.delete(id);
      selected.value = next;
    } catch (e: any) {
      errors.value[id] = e?.data?.statusMessage ?? e?.message ?? "Something went wrong.";
    }
  }
  busy.value = false;
  await refresh();
  // Anything that failed is still pending; keep it selected so it can be retried.
  const still = new Set(pendingList.value.map((p) => p.id));
  selected.value = new Set([...selected.value].filter((id) => still.has(id)));
}
</script>
