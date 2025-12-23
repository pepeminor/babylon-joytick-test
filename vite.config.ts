import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",

      strategies: "generateSW",

      workbox: {
        // ❌ NO precache file to
        globPatterns: [
          "**/*.{html,css,ico,png,svg,webmanifest}"
        ],

        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === "script" ||
              request.destination === "worker",
            handler: "NetworkFirst",
            options: {
              cacheName: "js-runtime",
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 7 // 7 days
              }
            }
          },
          {
            urlPattern: ({ request }) =>
              request.destination === "image" ||
              request.destination === "texture",
            handler: "CacheFirst",
            options: {
              cacheName: "assets-cache",
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30 // 30 days
              }
            }
          }
        ]
      },

      manifest: {
        name: "PEPE Web3 Game",
        short_name: "PEPE",
        display: "fullscreen",
        orientation: "landscape",
        background_color: "#000000",
        theme_color: "#000000",
        start_url: "/",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png" }
        ]
      }
    })
  ]
});
