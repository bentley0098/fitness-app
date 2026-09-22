<template>
  <form class="space-y-5" @submit.prevent="submit">
    <div>
      <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">RPE (optional)</label>
      <div class="flex gap-1">
        <button
          v-for="n in 10"
          :key="n"
          type="button"
          class="flex-1 rounded-lg border py-2 text-sm font-semibold transition-colors"
          :class="
            rpe === n
              ? 'border-accent-600 bg-accent-600 text-white'
              : 'border-line bg-surface text-muted hover:border-line-strong'
          "
          @click="rpe = rpe === n ? null : n"
        >
          {{ n }}
        </button>
      </div>
    </div>

    <div>
      <label class="mb-1.5 block text-xs font-medium uppercase tracking-wide text-subtle">Note (optional)</label>
      <textarea
        v-model="note"
        rows="5"
        placeholder="How did it feel? Anything worth remembering — entirely up to you."
        class="w-full rounded-card border border-line bg-surface p-3 text-sm text-ink placeholder:text-subtle focus:border-accent-500 focus:outline-none focus:ring-2 focus:ring-accent-500/20"
      />
    </div>

    <button
      type="submit"
      :disabled="saving"
      class="w-full rounded-card bg-accent-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-accent-700 disabled:opacity-50"
    >
      {{ saving ? "Saving…" : saved ? "Saved" : "Save" }}
    </button>

    <p v-if="error" class="text-sm text-verdict-stop">{{ error }}</p>
  </form>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const props = defineProps<{ date: string }>();

const note = ref<string>("");
const rpe = ref<number | null>(null);
const saving = ref(false);
const saved = ref(false);
const error = ref<string | null>(null);

async function load() {
  saved.value = false;
  error.value = null;
  try {
    const data = await $fetch<{ note: string | null; rpe: number | null }>("/api/notes", { query: { date: props.date } });
    note.value = data.note ?? "";
    rpe.value = data.rpe ?? null;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't load this note.";
  }
}

async function submit() {
  saving.value = true;
  saved.value = false;
  error.value = null;
  try {
    await $fetch("/api/notes", {
      method: "POST",
      body: { date: props.date, note: note.value || null, rpe: rpe.value },
    });
    saved.value = true;
  } catch (e) {
    error.value = e instanceof Error ? e.message : "Couldn't save this note.";
  } finally {
    saving.value = false;
  }
}

watch(() => props.date, load, { immediate: true });
</script>
