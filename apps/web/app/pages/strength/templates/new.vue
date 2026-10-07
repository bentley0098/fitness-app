<template>
  <div class="space-y-4 p-4">
    <header>
      <NuxtLink to="/strength" class="mb-1 inline-flex items-center gap-1 text-xs font-medium text-accent-700">← Strength</NuxtLink>
      <h1 class="text-xl font-bold text-ink">New template</h1>
    </header>
    <TemplateEditor @saved="(id) => navigateTo(`/strength/templates/${id}`)" />
  </div>
</template>
