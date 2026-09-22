<template>
  <div class="space-y-5 p-4">
    <header>
      <NuxtLink to="/more" class="mb-2 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        <AppIcon name="chevron-left" :size="14" /> More
      </NuxtLink>
      <div class="text-xs text-subtle">{{ today }}</div>
      <h1 class="text-xl font-bold text-ink">Log</h1>
      <p class="mt-1 text-sm text-muted">
        Entirely optional — nothing here changes the plan. It's for your own scrollback.
      </p>
    </header>

    <DailyNoteForm :date="todayIso" />
  </div>
</template>

<script setup lang="ts">
const todayIso = new Date().toISOString().slice(0, 10);
const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
</script>
