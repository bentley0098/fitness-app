<template>
  <div class="space-y-4 p-4">
    <header>
      <NuxtLink to="/strength" class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        ← Strength
      </NuxtLink>
      <h1 class="text-xl font-bold text-ink">Exercises</h1>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load your exercises" :skeletons="4">
      <ul v-if="data" class="divide-y divide-line rounded-card border border-line bg-surface shadow-card">
        <li v-for="e in data.exercises" :key="e.id">
          <NuxtLink :to="`/strength/exercises/${e.id}`" class="flex items-baseline justify-between gap-3 p-3.5 hover:bg-raised">
            <span class="text-sm font-medium text-ink">{{ e.name }}</span>
            <span class="text-xs text-subtle">{{ e.measure === "hold" ? "Hold" : "Reps" }}{{ e.perSide ? " · per side" : "" }}</span>
          </NuxtLink>
        </li>
      </ul>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
const { data, pending, error } = await useFetch("/api/strength/exercises");
</script>
