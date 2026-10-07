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
        { name: 'color-scheme', content: 'light dark' },
        { name: 'theme-color', content: '#F8FAFC', media: '(prefers-color-scheme: light)' },
        { name: 'theme-color', content: '#121212', media: '(prefers-color-scheme: dark)' },
        // `viewport-fit=cover` is what makes env(safe-area-inset-*) resolve to
        // anything on notched iPhones — the fixed tab bar depends on it.
        { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' }
      ],
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/icon.svg' },
        { rel: 'apple-touch-icon', href: '/apple-touch-icon.png' }
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
      background_color: '#F8FAFC',
      icons: [
        { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
        { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
        { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml' }
      ]
    }
  }
})
