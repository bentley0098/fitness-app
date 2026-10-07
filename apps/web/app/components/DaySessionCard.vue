<template>
  <div
    class="flex cursor-pointer overflow-hidden rounded-card border border-line bg-surface shadow-card transition-colors hover:bg-raised"
    @click="open"
  >
    <span class="w-1.5 shrink-0" :class="KIND_BAR[sessionKind(session.type)]" />
    <div class="min-w-0 flex-1 p-3.5">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0">
          <p class="truncate text-base font-semibold text-ink">{{ title }}</p>
          <p v-if="session.phase" class="text-xs text-subtle">{{ humanizePhase(session.phase) }}</p>
        </div>
        <span
          v-if="session.completion.state === 'completed'"
          class="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-pill bg-verdict-progress text-white"
          title="Completed"
        >
          <AppIcon name="check" :size="13" :stroke-width="2.5" />
        </span>
      </div>

      <!-- A strength session is done in the logger; a run is measured. -->
      <div v-if="session.isStrength" class="mt-3 flex items-center gap-3">
        <NuxtLink
          v-if="session.completion.logId"
          :to="`/strength/log/${session.completion.logId}`"
          class="rounded-lg bg-raised px-3 py-1.5 text-xs font-semibold text-accent-700"
        >
          {{ session.completion.state === "completed" ? "View session" : "Resume" }}
        </NuxtLink>
        <button
          v-else-if="session.templateId"
          type="button"
          class="rounded-lg bg-accent-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-60"
          :disabled="starting"
          @click="start"
        >
          {{ starting ? "Starting…" : "Start" }}
        </button>
        <span v-if="startError" class="text-xs text-verdict-regress" role="alert">{{ startError }}</span>
      </div>

      <div v-else-if="done" class="mt-3 grid grid-cols-3 gap-2">
        <div>
          <div class="text-[10px] uppercase tracking-wide text-subtle">Distance</div>
          <div class="tnum text-sm font-semibold text-ink">{{ formatDistance(session.completion.actualDistanceM) }} km</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-subtle">Time</div>
          <div class="tnum text-sm font-semibold text-ink">{{ formatDuration(session.completion.actualMovingTimeS) }}</div>
        </div>
        <div>
          <div class="text-[10px] uppercase tracking-wide text-subtle">Avg pace</div>
          <div class="tnum text-sm font-semibold text-ink">{{ paceLabel }}</div>
        </div>
      </div>

      <div v-else class="mt-2 flex items-baseline gap-1.5">
        <template v-if="session.targetDistanceM != null">
          <span class="tnum text-2xl font-bold text-ink">{{ formatDistance(session.targetDistanceM) }}</span>
          <span class="text-sm text-subtle">km</span>
        </template>
        <template v-else-if="session.targetDurationS != null">
          <span class="tnum text-2xl font-bold text-ink">{{ Math.round(session.targetDurationS / 60) }}</span>
          <span class="text-sm text-subtle">min</span>
        </template>
        <span v-else class="text-sm font-medium text-muted">{{ session.label }}</span>
      </div>

      <p v-if="session.changedBecause" class="mt-2 text-xs text-verdict-hold">{{ session.changedBecause }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { KIND_BAR, sessionKind } from "~/composables/sessionKind";
import type { SessionRowData } from "./SessionRow.vue";

const props = defineProps<{ session: SessionRowData & { typeLabel?: string } }>();

// A gym or physio session is named for its template; a run for its type.
const title = computed(() => (props.session.isStrength ? props.session.label : (props.session.typeLabel ?? props.session.label)));

const done = computed(() => props.session.completion.state === "completed" || props.session.completion.actualDistanceM > 0);

const paceLabel = computed(() => {
  const p = paceFrom(props.session.completion.actualDistanceM, props.session.completion.actualMovingTimeS);
  return p ? `${formatPace(p)} /km` : DASH;
});

const { starting, startError, start } = useStartSession(() => props.session);

function open(event: MouseEvent) {
  if ((event.target as HTMLElement | null)?.closest("button, a")) return;
  void navigateTo(sessionHref(props.session));
}
</script>
