<template>
  <div class="min-h-screen bg-gray-950 text-gray-100 flex flex-col">
    <main class="flex-1 overflow-y-auto pb-20">
      <slot />
    </main>

    <nav class="fixed bottom-0 inset-x-0 bg-gray-900 border-t border-gray-800 flex">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex-1 flex flex-col items-center gap-1 py-3 text-xs"
        :class="route.path === tab.to ? 'text-emerald-400' : 'text-gray-500'"
      >
        <span class="text-lg leading-none">{{ tab.icon }}</span>
        <span>{{ tab.label }}</span>
      </NuxtLink>
    </nav>
  </div>
</template>

<script setup lang="ts">
const route = useRoute();

const tabs = [
  { to: "/", label: "Today", icon: "◉" },
  { to: "/log", label: "Log", icon: "✎" },
  { to: "/plan", label: "Plan", icon: "☰" },
  { to: "/trends", label: "Trends", icon: "↗" },
];
</script>
