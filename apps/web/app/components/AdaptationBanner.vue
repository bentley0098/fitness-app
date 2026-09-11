<template>
  <div :class="['rounded-xl p-4 border', style.wrapper]">
    <div class="flex items-center gap-2">
      <span :class="['inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide', style.badge]">
        {{ verdict }}
      </span>
      <span v-if="verdict === 'stop'" class="text-xs text-red-300">Not dismissible — read below</span>
    </div>
    <p :class="['mt-2 text-sm leading-relaxed', style.text]">{{ reason }}</p>

    <dl v-if="verdict === 'stop'" class="mt-3 grid grid-cols-2 gap-2 text-xs text-red-200">
      <div>
        <dt class="opacity-70">Workload ratio</dt>
        <dd class="font-mono">{{ signals.workloadRatio?.toFixed(2) ?? "—" }}</dd>
      </div>
      <div>
        <dt class="opacity-70">HRV red flag</dt>
        <dd>{{ signals.hrvRedFlag ? "yes" : "no" }}</dd>
      </div>
      <div>
        <dt class="opacity-70">Resting HR spike</dt>
        <dd>{{ signals.restingHrSpike ? "yes" : "no" }}</dd>
      </div>
      <div>
        <dt class="opacity-70">Consider</dt>
        <dd>medical advice before the next session</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  verdict: "progress" | "hold" | "regress" | "stop";
  reason: string;
  signals: {
    workloadRatio: number | null;
    hrvRedFlag: boolean;
    restingHrSpike: boolean;
  };
}>();

// Deliberately not a dismissible-toast pattern for `stop` — highest
// consequence, styled to demand attention rather than blend in.
const style = computed(() => {
  switch (props.verdict) {
    case "stop":
      return {
        wrapper: "bg-red-950 border-red-500 shadow-lg shadow-red-950/50",
        badge: "bg-red-500 text-red-950",
        text: "text-red-100",
      };
    case "regress":
      return { wrapper: "bg-orange-950/60 border-orange-700", badge: "bg-orange-600 text-orange-50", text: "text-orange-100" };
    case "hold":
      return { wrapper: "bg-amber-950/40 border-amber-800", badge: "bg-amber-700 text-amber-50", text: "text-amber-100" };
    case "progress":
      return { wrapper: "bg-emerald-950/40 border-emerald-800", badge: "bg-emerald-600 text-emerald-50", text: "text-emerald-100" };
  }
});
</script>
