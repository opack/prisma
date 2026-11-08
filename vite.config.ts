/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import tailwindcss from "@tailwindcss/vite";
import type { Connect } from "vite";
import { VitePWA } from "vite-plugin-pwa";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { pcloudFile } from "./src/server/pcloudFile.ts";

/** Le relais de lecture pCloud (une fonction Netlify en ligne), servi aussi par `npm run dev` et `npm run preview`. */
const relay: Connect.NextHandleFunction = async (req, res) => {
  const url = new URL(req.originalUrl ?? req.url ?? "/", "http://localhost");
  const headers = new Headers(
    Object.entries(req.headers).flatMap(([name, value]) => (typeof value === "string" ? [[name, value] as [string, string]] : [])),
  );
  const response = await pcloudFile(new Request(url, { method: req.method, headers }));
  res.statusCode = response.status;
  response.headers.forEach((value, name) => res.setHeader(name, value));
  res.end(Buffer.from(await response.arrayBuffer()));
};

/** La version de l'application : celle de package.json. */
const version: string = JSON.parse(readFileSync(new URL("./package.json", import.meta.url), "utf8")).version;

/** Le commit construit, en court : donné par Netlify (COMMIT_REF), sinon lu dans git ; rien hors d'un dépôt. */
function commit() {
  if (process.env.COMMIT_REF) return process.env.COMMIT_REF.slice(0, 7);
  try {
    return execSync("git rev-parse --short=7 HEAD", { stdio: ["ignore", "pipe", "ignore"] })
      .toString()
      .trim();
  } catch {
    return "";
  }
}

export default defineConfig({
  // @ : la racine des sources (src/), pour les composants de shadcn-vue et leurs imports
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  plugins: [
    {
      name: "relais-pcloud",
      configureServer: (server) => void server.middlewares.use("/api/pcloud-file", relay),
      configurePreviewServer: (server) => void server.middlewares.use("/api/pcloud-file", relay),
    },
    vue(),
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
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.googleapis.com",
            handler: "StaleWhileRevalidate",
            options: { cacheName: "polices-css" },
          },
          {
            urlPattern: ({ url }) => url.origin === "https://fonts.gstatic.com",
            handler: "CacheFirst",
            options: { cacheName: "polices", cacheableResponse: { statuses: [0, 200] } },
          },
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
  // l'heure de la construction (ou du lancement du serveur) : les aperçus faits par une autre version se refont ;
  // la version (semver, celle de package.json et de CHANGELOG.md) et le commit, montrés dans Aide › À propos
  define: {
    __BUILD__: JSON.stringify(new Date().toISOString()),
    __VERSION__: JSON.stringify(version),
    __COMMIT__: JSON.stringify(commit()),
  },
  build: {
    // le site qui présente Prisma, à la racine, et l'application dans app/
    rollupOptions: {
      input: {
        index: "index.html",
        comparaison: "comparaison.html",
        apprendre: "apprendre.html",
        reference: "reference.html",
        guitare: "guitare.html",
        app: "app/index.html",
      },
    },
  },
  // Vitest : les tests unitaires seuls (ceux du navigateur, dans tests/e2e et tests/visual, sont à Playwright)
  test: { include: ["src/**/*.test.ts", "tests/**/*.test.ts"] },
});
