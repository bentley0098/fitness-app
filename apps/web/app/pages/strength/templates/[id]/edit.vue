<template>
  <div class="space-y-4 p-4">
    <header>
      <NuxtLink :to="`/strength/templates/${route.params.id}`" class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-accent-700">← Template</NuxtLink>
      <h1 class="text-xl font-bold text-ink">Edit template</h1>
      <p class="mt-0.5 text-xs text-subtle">Changes apply to sessions you start from now on. Sessions already started keep what they had.</p>
    </header>

    <AsyncState :pending="pending" :error="error" title="Couldn't load this template" :skeletons="3">
      <TemplateEditor v-if="data" :initial="data" @saved="(id) => navigateTo(`/strength/templates/${id}`)" />
    </AsyncState>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();
const { data, pending, error } = await useFetch(() => `/api/strength/templates/${route.params.id}/editable`);
</script>
