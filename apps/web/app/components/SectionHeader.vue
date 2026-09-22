<template>
  <div class="flex items-baseline justify-between gap-3">
    <div>
      <h2 class="text-sm font-semibold text-ink">{{ title }}</h2>
      <p v-if="sub" class="mt-0.5 text-xs text-subtle">{{ sub }}</p>
    </div>
    <slot name="action" />
  </div>
</template>

<script setup lang="ts">
defineProps<{ title: string; sub?: string }>();
</script>
