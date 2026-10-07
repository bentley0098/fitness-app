<template>
  <div class="space-y-4 p-4">
    <header>
      <NuxtLink to="/proposal" class="mb-2 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        <AppIcon name="chevron-left" :size="14" /> All plan changes
      </NuxtLink>
      <h1 class="text-xl font-bold text-ink">Proposed change</h1>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load this proposal" :skeletons="3">
      <template v-if="data">
        <div class="rounded-card border border-line bg-surface p-4 shadow-card">
          <p class="text-sm text-ink">{{ data.rationale }}</p>
          <div class="mt-2"><StatPill :tone="statusTone" :label="statusLabel" /></div>
          <p v-if="data.statusNote" class="mt-2 text-xs text-muted">{{ data.statusNote }}</p>
        </div>

        <ul class="space-y-2">
          <li v-for="(r, i) in data.rows" :key="i" class="rounded-card border border-line bg-surface p-3.5 shadow-card">
            <div class="text-xs font-semibold uppercase tracking-wide text-subtle">{{ formatDate(r.date, SHORT) }}<template v-if="r.toDate"> → {{ formatDate(r.toDate, SHORT) }}</template></div>
            <p v-if="r.before" class="mt-1 text-sm text-subtle" :class="{ 'line-through': r.before !== r.after }">{{ r.before }}</p>
            <p v-if="r.after && r.after !== r.before" class="text-sm font-semibold text-ink">{{ r.after }}</p>
            <p v-else-if="!r.after" class="text-sm font-semibold text-verdict-stop">Removed</p>
          </li>
        </ul>

        <ul v-if="data.volume.length" class="space-y-1 text-sm text-muted">
          <li v-for="v in data.volume" :key="v.weekStart" class="tnum">
            Week of {{ formatDate(v.weekStart, SHORT) }}: {{ formatDistance(v.beforeM) }} → {{ formatDistance(v.afterM) }} km
          </li>
        </ul>

        <p v-if="actionError" class="text-sm text-verdict-stop">{{ actionError }}</p>

        <div v-if="data.status === 'pending'" class="flex gap-3">
          <button
            class="flex-1 rounded-card bg-accent-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-50"
            :disabled="busy"
            @click="decide('approve')"
          >
            Approve all
          </button>
          <button
            class="flex-1 rounded-card border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink disabled:opacity-50"
            :disabled="busy"
            @click="decide('reject')"
          >
            Reject
          </button>
        </div>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const SHORT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };

const route = useRoute();
const { data, pending, error, refresh } = await useFetch(`/api/plan-proposals/${route.params.id}`);

const busy = ref(false);
const actionError = ref<string | null>(null);

async function decide(action: "approve" | "reject") {
  busy.value = true;
  actionError.value = null;
  try {
    await $fetch(`/api/plan-proposals/${route.params.id}/${action}`, { method: "POST" });
  } catch (e: any) {
    actionError.value = e?.data?.statusMessage ?? e?.message ?? "Something went wrong.";
  } finally {
    busy.value = false;
    await refresh();
  }
}

const LABELS: Record<string, string> = {
  pending: "Waiting for your approval",
  applied: "Applied",
  rejected: "Rejected",
  superseded: "Out of date",
  expired: "Expired",
};
const statusLabel = computed(() => LABELS[data.value?.status ?? ""] ?? data.value?.status ?? "");
const statusTone = computed(() => (data.value?.status === "pending" ? "warn" : data.value?.status === "applied" ? "accent" : "neutral"));
</script>
