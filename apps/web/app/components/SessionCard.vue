<template>
  <div
    class="rounded-card border bg-surface p-3.5 shadow-card transition-all"
    :class="[
      isToday ? 'border-accent-500 ring-1 ring-accent-500/20' : 'border-line',
      // A filled accent panel, not another ring — today's card already wears
      // an accent ring and the two must not read the same mid-drag.
      isDropTarget ? 'border-accent-500 bg-accent-100 ring-2 ring-accent-500' : '',
    ]"
  >
    <div class="flex items-center gap-2">
      <span class="text-xs font-semibold uppercase tracking-wide text-subtle">
        {{ weekdayShort(date) }} {{ dayOfMonth(date) }}
      </span>
      <StatPill v-if="isToday" tone="accent" label="Today" />
    </div>

    <p v-if="!sessions.length && !unplannedStrength.length" class="mt-1 text-sm font-medium text-subtle">Rest day</p>

    <div v-else class="mt-1.5 divide-y divide-line">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="py-2.5 first:pt-0 last:pb-0"
        @pointerdown="draggable && $emit('grab', $event, session.id)"
      >
        <SessionRow :session="session" :draggable="draggable" :is-source-gap="draggingId === session.id" />
      </div>
    </div>

    <NuxtLink
      v-for="log in unplannedStrength"
      :key="log.id"
      :to="`/strength/log/${log.id}`"
      class="mt-2 flex items-center gap-1.5 text-xs text-muted"
    >
      <AppIcon name="dumbbell" :size="13" />
      <span>{{ log.templateName }} · unplanned</span>
    </NuxtLink>

    <!-- An unplanned run still deserves credit. -->
    <div
      v-if="unplanned && unplanned.actualDistanceM > 0"
      class="mt-2 flex items-center gap-1.5 text-xs text-muted"
    >
      <AppIcon name="run" :size="13" />
      <span class="tnum">{{ formatDistance(unplanned.actualDistanceM) }} km unplanned</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SessionRowData } from "./SessionRow.vue";

withDefaults(
  defineProps<{
    date: string;
    isToday: boolean;
    sessions: SessionRowData[];
    /** Runs no planned session claimed; null when the day has none to show. */
    unplanned?: { actualDistanceM: number } | null;
    /** Strength sessions done that day without starting from a planned one. */
    unplannedStrength?: { id: string; templateName: string }[];
    /** Whether each session's row can be picked up — the gesture itself lives in the parent. */
    draggable?: boolean;
    /** The session currently in hand, so its row shows the hole it left. */
    draggingId?: string | null;
    isDropTarget?: boolean;
  }>(),
  { unplanned: null, unplannedStrength: () => [], draggable: false, draggingId: null, isDropTarget: false },
);

defineEmits<{ grab: [event: PointerEvent, sessionId: string] }>();
</script>
