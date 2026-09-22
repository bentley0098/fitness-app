<template>
  <div class="min-h-screen bg-canvas text-ink">
    <main class="mx-auto max-w-lg pb-[calc(4.5rem+env(safe-area-inset-bottom))]">
      <slot />
    </main>

    <AppTabBar />
  </div>
</template>
