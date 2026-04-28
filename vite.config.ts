import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'ImaKeHeat',
        short_name: 'imakeheat',
        description: 'A pocket bitcrusher with grain, pitch and lo-fi textures.',
        theme_color: '#1A1B25',
        background_color: '#FAFAFA',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icons/192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icons/512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icons/maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /\/worklets\/.*\.js$/,
            handler: 'CacheFirst',
            options: { cacheName: 'audio-worklets' },
          },
        ],
      },
    }),
  ],
  server: { port: 5173 },
})
