<template>
  <div class="flex h-8 gap-0.5">
    <div
      v-for="(v, i) in verdicts"
      :key="i"
      class="flex-1 rounded-sm"
      :class="verdictStyle(v).solid"
      :title="v ?? 'no data'"
    />
  </div>
</template>

<script setup lang="ts">
// Colours come from verdictStyle() — the local colorFor() map this used to
// carry has been folded into the shared composable.
defineProps<{ verdicts: (string | null)[] }>();
</script>
