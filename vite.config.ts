import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  // l'heure de la construction (ou du lancement du serveur) : les aperçus faits par une autre version se refont
  define: { __BUILD__: JSON.stringify(new Date().toISOString()) },
  build: {
    // le site qui présente Prisma, à la racine, et l'application dans app/
    rollupOptions: { input: { index: "index.html", comparaison: "comparaison.html", apprendre: "apprendre.html", reference: "reference.html", guitare: "guitare.html", app: "app/index.html" } },
  },
});
