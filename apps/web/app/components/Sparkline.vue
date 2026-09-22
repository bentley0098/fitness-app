<template>
  <LineChart :points="points" :variant="variant" compact area :show-baseline="false" />
</template>

<script setup lang="ts">
import type { ChartVariant } from "./LineChart.vue";

withDefaults(defineProps<{ points: (number | null)[]; variant?: ChartVariant }>(), {
  variant: "accent",
});
</script>
