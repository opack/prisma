import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { VitePWA } from "vite-plugin-pwa";

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    // l'application installable (l'écran d'accueil d'une tablette), et qui marche sans réseau : le site
    // et l'application gardés à la première visite, les polices et les sons à leur premier usage
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        // l'identité de l'application installée, qui ne dépend pas de l'adresse d'ouverture
        id: "/app/",
        name: "Prisma",
        short_name: "Prisma",
        description: "Lire, écrire et jouer la musique en Prisma, une notation chromatique.",
        lang: "fr",
        start_url: "/app/",
        scope: "/",
        display: "standalone",
        background_color: "#e9eae6",
        theme_color: "#2b5d6e",
        icons: [
          { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
          { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
          { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
          { src: "/icons/logo.svg", sizes: "any", type: "image/svg+xml" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{html,js,css,svg,png,wav,woff2}"],
        runtimeCaching: [
          { urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com", handler: "StaleWhileRevalidate", options: { cacheName: "polices-css" } },
          { urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com", handler: "CacheFirst", options: { cacheName: "polices", cacheableResponse: { statuses: [0, 200] } } },
          // les échantillons des instruments (smplr) : gardés une fois chargés, ils ne changent pas
          {
            urlPattern: ({ url }) => ["https://smpldsnds.github.io", "https://gleitz.github.io", "https://goldst.dev"].includes(url.origin),
            handler: "CacheFirst",
            options: { cacheName: "sons", cacheableResponse: { statuses: [0, 200] }, rangeRequests: true },
          },
        ],
      },
    }),
  ],
  // l'heure de la construction (ou du lancement du serveur) : les aperçus faits par une autre version se refont
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
  build: {
    // le site qui présente Prisma, à la racine, et l'application dans app/
    rollupOptions: { input: { index: "index.html", comparaison: "comparaison.html", apprendre: "apprendre.html", reference: "reference.html", guitare: "guitare.html", app: "app/index.html" } },
  },
});
