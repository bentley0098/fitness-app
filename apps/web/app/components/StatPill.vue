<template>
  <span
    class="inline-flex items-center gap-1 rounded-pill px-2 py-0.5 text-[11px] font-semibold"
    :class="toneClass"
  >
    <AppIcon v-if="icon" :name="icon" :size="12" :stroke-width="2.25" />
    <slot>{{ label }}</slot>
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    label?: string;
    icon?: string;
    tone?: "neutral" | "accent" | "warn" | "danger" | "muted";
  }>(),
  { tone: "neutral" },
);

const toneClass = computed(
  () =>
    ({
      neutral: "bg-raised text-muted",
      muted: "bg-transparent text-subtle",
      accent: "bg-accent-100 text-accent-700",
      warn: "bg-verdict-hold-soft text-verdict-hold",
      danger: "bg-verdict-stop-soft text-verdict-stop",
    })[props.tone],
);
</script>
