<template>
  <div class="space-y-4 p-4">
    <header>
      <NuxtLink to="/plan" class="mb-2 inline-flex items-center gap-1 text-xs font-medium text-accent-700">
        <AppIcon name="chevron-left" :size="14" /> Plan
      </NuxtLink>
      <h1 class="text-xl font-bold text-ink">Plan changes</h1>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load proposals" :skeletons="3">
      <template v-if="data">
        <p v-if="!data.pending.length && !data.recent.length" class="text-sm text-muted">No proposals yet.</p>

        <section v-if="data.pending.length" class="space-y-2">
          <SectionHeader title="Waiting for you" />
          <NuxtLink
            v-for="p in data.pending"
            :key="p.id"
            :to="`/proposal/${p.id}`"
            class="block rounded-card border border-line bg-surface p-3.5 text-sm text-ink shadow-card"
          >
            {{ p.rationale }}
          </NuxtLink>
        </section>

        <section v-if="data.recent.length" class="space-y-2">
          <SectionHeader title="Earlier" />
          <NuxtLink
            v-for="p in data.recent"
            :key="p.id"
            :to="`/proposal/${p.id}`"
            class="block rounded-card border border-line bg-surface p-3.5 shadow-card"
          >
            <p class="text-sm text-ink">{{ p.rationale }}</p>
            <p class="mt-1 text-xs capitalize text-subtle">{{ p.status }}</p>
          </NuxtLink>
        </section>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
const { data, pending, error } = await useFetch("/api/plan-proposals");
</script>
