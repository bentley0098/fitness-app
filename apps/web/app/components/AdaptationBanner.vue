<template>
  <div class="rounded-card border p-4" :class="[style.border, style.soft, isStop ? 'shadow-raised' : '']">
    <div class="flex items-center gap-2">
      <VerdictBadge :verdict="verdict" />
      <span v-if="isStop" class="text-[11px] font-medium text-verdict-stop">Not dismissible — read below</span>
    </div>

    <p class="mt-2 text-sm leading-relaxed" :class="isStop ? 'text-ink' : 'text-muted'">{{ reason }}</p>

    <dl v-if="isStop" class="mt-3 grid grid-cols-2 gap-2 text-xs">
      <div>
        <dt class="text-subtle">Workload ratio</dt>
        <dd class="tnum font-semibold text-ink">{{ ratioLabel }}</dd>
      </div>
      <div>
        <dt class="text-subtle">HRV red flag</dt>
        <dd class="font-semibold text-ink">{{ signals.hrvRedFlag ? "yes" : "no" }}</dd>
      </div>
      <div>
        <dt class="text-subtle">Resting HR spike</dt>
        <dd class="font-semibold text-ink">{{ signals.restingHrSpike ? "yes" : "no" }}</dd>
      </div>
      <div>
        <dt class="text-subtle">Consider</dt>
        <dd class="font-semibold text-ink">medical advice before the next session</dd>
      </div>
    </dl>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const props = defineProps<{
  verdict: string;
  reason: string;
  signals: {
    workloadRatio: number | null;
    hrvRedFlag: boolean;
    restingHrSpike: boolean;
  };
}>();

// Deliberately not a dismissible-toast pattern for `stop` — highest
// consequence, styled to demand attention rather than blend in.
const style = computed(() => verdictStyle(props.verdict));
const isStop = computed(() => props.verdict === "stop");

// Infinity is a real value here (chronic load of zero against a non-zero
// acute week), and `Infinity.toFixed(2)` renders as "Infinity".
const ratioLabel = computed(() => {
  const r = props.signals.workloadRatio;
  if (r == null || !Number.isFinite(r)) return r == null ? DASH : "very high";
  return r.toFixed(2);
});
</script>
