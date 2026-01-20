import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: "autoUpdate",
      // SUPPRIMEZ includeAssets pour éviter doublons
      manifest: {
  name: "EasyGest BP",
  short_name: "EasyGest",
  description: "Gestion de boulangerie-pâtisserie offline-first",
  theme_color: "#D4A574",
  background_color: "#FDF8F3",
  display: "standalone",
  orientation: "portrait-primary",
  scope: "/",
  start_url: "/",
  icons: [
    { src: "/icon.png", sizes: "512x512", type: "image/png" },
    { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
  ],
  // ✅ AJOUTEZ CETTE SECTION
  screenshots: [
    {
      src: "/screenshot-mobile.png",
      sizes: "540x720",
      type: "image/png",
      form_factor: "narrow",
      label: "EasyGest BP - Vue mobile"
    },
    {
      src: "/screenshot-desktop.png",
      sizes: "1280x720",
      type: "image/png",
      form_factor: "wide",
      label: "EasyGest BP - Vue desktop"
    }
  ]
},
      workbox: {
        globPatterns: ["**/*.{js,css,html,png,svg,woff2}"],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "google-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: "CacheFirst",
            options: {
              cacheName: "gstatic-fonts-cache",
              expiration: {
                maxEntries: 10,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
