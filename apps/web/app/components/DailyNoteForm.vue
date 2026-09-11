<template>
  <form class="space-y-4" @submit.prevent="submit">
    <div>
      <label class="block text-sm text-gray-400 mb-1">RPE (optional)</label>
      <div class="flex gap-1">
        <button
          v-for="n in 10"
          :key="n"
          type="button"
          :class="[
            'flex-1 py-2 rounded text-sm font-medium border',
            rpe === n ? 'bg-emerald-600 border-emerald-500 text-white' : 'bg-gray-900 border-gray-800 text-gray-400',
          ]"
          @click="rpe = rpe === n ? null : n"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <div>
      <label class="block text-sm text-gray-400 mb-1">Note (optional)</label>
      <textarea
        v-model="note"
        rows="4"
        placeholder="How did it feel? Anything worth remembering — entirely up to you."
        class="w-full rounded-lg bg-gray-900 border border-gray-800 p-3 text-sm text-gray-100 placeholder:text-gray-600"
      />
    </div>

    <button
      type="submit"
      :disabled="saving"
      class="w-full rounded-lg bg-emerald-600 py-3 text-sm font-semibold text-white disabled:opacity-50"
    >
      {{ saving ? "Saving…" : saved ? "Saved" : "Save" }}
    </button>
  </form>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ date: string }>();

const note = ref<string>("");
const rpe = ref<number | null>(null);
const saving = ref(false);
const saved = ref(false);

async function load() {
  saved.value = false;
  const data = await $fetch<{ note: string | null; rpe: number | null }>("/api/notes", { query: { date: props.date } });
  note.value = data.note ?? "";
  rpe.value = data.rpe ?? null;
}

async function submit() {
  saving.value = true;
  saved.value = false;
  try {
    await $fetch("/api/notes", {
      method: "POST",
      body: { date: props.date, note: note.value || null, rpe: rpe.value },
    });
    saved.value = true;
  } finally {
    saving.value = false;
  }
}

watch(() => props.date, load, { immediate: true });
</script>
