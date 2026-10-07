<template>
  <!-- A day: a light header with a rule under it, then one card per session.
       The whole block is the drop target while a session is being moved. -->
  <div
    class="-mx-2 rounded-card px-2 py-1 transition-colors"
    :class="isDropTarget ? 'bg-accent-100 ring-2 ring-accent-500' : ''"
  >
    <div class="flex items-center gap-2 border-b pb-1.5" :class="isToday ? 'border-accent-500' : 'border-line'">
      <span class="text-xs font-semibold uppercase tracking-wide" :class="isToday ? 'text-accent-700' : 'text-subtle'">
        {{ weekdayShort(date) }} {{ dayOfMonth(date) }}
      </span>
      <StatPill v-if="isToday" tone="accent" label="Today" />
    </div>

    <p v-if="!sessions.length && !unplannedStrength.length" class="py-2.5 text-sm text-subtle">Rest day</p>

    <div v-else class="mt-2 space-y-2">
      <div
        v-for="session in sessions"
        :key="session.id"
        class="flex cursor-pointer overflow-hidden rounded-card border border-line bg-surface shadow-card transition-opacity"
        :class="draggingId === session.id ? 'opacity-30' : ''"
        @click="$emit('open', $event, session)"
        @pointerdown="draggable && $emit('grab', $event, session.id)"
      >
        <span class="w-1.5 shrink-0" :class="KIND_BAR[sessionKind(session.type)]" />
        <div class="min-w-0 flex-1 p-3.5">
          <SessionRow :session="session" :draggable="draggable" />
        </div>
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
import { KIND_BAR, sessionKind } from "~/composables/sessionKind";
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

defineEmits<{ grab: [event: PointerEvent, sessionId: string]; open: [event: MouseEvent, session: SessionRowData] }>();
</script>
