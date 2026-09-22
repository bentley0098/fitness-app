<template>
  <div v-if="pending" class="space-y-3">
    <slot name="loading">
      <div v-for="n in skeletons" :key="n" class="h-20 rounded-card bg-raised animate-pulse" />
    </slot>
  </div>

  <div
    v-else-if="error"
    class="rounded-card border border-verdict-stop/30 bg-verdict-stop-soft p-4"
  >
    <div class="flex items-start gap-2.5">
      <AppIcon name="alert" class="text-verdict-stop mt-0.5 shrink-0" :size="18" />
      <div>
        <p class="text-sm font-medium text-verdict-stop">{{ title }}</p>
        <p class="mt-1 text-sm text-muted">{{ message }}</p>
      </div>
    </div>
  </div>

  <slot v-else />
</template>

<script setup lang="ts">
import { computed } from "vue";

// Every page repeated the same pending / error / data triple. This collapses
// it, and gives the error branch a real design — three of the four pages
// previously rendered nothing at all when a fetch failed.
const props = withDefaults(
  defineProps<{
    pending?: boolean;
    error?: unknown;
    title?: string;
    skeletons?: number;
  }>(),
  { pending: false, error: null, title: "Couldn't load this", skeletons: 3 },
);

const message = computed(() => {
  const e = props.error as { message?: string; statusMessage?: string } | null;
  return e?.statusMessage || e?.message || "Something went wrong fetching this data.";
});
</script>
