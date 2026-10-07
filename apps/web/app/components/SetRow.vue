<template>
  <li class="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2">
    <span class="tnum text-xs font-semibold text-subtle">{{ row.setIndex + 1 }}</span>

    <div class="flex min-w-0 flex-col gap-1">
      <span v-if="label" class="truncate text-xs font-medium text-ink">{{ label }}</span>
      <div class="flex min-w-0 items-center gap-2">
        <template v-if="exercise.measure === 'reps'">
          <label class="flex items-center gap-1">
            <input
              v-model.number="row.reps"
              type="number"
              inputmode="numeric"
              min="0"
              class="tnum w-16 rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm text-ink"
              :aria-label="`${exercise.name} set ${row.setIndex + 1} reps`"
              @change="$emit('edit')"
            />
            <span class="text-xs text-subtle">reps</span>
          </label>
          <label class="flex items-center gap-1">
            <input
              v-model.number="row.weightKg"
              type="number"
              inputmode="decimal"
              step="0.5"
              min="0"
              placeholder="BW"
              class="tnum w-20 rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm text-ink"
              :aria-label="`${exercise.name} set ${row.setIndex + 1} weight in kilograms`"
              @change="$emit('edit')"
            />
            <span class="text-xs text-subtle">kg</span>
          </label>
        </template>
        <label v-else class="flex items-center gap-1">
          <input
            v-model.number="row.holdSeconds"
            type="number"
            inputmode="numeric"
            min="0"
            class="tnum w-20 rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm text-ink"
            :aria-label="`${exercise.name} set ${row.setIndex + 1} hold in seconds`"
            @change="$emit('edit')"
          />
          <span class="text-xs text-subtle">s</span>
        </label>
        <span v-if="exercise.perSide" class="text-[11px] text-subtle">each side</span>
        <span v-if="previousLabel" class="tnum truncate text-[11px] text-subtle">last {{ previousLabel }}</span>
      </div>
    </div>

    <button
      type="button"
      class="inline-flex h-9 w-9 items-center justify-center rounded-pill border transition-colors"
      :class="row.logged ? 'border-verdict-progress bg-verdict-progress text-white' : 'border-line-strong text-subtle'"
      :aria-label="row.logged ? `Un-log set ${row.setIndex + 1}` : `Log set ${row.setIndex + 1}`"
      :aria-pressed="row.logged"
      @click="$emit('toggle')"
    >
      <AppIcon name="check" :size="16" :stroke-width="2.5" />
    </button>
  </li>
</template>

<script setup lang="ts">
import { computed } from "vue";

export interface SetRowData {
  setIndex: number;
  logged: boolean;
  reps: number | null;
  holdSeconds: number | null;
  weightKg: number | null;
  previous: { reps: number | null; holdSeconds: number | null; weightKg: number | null } | null;
}

const props = defineProps<{
  // The row is edited in place: the page owns it, and saves it on change.
  row: SetRowData;
  exercise: { name: string; measure: "reps" | "hold"; perSide: boolean };
  /** Shown above the inputs when several exercises share a list, as in a superset. */
  label?: string;
}>();

defineEmits<{ toggle: []; edit: [] }>();

const previousLabel = computed(() => {
  const p = props.row.previous;
  if (!p) return null;
  if (props.exercise.measure === "hold") return p.holdSeconds != null ? `${p.holdSeconds} s` : null;
  if (p.reps == null) return null;
  return p.weightKg != null ? `${p.reps} × ${p.weightKg} kg` : `${p.reps} reps`;
});
</script>
