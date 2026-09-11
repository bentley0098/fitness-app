<template>
  <div class="rounded-lg bg-gray-900 border border-gray-800 p-3">
    <div class="text-xs text-gray-500">{{ label }}</div>
    <div class="mt-1 text-xl font-semibold tabular-nums">
      {{ value ?? "—" }}<span v-if="value != null && unit" class="text-sm text-gray-500 ml-1">{{ unit }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  label: string;
  value: string | number | null;
  unit?: string;
}>();
</script>
