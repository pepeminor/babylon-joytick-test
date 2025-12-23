import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      strategies: "generateSW",

      // ❌ QUAN TRỌNG: disable tự động include public assets
      injectRegister: "inline",

      workbox: {
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024, // 10MB ✅ BẮT BUỘC
        cleanupOutdatedCaches: true,

        // ❌ KHÔNG precache bất kỳ asset game nào
        globPatterns: [
          "**/*.{html,css,js,webmanifest}"
        ],

        // ❌ CHẶN TOÀN BỘ TEXTURE / ASSET GAME
        globIgnores: [
          "**/textures/**",
          "**/*.png",
          "**/*.jpg",
          "**/*.jpeg",
          "**/*.webp",
          "**/*.ktx",
          "**/*.ktx2",
          "**/*.dds",
          "**/*.hdr",
          "**/*.exr",
          "**/*.glb",
          "**/*.gltf",
          "**/*.bin"
        ],

        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === "script",
            handler: "NetworkFirst",
            options: {
              cacheName: "js-runtime"
            }
          },
          {
            urlPattern: ({ request }) =>
              request.destination === "image",
            handler: "CacheFirst",
            options: {
              cacheName: "game-textures",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30
              }
            }
          }
        ]
      },

      manifest: {
        name: "PEPE Web3 Game",
        short_name: "PEPE",
        start_url: "/",
        display: "fullscreen",
        orientation: "landscape",
        background_color: "#000000",
        theme_color: "#000000",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ]
});
