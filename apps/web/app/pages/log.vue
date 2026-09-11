<template>
  <div class="p-4 space-y-4">
    <header>
      <div class="text-xs text-gray-500">{{ today }}</div>
      <h1 class="text-lg font-semibold">Log</h1>
      <p class="text-sm text-gray-500 mt-1">Entirely optional — nothing here changes the plan. It's for your own scrollback.</p>
    </header>

    <DailyNoteForm :date="todayIso" />
  </div>
</template>

<script setup lang="ts">
const todayIso = new Date().toISOString().slice(0, 10);
const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
</script>
