<template>
  <form class="space-y-4" @submit.prevent="save">
    <label class="block text-xs font-medium text-subtle">
      Name
      <input
        v-model="name"
        type="text"
        required
        class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink"
        placeholder="e.g. Gym C"
      />
    </label>

    <label v-if="!initial" class="block text-xs font-medium text-subtle">
      Kind
      <select v-model="kind" class="mt-1 w-full rounded-lg border border-line bg-surface px-3 py-2 text-sm text-ink">
        <option value="gym">Gym</option>
        <option value="physio">Physio</option>
      </select>
    </label>

    <datalist id="template-exercises">
      <option v-for="e in library" :key="e.id" :value="e.name" />
    </datalist>

    <div class="space-y-2">
      <div
        v-for="(slot, i) in slots"
        :key="slot.key"
        class="space-y-2 rounded-card border bg-surface p-3.5 shadow-card"
        :class="slot.linkNext || slots[i - 1]?.linkNext ? 'border-accent-500' : 'border-line'"
      >
        <div class="flex items-center gap-2">
          <input
            v-model="slot.exercise"
            list="template-exercises"
            type="text"
            autocomplete="off"
            placeholder="Exercise"
            class="min-w-0 flex-1 rounded-lg border border-line bg-canvas px-3 py-2 text-sm text-ink"
            :aria-label="`Exercise ${i + 1}`"
          />
          <button type="button" class="text-xs text-subtle disabled:opacity-30" :disabled="i === 0" aria-label="Move up" @click="move(i, -1)">↑</button>
          <button type="button" class="text-xs text-subtle disabled:opacity-30" :disabled="i === slots.length - 1" aria-label="Move down" @click="move(i, 1)">↓</button>
          <button type="button" class="text-xs text-verdict-regress" aria-label="Remove exercise" @click="slots.splice(i, 1)">✕</button>
        </div>

        <!-- A name that matches nothing creates a new exercise, which then needs to know how it is counted. -->
        <div v-if="isNew(slot)" class="flex flex-wrap items-center gap-3 text-xs text-muted">
          <span class="font-medium text-ink">New exercise</span>
          <select v-model="slot.measure" class="rounded-lg border border-line bg-canvas px-2 py-1 text-xs text-ink">
            <option value="reps">Reps (and weight)</option>
            <option value="hold">Timed hold</option>
          </select>
          <label class="flex items-center gap-1.5"><input v-model="slot.perSide" type="checkbox" /> Per side</label>
        </div>

        <div class="flex flex-wrap items-center gap-2 text-xs text-subtle">
          <label class="flex items-center gap-1">
            <input v-model.number="slot.sets" type="number" min="1" inputmode="numeric" class="tnum w-14 rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm text-ink" aria-label="Sets" />
            sets
          </label>
          <template v-if="measureOf(slot) === 'hold'">
            <label class="flex items-center gap-1">
              <input v-model.number="slot.holdSeconds" type="number" min="1" inputmode="numeric" class="tnum w-16 rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm text-ink" aria-label="Hold seconds" />
              s hold
            </label>
          </template>
          <template v-else>
            <label class="flex items-center gap-1">
              <input v-model.number="slot.repsMin" type="number" min="1" inputmode="numeric" class="tnum w-14 rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm text-ink" aria-label="Reps, or the lowest of a range" />
              –
              <input v-model.number="slot.repsMax" type="number" min="1" inputmode="numeric" placeholder="same" class="tnum w-14 rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm text-ink" aria-label="Top of the rep range" />
              reps
            </label>
          </template>
          <label class="flex items-center gap-1">
            <input v-model.number="slot.restSeconds" type="number" min="0" inputmode="numeric" placeholder="90" class="tnum w-16 rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm text-ink" aria-label="Rest seconds" />
            s rest
          </label>
        </div>

        <input v-model="slot.note" type="text" placeholder="Note (optional)" class="w-full rounded-lg border border-line bg-canvas px-3 py-1.5 text-xs text-ink" aria-label="Note" />

        <label v-if="i < slots.length - 1" class="flex items-center gap-1.5 text-xs font-medium text-accent-700">
          <input v-model="slot.linkNext" type="checkbox" /> Superset with the next exercise
        </label>
      </div>
    </div>

    <button type="button" class="text-xs font-medium text-accent-700" @click="addSlot">+ Add exercise</button>

    <p v-if="errorMessage" class="text-xs text-verdict-regress" role="alert">{{ errorMessage }}</p>

    <button type="submit" class="block w-full rounded-card bg-accent-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60" :disabled="saving">
      {{ saving ? "Saving…" : "Save template" }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { exerciseKey, linksToSupersetGroups, supersetGroupsToLinks } from "../../server/utils/strength";

interface Initial {
  id: string;
  name: string;
  kind: "gym" | "physio";
  slots: {
    exercise: string;
    measure: "reps" | "hold";
    perSide: boolean;
    sets: number;
    repsMin: number | null;
    repsMax: number | null;
    holdSeconds: number | null;
    restSeconds: number | null;
    supersetGroup: number | null;
    note: string | null;
  }[];
}

const props = defineProps<{ initial?: Initial | null }>();
const emit = defineEmits<{ saved: [id: string] }>();

const { data: libraryData } = await useFetch("/api/strength/exercises", { default: () => ({ exercises: [] }) });
const library = computed(() => libraryData.value.exercises);

interface SlotForm {
  key: number;
  exercise: string;
  measure: "reps" | "hold";
  perSide: boolean;
  sets: number;
  repsMin: number | null;
  repsMax: number | null;
  holdSeconds: number | null;
  restSeconds: number | null;
  note: string;
  linkNext: boolean;
}

let nextKey = 0;
const blankSlot = (): SlotForm => ({
  key: nextKey++,
  exercise: "",
  measure: "reps",
  perSide: false,
  sets: 3,
  repsMin: 8,
  repsMax: null,
  holdSeconds: null,
  restSeconds: null,
  note: "",
  linkNext: false,
});

const name = ref(props.initial?.name ?? "");
const kind = ref<"gym" | "physio">(props.initial?.kind ?? "gym");
const links = supersetGroupsToLinks(props.initial?.slots.map((s) => s.supersetGroup) ?? []);
const slots = ref<SlotForm[]>(
  props.initial
    ? props.initial.slots.map((s, i) => ({
        key: nextKey++,
        exercise: s.exercise,
        measure: s.measure,
        perSide: s.perSide,
        sets: s.sets,
        repsMin: s.repsMin,
        // A fixed rep count is stored as min = max; show it as just the one number.
        repsMax: s.repsMax != null && s.repsMax !== s.repsMin ? s.repsMax : null,
        holdSeconds: s.holdSeconds,
        restSeconds: s.restSeconds,
        note: s.note ?? "",
        linkNext: links[i] ?? false,
      }))
    : [blankSlot()],
);

const saving = ref(false);
const errorMessage = ref<string | null>(null);

const match = (slot: SlotForm) => library.value.find((e) => exerciseKey(e.name) === exerciseKey(slot.exercise));
const isNew = (slot: SlotForm) => slot.exercise.trim() !== "" && !match(slot);
const measureOf = (slot: SlotForm): "reps" | "hold" => match(slot)?.measure ?? slot.measure;

function addSlot() {
  slots.value.push(blankSlot());
}

function move(i: number, by: number) {
  const j = i + by;
  if (j < 0 || j >= slots.value.length) return;
  const next = [...slots.value];
  [next[i], next[j]] = [next[j]!, next[i]!];
  slots.value = next;
}

async function save() {
  saving.value = true;
  errorMessage.value = null;
  const groups = linksToSupersetGroups(slots.value.map((s) => s.linkNext));
  const body = {
    name: name.value,
    kind: kind.value,
    slots: slots.value.map((s, i) => {
      const hold = measureOf(s) === "hold";
      return {
        exercise: s.exercise,
        measure: s.measure,
        perSide: s.perSide,
        sets: s.sets,
        repsMin: hold ? null : s.repsMin,
        repsMax: hold ? null : (s.repsMax ?? s.repsMin),
        holdSeconds: hold ? s.holdSeconds : null,
        restSeconds: s.restSeconds || null,
        supersetGroup: groups[i] ?? null,
        note: s.note.trim() || null,
      };
    }),
  };

  try {
    const result = props.initial
      ? await $fetch<{ id: string }>(`/api/strength/templates/${props.initial.id}`, { method: "PUT", body })
      : await $fetch<{ id: string }>("/api/strength/templates", { method: "POST", body });
    emit("saved", result.id);
  } catch (e) {
    errorMessage.value = (e as { data?: { statusMessage?: string } })?.data?.statusMessage || "Couldn't save the template.";
  } finally {
    saving.value = false;
  }
}
</script>
