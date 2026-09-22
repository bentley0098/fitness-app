<template>
  <div class="space-y-4 p-4">
    <header>
      <h1 class="text-xl font-bold text-ink">More</h1>
    </header>

    <nav class="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface shadow-card">
      <NuxtLink
        v-for="link in links"
        :key="link.to"
        :to="link.to"
        class="flex items-center gap-3 p-3.5 transition-colors hover:bg-raised"
      >
        <span class="flex h-9 w-9 shrink-0 items-center justify-center rounded-pill bg-raised text-muted">
          <AppIcon :name="link.icon" :size="17" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block text-sm font-semibold text-ink">{{ link.label }}</span>
          <span class="block text-xs text-subtle">{{ link.sub }}</span>
        </span>
        <AppIcon name="chevron-right" :size="16" class="shrink-0 text-subtle" />
      </NuxtLink>
    </nav>

    <section class="space-y-2">
      <SectionHeader title="Data" sub="Row counts straight from Supabase" />
      <AsyncState :pending="pending" :error="error" title="Couldn't reach the database" :skeletons="1">
        <div v-if="health" class="overflow-hidden rounded-card border border-line bg-surface shadow-card">
          <div
            v-for="(count, table) in health"
            :key="table"
            class="flex items-center justify-between border-b border-line px-3.5 py-2 text-xs last:border-b-0"
          >
            <span class="font-mono text-muted">{{ table }}</span>
            <span class="tnum font-semibold text-ink">{{ count }}</span>
          </div>
        </div>
      </AsyncState>
    </section>
  </div>
</template>

<script setup lang="ts">
const links = [
  { to: "/more/trends", label: "Trends", sub: "Volume, workload ratio and verdict history", icon: "trend" },
  { to: "/more/log", label: "Log a note", sub: "Optional RPE and free text for today", icon: "note" },
];

const { data: health, pending, error } = await useFetch<Record<string, number | string>>("/api/health");
</script>
