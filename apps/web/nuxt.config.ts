// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt', '@vite-pwa/nuxt'],
  tailwindcss: {
    cssPath: '~/assets/css/tailwind.css',
    configPath: '~~/tailwind.config.ts'
  },
  app: {
    head: {
      meta: [
        { name: 'color-scheme', content: 'light' },
        // `viewport-fit=cover` is what makes env(safe-area-inset-*) resolve to
        // anything on notched iPhones — the fixed tab bar depends on it.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
      ]
    }
  },
  pwa: {
    registerType: 'autoUpdate',
    manifest: {
      name: 'Training',
      short_name: 'Training',
      display: 'standalone',
      // Matches --c-canvas. Left at gray-900 this paints a near-black status
      // bar above a white app once installed.
      theme_color: '#F8FAFC',
      background_color: '#F8FAFC'
    }
  }
})
