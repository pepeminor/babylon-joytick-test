import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',           // Tự update khi có version mới
      devOptions: { enabled: false },        // Test trên dev (localhost)
      manifest: {
        name: 'PEPE Web3 Game',
        short_name: 'PEPE',
        description: 'Mint random Pepe weapons gacha!',
        theme_color: '#000000',
        background_color: '#000000',
        display: 'fullscreen',              // Giữ nguyên như bạn
        orientation: 'landscape',
        start_url: '/',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' }
        ]
      },
      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,  // 10 MB - đủ cho 5.91 MB + dư
        globPatterns: ['**/*.{js,css,html,ico,png,svg}']  // Cache cơ bản
      }
    })
  ]
})