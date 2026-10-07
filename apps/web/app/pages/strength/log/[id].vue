<template>
  <div class="space-y-4 p-4 pb-28">
    <header>
      <NuxtLink to="/strength" class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        ← Strength
      </NuxtLink>
      <h1 class="text-xl font-bold text-ink">{{ data?.templateName ?? "Session" }}</h1>
      <p v-if="data" class="mt-0.5 text-sm text-subtle">
        {{ formatDate(data.date, { weekday: "long", day: "numeric", month: "short" }) }}
        <template v-if="data.status === 'finished'"> · Finished</template>
      </p>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load this session" :skeletons="4">
      <template v-if="data">
        <div
          v-for="(group, gi) in data.groups"
          :key="gi"
          class="space-y-2 rounded-card"
          :class="group.superset ? 'border border-accent-500 p-2' : ''"
        >
          <p v-if="group.superset" class="px-1 text-[11px] font-semibold uppercase tracking-wide text-accent-700">
            Superset
          </p>

          <section
            v-for="exercise in group.exercises"
            :key="exercise.logExerciseId"
            class="rounded-card border border-line bg-surface p-3.5 shadow-card"
          >
            <div class="flex items-baseline justify-between gap-3">
              <h2 class="min-w-0 text-sm font-semibold text-ink">{{ exercise.name }}</h2>
              <span class="tnum shrink-0 text-xs text-subtle">{{ exercise.target }}</span>
            </div>
            <p v-if="exercise.note" class="mt-1 text-xs text-muted">{{ exercise.note }}</p>

            <ul class="mt-3 space-y-2">
              <li
                v-for="row in exercise.rows"
                :key="row.setIndex"
                class="grid grid-cols-[1.5rem_1fr_auto] items-center gap-2"
              >
                <span class="tnum text-xs font-semibold text-subtle">{{ row.setIndex + 1 }}</span>

                <div class="flex min-w-0 items-center gap-2">
                  <label v-if="exercise.measure === 'reps'" class="flex items-center gap-1">
                    <input
                      v-model.number="row.reps"
                      type="number"
                      inputmode="numeric"
                      min="0"
                      class="tnum w-16 rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm text-ink"
                      :aria-label="`Set ${row.setIndex + 1} reps`"
                      @change="onEdit(exercise, row)"
                    />
                    <span class="text-xs text-subtle">reps</span>
                  </label>
                  <label v-if="exercise.measure === 'reps'" class="flex items-center gap-1">
                    <input
                      v-model.number="row.weightKg"
                      type="number"
                      inputmode="decimal"
                      step="0.5"
                      min="0"
                      placeholder="BW"
                      class="tnum w-20 rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm text-ink"
                      :aria-label="`Set ${row.setIndex + 1} weight in kilograms`"
                      @change="onEdit(exercise, row)"
                    />
                    <span class="text-xs text-subtle">kg</span>
                  </label>
                  <label v-else class="flex items-center gap-1">
                    <input
                      v-model.number="row.holdSeconds"
                      type="number"
                      inputmode="numeric"
                      min="0"
                      class="tnum w-20 rounded-lg border border-line bg-canvas px-2 py-1.5 text-center text-sm text-ink"
                      :aria-label="`Set ${row.setIndex + 1} hold in seconds`"
                      @change="onEdit(exercise, row)"
                    />
                    <span class="text-xs text-subtle">s</span>
                  </label>
                  <span v-if="previousLabel(exercise, row)" class="tnum truncate text-[11px] text-subtle">
                    last {{ previousLabel(exercise, row) }}
                  </span>
                </div>

                <button
                  type="button"
                  class="inline-flex h-9 w-9 items-center justify-center rounded-pill border transition-colors"
                  :class="row.logged ? 'border-verdict-progress bg-verdict-progress text-white' : 'border-line-strong text-subtle'"
                  :aria-label="row.logged ? `Un-log set ${row.setIndex + 1}` : `Log set ${row.setIndex + 1}`"
                  :aria-pressed="row.logged"
                  @click="onToggle(exercise, row)"
                >
                  <AppIcon name="check" :size="16" :stroke-width="2.5" />
                </button>
              </li>
            </ul>
          </section>
        </div>

        <p v-if="saveError" class="text-xs text-verdict-regress" role="alert">{{ saveError }}</p>

        <div
          v-if="data.status === 'in_progress'"
          class="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 p-3 backdrop-blur"
          :style="{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.25rem)' }"
        >
          <button
            type="button"
            class="mx-auto block w-full max-w-lg rounded-card bg-accent-600 px-4 py-3 text-sm font-semibold text-white disabled:opacity-60"
            :disabled="finishing"
            @click="finish"
          >
            {{ finishing ? "Finishing…" : "Finish session" }}
          </button>
        </div>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

const route = useRoute();
const id = String(route.params.id);

const { data, pending, error } = await useFetch(`/api/strength/logs/${id}`);

type Exercise = NonNullable<typeof data.value>["groups"][number]["exercises"][number];
type Row = Exercise["rows"][number];

const saveError = ref<string | null>(null);
const finishing = ref(false);

function describe(e: unknown, fallback: string): string {
  return (e as { data?: { statusMessage?: string } })?.data?.statusMessage || fallback;
}

function payload(exercise: Exercise, row: Row) {
  return {
    logExerciseId: exercise.logExerciseId,
    setIndex: row.setIndex,
    reps: exercise.measure === "reps" ? row.reps : null,
    holdSeconds: exercise.measure === "hold" ? row.holdSeconds : null,
    weightKg: exercise.measure === "reps" ? row.weightKg : null,
  };
}

// Logged straight away, one set at a time: leaving the app mid-workout loses nothing.
async function onToggle(exercise: Exercise, row: Row) {
  saveError.value = null;
  const wasLogged = row.logged;
  row.logged = !wasLogged;
  try {
    if (wasLogged) {
      await $fetch(`/api/strength/logs/${id}/sets`, {
        method: "DELETE",
        body: { logExerciseId: exercise.logExerciseId, setIndex: row.setIndex },
      });
    } else {
      await $fetch(`/api/strength/logs/${id}/sets`, { method: "PUT", body: payload(exercise, row) });
    }
  } catch (e) {
    row.logged = wasLogged;
    saveError.value = describe(e, "Couldn't save that set.");
  }
}

// Changing a set that is already logged saves the change; an unlogged one is
// just a draft until it is logged.
async function onEdit(exercise: Exercise, row: Row) {
  if (!row.logged) return;
  saveError.value = null;
  try {
    await $fetch(`/api/strength/logs/${id}/sets`, { method: "PUT", body: payload(exercise, row) });
  } catch (e) {
    saveError.value = describe(e, "Couldn't save that change.");
  }
}

function previousLabel(exercise: Exercise, row: Row): string | null {
  const p = row.previous;
  if (!p) return null;
  if (exercise.measure === "hold") return p.holdSeconds != null ? `${p.holdSeconds} s` : null;
  if (p.reps == null) return null;
  return p.weightKg != null ? `${p.reps} × ${p.weightKg} kg` : `${p.reps} reps`;
}

async function finish() {
  finishing.value = true;
  saveError.value = null;
  try {
    await $fetch(`/api/strength/logs/${id}/finish`, { method: "POST" });
    await navigateTo("/strength");
  } catch (e) {
    saveError.value = describe(e, "Couldn't finish the session.");
  } finally {
    finishing.value = false;
  }
}
</script>
