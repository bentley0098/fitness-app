<template>
  <div class="flex gap-0.5 h-8">
    <div
      v-for="(v, i) in verdicts"
      :key="i"
      :class="['flex-1 rounded-sm', colorFor(v)]"
      :title="v ?? 'no data'"
    />
  </div>
</template>

<script setup lang="ts">
defineProps<{ verdicts: (string | null)[] }>();

function colorFor(v: string | null): string {
  switch (v) {
    case "progress":
      return "bg-emerald-500";
    case "hold":
      return "bg-amber-600";
    case "regress":
      return "bg-orange-600";
    case "stop":
      return "bg-red-500";
    default:
      return "bg-gray-800";
  }
}
</script>
