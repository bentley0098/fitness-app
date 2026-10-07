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
const route = useRoute();
const { data, pending, error } = await useFetch(() => `/api/strength/templates/${route.params.id}`);

function formatRest(seconds: number): string {
  if (seconds < 60) return `${seconds} s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return s ? `${m} min ${s} s` : `${m} min`;
}
</script>
