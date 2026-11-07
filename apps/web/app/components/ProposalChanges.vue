<template>
  <ul class="space-y-2">
    <li v-for="(r, i) in rows" :key="i" class="overflow-hidden rounded-lg border border-line bg-surface text-sm">
      <div class="flex items-center justify-between gap-2 border-b border-line bg-raised px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-subtle">
        <span v-if="r.date" class="flex flex-wrap items-center gap-1">
          <span :class="{ 'line-through': r.toDate }">{{ formatDate(r.date, SHORT) }}</span>
          <template v-if="r.toDate">
            <span aria-hidden="true">→</span>
            <span class="rounded bg-accent-100 px-1.5 text-accent-700">{{ formatDate(r.toDate, SHORT) }}</span>
          </template>
        </span>
        <span v-else>{{ LIBRARY_LABELS[r.kind] ?? "Change" }}</span>
        <StatPill :tone="tag(r).tone" :label="tag(r).label" />
      </div>

      <div v-if="r.before && r.before !== r.after" class="flex gap-2 bg-verdict-stop-soft/60 px-3 py-2 text-muted">
        <span class="font-mono text-verdict-stop" aria-label="Before">−</span>
        <span class="line-through decoration-verdict-stop/60">{{ r.before }}</span>
      </div>
      <div v-if="r.after" class="flex gap-2 px-3 py-2 font-semibold text-ink" :class="r.after !== r.before ? 'bg-accent-50' : ''">
        <span class="font-mono text-accent-700" aria-label="After">{{ r.before && r.after === r.before ? "=" : "+" }}</span>
        <span>{{ r.after }}</span>
      </div>
    </li>
  </ul>
</template>

<script setup lang="ts">
interface Row {
  kind: string;
  date: string | null;
  toDate: string | null;
  before: string | null;
  after: string | null;
}
defineProps<{ rows: Row[] }>();

const SHORT: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" };

const LIBRARY_LABELS: Record<string, string> = {
  addExercise: "New exercise",
  createTemplate: "New template",
  updateTemplate: "Template change",
};

function tag(r: Row): { label: string; tone: "accent" | "warn" | "danger" | "neutral" } {
  if (!r.after) return { label: "Remove", tone: "danger" };
  if (!r.before) return { label: "New", tone: "accent" };
  if (r.toDate) return { label: "Move", tone: "warn" };
  return { label: "Change", tone: "warn" };
}
</script>
