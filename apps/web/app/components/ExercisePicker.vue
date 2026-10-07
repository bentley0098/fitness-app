<template>
  <form class="space-y-2 rounded-lg border border-line bg-canvas p-3" @submit.prevent="submit">
    <label class="block text-xs font-medium text-subtle" :for="inputId">{{ label }}</label>
    <input
      :id="inputId"
      v-model="name"
      :list="listId"
      type="text"
      autocomplete="off"
      placeholder="Exercise name"
      class="w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
    />
    <datalist :id="listId">
      <option v-for="e in library" :key="e.id" :value="e.name" />
    </datalist>

    <!-- A name that matches nothing in the library creates a new exercise,
         and then it needs to know how it is counted. -->
    <div v-if="isNew" class="flex flex-wrap items-center gap-3 text-xs text-muted">
      <span class="font-medium text-ink">New exercise</span>
      <select v-model="measure" class="rounded-lg border border-line bg-surface px-2 py-1 text-xs text-ink">
        <option value="reps">Reps (and weight)</option>
        <option value="hold">Timed hold</option>
      </select>
      <label class="flex items-center gap-1.5">
        <input v-model="perSide" type="checkbox" /> Per side
      </label>
    </div>

    <div class="flex gap-2">
      <button
        type="submit"
        class="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
        :disabled="!name.trim()"
      >
        {{ submitLabel }}
      </button>
      <button type="button" class="rounded-lg px-3 py-1.5 text-xs font-medium text-muted" @click="$emit('cancel')">
        Cancel
      </button>
    </div>
  </form>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
  library: { id: string; name: string }[];
  label: string;
  submitLabel: string;
}>();

const emit = defineEmits<{
  pick: [choice: { name: string; measure: "reps" | "hold"; perSide: boolean }];
  cancel: [];
}>();

const uid = useId();
const inputId = `exercise-${uid}`;
const listId = `exercises-${uid}`;

const name = ref("");
const measure = ref<"reps" | "hold">("reps");
const perSide = ref(false);

// Same matching as the server: case and spacing don't matter.
const key = (s: string) => s.trim().replace(/\s+/g, " ").toLowerCase();
const isNew = computed(() => name.value.trim() !== "" && !props.library.some((e) => key(e.name) === key(name.value)));

function submit() {
  if (!name.value.trim()) return;
  emit("pick", { name: name.value.trim(), measure: measure.value, perSide: perSide.value });
}
</script>
