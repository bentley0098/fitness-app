<template>
  <div class="p-4 space-y-4">
    <header>
      <div class="text-xs text-gray-500">{{ today }}</div>
      <h1 class="text-lg font-semibold">Today</h1>
    </header>

    <div v-if="pending" class="text-sm text-gray-500">Loading…</div>
    <div v-else-if="error" class="text-sm text-red-400">Couldn't load today's status: {{ error.message }}</div>

    <template v-else-if="data">
      <AdaptationBanner :verdict="data.verdict" :reason="data.reason" :signals="data.signals" />

      <div class="grid grid-cols-2 gap-2">
        <MetricTile label="This week" :value="(data.weeklyVolumeM / 1000).toFixed(1)" unit="km" />
        <MetricTile label="Workload ratio" :value="data.signals.workloadRatio?.toFixed(2) ?? null" />
        <MetricTile label="HRV status" :value="data.todayMetrics?.hrvStatus ?? null" />
        <MetricTile label="Resting HR" :value="data.todayMetrics?.restingHr ?? null" unit="bpm" />
      </div>

      <div v-if="data.signals.lowBodyBatteryToday" class="rounded-lg bg-blue-950/40 border border-blue-800 p-3 text-sm text-blue-200">
        Body battery is low today — same-day caution, doesn't change the plan itself. Consider an easier session if you have flexibility.
      </div>

      <NuxtLink
        to="/log"
        class="block rounded-lg border border-gray-800 bg-gray-900 p-3 text-sm text-gray-400 text-center hover:text-gray-200"
      >
        Log a note for today (optional) →
      </NuxtLink>
    </template>
  </div>
</template>

<script setup lang="ts">
const today = new Date().toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });

const { data, pending, error } = await useFetch("/api/today");
</script>
