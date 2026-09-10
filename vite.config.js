import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      // Kill stuck clients: SW unregisters itself and clears caches once.
      selfDestroying: true,
      includeAssets: ['favicon.svg', 'icons/*.png'],
      manifest: {
        name: 'Зона',
        short_name: 'Зона',
        description: 'Спокойные звуки. Наложи несколько — слушай свой микс.',
        theme_color: '#1a6fb5',
        background_color: '#f4f8fc',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui'],
        orientation: 'portrait',
        start_url: '/',
        lang: 'ru',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        cacheId: 'zone-v7-destroy',
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [
          /\/sounds\/.*\.mp3$/i,
          /^\/icons\//,
          /^\/api\//,
          /^\/sitemap\.xml$/,
          /^\/robots\.txt$/,
        ],
        globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2,json}'],
        runtimeCaching: [
          {
            urlPattern: /\/sounds\/.*\.mp3$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'zone-sounds',
              expiration: {
                maxEntries: 40,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
              rangeRequests: true,
            },
          },
        ],
      },
    }),
  ],
});