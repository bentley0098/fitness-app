<template>
  <div class="space-y-4 p-4">
    <header>
      <h1 class="text-xl font-bold text-ink">Strength</h1>
      <p class="mt-0.5 text-sm text-subtle">
        Gym and physio routines ·
        <NuxtLink to="/strength/history" class="font-medium text-accent-700">History</NuxtLink>
      </p>
    </header>

    <NuxtLink
      v-if="active?.log"
      :to="`/strength/log/${active.log.id}`"
      class="flex items-center justify-between gap-3 rounded-card border border-accent-500 bg-accent-100 p-3.5"
    >
      <span class="text-sm font-semibold text-accent-700">Resume {{ active.log.templateName }}</span>
      <span class="text-xs text-accent-700">In progress →</span>
    </NuxtLink>

    <AsyncState :pending="pending" :error="error" title="Couldn't load your templates" :skeletons="3">
      <template v-if="data">
        <section v-for="section in sections" :key="section.kind" class="space-y-2">
          <SectionHeader :title="section.title" />

          <NuxtLink
            v-for="t in section.templates"
            :key="t.id"
            :to="`/strength/templates/${t.id}`"
            class="block rounded-card border border-line bg-surface p-4 shadow-card transition-colors hover:bg-raised"
          >
            <div class="flex items-baseline justify-between gap-3">
              <div class="text-base font-semibold text-ink">{{ t.name }}</div>
              <div class="tnum shrink-0 text-xs text-subtle">{{ t.exerciseCount }} exercises · {{ t.setCount }} sets</div>
            </div>
            <p class="mt-1 truncate text-xs text-muted">{{ t.exerciseNames.join(" · ") }}</p>
          </NuxtLink>
        </section>

        <p v-if="!data.templates.length" class="text-sm text-subtle">
          No templates yet. Run <code>npm run strength:seed</code> to add your routines.
        </p>
      </template>
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

const { data, pending, error } = await useFetch("/api/strength/templates");
// A failed lookup here just hides the banner; the templates are the page.
const { data: active } = await useFetch("/api/strength/logs/active", { default: () => ({ log: null }) });

const sections = computed(() =>
  [
    { kind: "gym", title: "Gym" },
    { kind: "physio", title: "Physio" },
  ]
    .map((s) => ({ ...s, templates: (data.value?.templates ?? []).filter((t) => t.kind === s.kind) }))
    .filter((s) => s.templates.length > 0),
);
</script>
