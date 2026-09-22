<template>
  <nav
    class="fixed bottom-0 inset-x-0 z-40 border-t border-line bg-surface/95 backdrop-blur"
    :style="{ paddingBottom: 'env(safe-area-inset-bottom)' }"
  >
    <div class="mx-auto flex max-w-lg">
      <NuxtLink
        v-for="tab in tabs"
        :key="tab.to"
        :to="tab.to"
        class="flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors"
        :class="isActive(tab.to) ? 'text-accent-700' : 'text-subtle hover:text-muted'"
        :aria-current="isActive(tab.to) ? 'page' : undefined"
      >
        <AppIcon :name="tab.icon" :size="22" :stroke-width="isActive(tab.to) ? 2 : 1.6" />
        <span>{{ tab.label }}</span>
      </NuxtLink>
    </div>
  </nav>
</template>

<script setup lang="ts">
const route = useRoute();

const tabs = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/plan", label: "Plan", icon: "calendar" },
  { to: "/activity", label: "Activity", icon: "run" },
  { to: "/more", label: "More", icon: "dots" },
];

// Prefix matching, not equality. The previous `route.path === tab.to` check
// left the whole bar unhighlighted on any nested route — /activity/:id and
// /more/trends both exist now.
function isActive(to: string): boolean {
  if (to === "/") return route.path === "/";
  return route.path === to || route.path.startsWith(`${to}/`);
}
</script>
