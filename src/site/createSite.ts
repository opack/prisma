/**
 * Le site en Vue, une page par adresse : celle que dit son nom, l'accueil sinon. Construit au build
 * pour écrire chaque page en HTML (render.ts), puis repris dans le navigateur (main.ts).
 */
import { createApp, createSSRApp } from "vue";
import Comparison from "./pages/Comparison.vue";
import Guitar from "./pages/Guitar.vue";
import Home from "./pages/Home.vue";
import Learn from "./pages/Learn.vue";
import Reference from "./pages/Reference.vue";

const PAGES = { comparaison: Comparison, apprendre: Learn, reference: Reference, guitare: Guitar } as const;

/** La page `page` ; `hydrate` : elle reprend le HTML déjà écrit au lieu de le refaire. */
export function createSite(page: string | undefined, { hydrate }: { hydrate: boolean }) {
  const component = PAGES[page as keyof typeof PAGES] ?? Home;
  return hydrate ? createSSRApp(component) : createApp(component);
}
