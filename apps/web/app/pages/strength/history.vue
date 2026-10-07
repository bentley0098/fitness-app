<template>
  <div class="space-y-4 p-4">
    <header>
      <NuxtLink to="/strength" class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        ← Strength
      </NuxtLink>
      <h1 class="text-xl font-bold text-ink">History</h1>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load your sessions" :skeletons="4">
      <template v-if="data">
        <p v-if="!data.logs.length" class="text-sm text-subtle">No sessions yet.</p>

        <NuxtLink
          v-for="log in data.logs"
          :key="log.id"
          :to="`/strength/log/${log.id}`"
          class="block rounded-card border border-line bg-surface p-3.5 shadow-card transition-colors hover:bg-raised"
        >
          <div class="flex items-baseline justify-between gap-3">
            <span class="text-sm font-semibold text-ink">{{ log.templateName }}</span>
            <span class="text-xs text-subtle">{{ formatDate(log.date, { weekday: "short", day: "numeric", month: "short" }) }}</span>
          </div>
          <p class="mt-1 text-xs text-muted">
            <span class="capitalize">{{ log.kind }}</span> · {{ log.setsDone }} sets across {{ log.exercisesDone }} exercises
            <span v-if="log.status === 'in_progress'" class="font-medium text-verdict-hold"> · Unfinished</span>
          </p>
        </NuxtLink>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
const { data, pending, error } = await useFetch("/api/strength/logs");
</script>
