<template>
  <div>
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="min-w-0 text-sm font-semibold text-ink">{{ exercise.name }}</h2>
      <span class="tnum shrink-0 text-xs text-subtle">{{ exercise.target }}</span>
    </div>
    <p v-if="exercise.note" class="mt-1 text-xs text-muted">{{ exercise.note }}</p>
  </div>
</template>

<script setup lang="ts">
defineProps<{ exercise: { name: string; target: string; note: string | null } }>();
</script>
