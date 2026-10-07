<template>
  <NuxtPwaAssets />
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>

<script setup lang="ts">
// Sets the dark class before first paint, so a dark device never flashes white.
useHead({ script: [{ innerHTML: THEME_INIT_SCRIPT, tagPosition: "head", tagPriority: "critical" }] });
</script>
