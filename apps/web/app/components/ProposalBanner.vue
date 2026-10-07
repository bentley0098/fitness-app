<template>
  <NuxtLink
    v-if="first"
    :to="count === 1 ? `/proposal/${first.id}` : '/proposal'"
    class="flex items-center justify-between gap-3 rounded-card border border-verdict-hold/30 bg-verdict-hold-soft p-3.5"
  >
    <span class="flex items-center gap-2 text-sm font-semibold text-verdict-hold">
      <AppIcon name="alert" :size="16" />
      {{ count === 1 ? "1 plan change waiting for you" : `${count} plan changes waiting for you` }}
    </span>
    <AppIcon name="chevron-right" :size="16" class="text-verdict-hold" />
  </NuxtLink>
</template>

<script setup lang="ts">
import { computed } from "vue";

// Claude proposes plan changes through the MCP; they only take effect once
// approved on the proposal screen this links to.
const { data } = await useFetch("/api/plan-proposals", { server: false, default: () => ({ pending: [] }) });

const count = computed(() => data.value?.pending.length ?? 0);
const first = computed(() => data.value?.pending[0] ?? null);
</script>
