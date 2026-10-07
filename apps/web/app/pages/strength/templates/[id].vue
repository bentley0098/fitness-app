<template>
  <div class="space-y-4 p-4">
    <header>
      <NuxtLink to="/strength" class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        ← Strength
      </NuxtLink>
      <h1 class="text-xl font-bold text-ink">{{ data?.name ?? "Template" }}</h1>
      <p v-if="data" class="mt-0.5 text-sm capitalize text-subtle">{{ data.kind }}</p>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load this template" :skeletons="4">
      <template v-if="data">
        <button
          type="button"
          class="block w-full rounded-card bg-accent-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
          :disabled="starting"
          @click="start"
        >
          {{ starting ? "Starting…" : "Start session" }}
        </button>
        <p v-if="startError" class="text-xs text-verdict-regress" role="alert">{{ startError }}</p>

        <div
          v-for="(group, i) in data.groups"
          :key="i"
          class="rounded-card border bg-surface shadow-card"
          :class="group.superset ? 'border-accent-500' : 'border-line'"
        >
          <p
            v-if="group.superset"
            class="px-3.5 pt-2.5 text-[11px] font-semibold uppercase tracking-wide text-accent-700"
          >
            Superset
          </p>
          <ul class="divide-y divide-line">
            <li v-for="slot in group.slots" :key="slot.id" class="p-3.5">
              <div class="flex items-baseline justify-between gap-3">
                <span class="min-w-0 text-sm font-semibold text-ink">{{ slot.exercise }}</span>
                <span class="tnum shrink-0 text-sm text-ink">{{ slot.target }}</span>
              </div>
              <p v-if="slot.restSeconds" class="mt-0.5 text-xs text-subtle">Rest {{ formatRest(slot.restSeconds) }}</p>
              <p v-if="slot.note" class="mt-1 text-xs text-muted">{{ slot.note }}</p>
            </li>
          </ul>
        </div>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const route = useRoute();
const { data, pending, error } = await useFetch(() => `/api/strength/templates/${route.params.id}`);

const starting = ref(false);
const startError = ref<string | null>(null);

async function start() {
  starting.value = true;
  startError.value = null;
  try {
    const { id } = await $fetch<{ id: string }>("/api/strength/logs", {
      method: "POST",
      body: { templateId: String(route.params.id) },
    });
    await navigateTo(`/strength/log/${id}`);
  } catch (e) {
    startError.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || "Couldn't start the session.";
  } finally {
    starting.value = false;
  }
}

function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}
</script>
