<template>
  <div
    class="rounded-card border border-line bg-surface p-3 shadow-card"
    :class="size === 'lg' ? 'p-4' : ''"
  >
    <div class="flex items-center gap-1.5 text-subtle">
      <AppIcon v-if="icon" :name="icon" :size="14" />
      <span class="text-[11px] font-medium uppercase tracking-wide">{{ label }}</span>
    </div>

    <div class="mt-1.5 flex items-baseline gap-1">
      <span class="tnum font-semibold text-ink" :class="size === 'lg' ? 'text-2xl' : 'text-xl'">
        {{ value ?? DASH }}
      </span>
      <span v-if="value != null && unit" class="text-xs text-subtle">{{ unit }}</span>
    </div>

    <div v-if="sub || trend != null" class="mt-1 flex items-center gap-1.5 text-[11px]">
      <span v-if="trend != null" class="tnum font-semibold" :class="trendClass">
        {{ trend > 0 ? "+" : "" }}{{ formatNumber(trend, trendDigits) }}
      </span>
      <span v-if="sub" class="text-subtle">{{ sub }}</span>
    </div>

    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = withDefaults(
  defineProps<{
    label: string;
    value: string | number | null;
    unit?: string;
    icon?: string;
    sub?: string;
    /** Signed delta rendered under the value. */
    trend?: number | null;
    trendDigits?: number;
    /** Which direction of `trend` should read as good. */
    trendGood?: "up" | "down" | "none";
    size?: "sm" | "lg";
  }>(),
  { trend: null, trendDigits: 1, trendGood: "none", size: "sm" },
);

const trendClass = computed(() => {
  if (props.trend == null || props.trendGood === "none" || props.trend === 0) return "text-subtle";
  const good = props.trendGood === "up" ? props.trend > 0 : props.trend < 0;
  return good ? "text-verdict-progress" : "text-verdict-regress";
});
</script>
