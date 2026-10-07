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
            Superset · alternate the exercises, rest after each round
          </p>

          <!-- One card per exercise, each listing its own sets... -->
          <template v-if="!group.superset">
            <section
              v-for="exercise in group.exercises"
              :key="exercise.logExerciseId"
              class="rounded-card border border-line bg-surface p-3.5 shadow-card"
            >
              <ExerciseHeader :exercise="exercise" />
              <ExercisePicker
                v-if="swapping === exercise.logExerciseId"
                class="mt-3"
                :library="library"
                label="Swap for"
                submit-label="Swap"
                @pick="(choice) => swap(exercise, choice)"
                @cancel="swapping = null"
              />
              <ul class="mt-3 space-y-2">
                <SetRow
                  v-for="item in group.sequence"
                  :key="item.setIndex"
                  :row="exercise.rows[item.setIndex]!"
                  :exercise="exercise"
                  @toggle="onToggle(exercise, exercise.rows[item.setIndex]!, item.restAfter ? item.restSeconds : null)"
                  @edit="onEdit(exercise, exercise.rows[item.setIndex]!)"
                />
              </ul>
              <ExerciseActions
                v-if="data.status === 'in_progress'"
                :rows="exercise.rows.length"
                @add-set="structure(exercise, 'add-set')"
                @remove-set="structure(exercise, 'remove-set')"
                @swap="swapping = swapping === exercise.logExerciseId ? null : exercise.logExerciseId"
              />
            </section>
          </template>

          <!-- ...but a superset is one card whose sets alternate. -->
          <section v-else class="rounded-card border border-line bg-surface p-3.5 shadow-card">
            <div v-for="exercise in group.exercises" :key="exercise.logExerciseId" class="mb-3 border-b border-line pb-3 last:mb-0 last:border-0 last:pb-0">
              <ExerciseHeader :exercise="exercise" />
              <ExercisePicker
                v-if="swapping === exercise.logExerciseId"
                class="mt-3"
                :library="library"
                label="Swap for"
                submit-label="Swap"
                @pick="(choice) => swap(exercise, choice)"
                @cancel="swapping = null"
              />
              <ExerciseActions
                v-if="data.status === 'in_progress'"
                :rows="exercise.rows.length"
                @add-set="structure(exercise, 'add-set')"
                @remove-set="structure(exercise, 'remove-set')"
                @swap="swapping = swapping === exercise.logExerciseId ? null : exercise.logExerciseId"
              />
            </div>
            <ul class="mt-3 space-y-2 border-t border-line pt-3">
              <SetRow
                v-for="item in group.sequence"
                :key="`${item.exercise}-${item.setIndex}`"
                :row="group.exercises[item.exercise]!.rows[item.setIndex]!"
                :exercise="group.exercises[item.exercise]!"
                :label="group.exercises[item.exercise]!.name"
                @toggle="onToggle(group.exercises[item.exercise]!, group.exercises[item.exercise]!.rows[item.setIndex]!, item.restAfter ? item.restSeconds : null)"
                @edit="onEdit(group.exercises[item.exercise]!, group.exercises[item.exercise]!.rows[item.setIndex]!)"
              />
            </ul>
          </section>
        </div>

        <div v-if="data.status === 'in_progress'">
          <ExercisePicker
            v-if="adding"
            :library="library"
            label="Add exercise"
            submit-label="Add"
            @pick="addExercise"
            @cancel="adding = false"
          />
          <button v-else type="button" class="text-xs font-medium text-accent-700" @click="adding = true">+ Add exercise</button>
        </div>

        <p v-if="saveError" class="text-xs text-verdict-regress" role="alert">{{ saveError }}</p>

        <div
          v-if="data.status === 'in_progress'"
          class="fixed inset-x-0 bottom-0 z-30 space-y-2 border-t border-line bg-surface/95 p-3 backdrop-blur"
          :style="{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 4.25rem)' }"
        >
          <div v-if="rest.active.value" class="mx-auto flex max-w-lg items-center justify-between gap-3 rounded-card bg-accent-100 px-4 py-2.5" role="timer">
            <span class="text-sm font-semibold text-accent-700">Rest <span class="tnum">{{ restLabel }}</span></span>
            <span class="flex gap-3 text-xs font-medium text-accent-700">
              <button type="button" @click="rest.extend(30)">+30 s</button>
              <button type="button" @click="rest.skip()">Skip</button>
            </span>
          </div>
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
import { computed, ref } from "vue";

const route = useRoute();
const id = String(route.params.id);

const { data, pending, error, refresh } = await useFetch(`/api/strength/logs/${id}`);
const { data: libraryData, refresh: refreshLibrary } = await useFetch("/api/strength/exercises", { default: () => ({ exercises: [] }) });
const library = computed(() => libraryData.value.exercises);

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
async function onToggle(exercise: Exercise, row: Row, restSeconds: number | null = null) {
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
      if (restSeconds) rest.start(restSeconds);
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

const rest = useRestTimer();
const restLabel = computed(() => {
  const total = rest.remaining.value;
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
});

const swapping = ref<string | null>(null);
const adding = ref(false);

type Choice = { name: string; measure: "reps" | "hold"; perSide: boolean };

// Structure changes (sets, swaps, extra exercises) reload the session: the
// server owns what rows exist, and the rows it hands back are pre-filled.
async function change(request: () => Promise<unknown>, fallback: string) {
  saveError.value = null;
  try {
    await request();
    await Promise.all([refresh(), refreshLibrary()]);
  } catch (e) {
    saveError.value = describe(e, fallback);
  }
}

function structure(exercise: Exercise, action: "add-set" | "remove-set") {
  return change(
    () => $fetch(`/api/strength/logs/${id}/exercises/${exercise.logExerciseId}/${action}`, { method: "POST" }),
    "Couldn't change the sets.",
  );
}

async function swap(exercise: Exercise, choice: Choice) {
  await change(
    () => $fetch(`/api/strength/logs/${id}/exercises/${exercise.logExerciseId}/swap`, { method: "POST", body: choice }),
    "Couldn't swap that exercise.",
  );
  if (!saveError.value) swapping.value = null;
}

async function addExercise(choice: Choice) {
  await change(() => $fetch(`/api/strength/logs/${id}/exercises`, { method: "POST", body: choice }), "Couldn't add that exercise.");
  if (!saveError.value) adding.value = false;
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
