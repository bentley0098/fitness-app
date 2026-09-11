<template>
  <div class="p-4 space-y-4">
    <header>
      <h1 class="text-lg font-semibold">Plan</h1>
    </header>

    <div v-if="pending" class="text-sm text-gray-500">Loading…</div>

    <div v-else-if="!sessions?.length" class="rounded-lg border border-gray-800 bg-gray-900 p-4 text-sm text-gray-400">
      No sessions planned yet. This screen activates once the weekly draft (the MCP layer + Sunday cron) is wired up — for now, the
      <NuxtLink to="/" class="text-emerald-400">Today</NuxtLink> screen's verdict is the live signal.
    </div>

    <ul v-else class="space-y-2">
      <li v-for="session in sessions" :key="session.id" class="rounded-lg border border-gray-800 bg-gray-900 p-3">
        <div class="flex justify-between items-baseline">
          <span class="font-medium">{{ session.date }}</span>
          <span class="text-xs text-gray-500">{{ session.status }}</span>
        </div>
        <div class="text-sm text-gray-400 mt-1">{{ session.phase }} — {{ session.type }}</div>
        <div v-if="session.changed_because" class="text-xs text-amber-400 mt-2">{{ session.changed_because }}</div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const { data: sessions, pending } = await useFetch("/api/plan-sessions");
</script>
