<template>
  <span
    class="inline-flex items-center rounded-pill px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide"
    :class="[style.solid, style.onSolid]"
  >
    {{ style.label }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{ verdict: string | null | undefined }>();
const style = computed(() => verdictStyle(props.verdict));
</script>
