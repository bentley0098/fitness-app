<template>
  <div>
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="min-w-0 text-sm font-semibold text-ink">
        <NuxtLink v-if="exercise.exerciseId" :to="`/strength/exercises/${exercise.exerciseId}`">{{ exercise.name }}</NuxtLink>
        <template v-else>{{ exercise.name }}</template>
      </h2>
      <span class="tnum shrink-0 text-xs text-subtle">{{ exercise.target }}</span>
    </div>
    <p v-if="exercise.note" class="mt-1 text-xs text-muted">{{ exercise.note }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ exercise: { exerciseId?: string; name: string; target: string; note: string | null } }>();
</script>
