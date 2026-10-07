<template>
  <div class="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs font-medium text-accent-700">
    <button type="button" @click="$emit('add-set')">+ Set</button>
    <button type="button" :disabled="rows <= 1" class="disabled:opacity-40" @click="$emit('remove-set')">− Set</button>
    <button type="button" @click="$emit('swap')">Swap exercise</button>
  </div>
</template>

<script setup lang="ts">
defineProps<{ rows: number }>();
defineEmits<{ "add-set": []; "remove-set": []; swap: [] }>();
</script>
