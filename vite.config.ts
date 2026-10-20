import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    // le site qui présente Prisma, à la racine, et l'application dans app/
    rollupOptions: { input: { index: "index.html", comparaison: "comparaison.html", apprendre: "apprendre.html", reference: "reference.html", app: "app/index.html" } },
  },
});
