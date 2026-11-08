/** Le site en Vue : la page que dit l'élément racine (data-page), l'accueil sinon. */
import { createApp } from "vue";
import Comparison from "./pages/Comparison.vue";
import Guitar from "./pages/Guitar.vue";
import Home from "./pages/Home.vue";
import Learn from "./pages/Learn.vue";
import Reference from "./pages/Reference.vue";
import "../tailwind.css";
import "./site.css";

const root = document.getElementById("root")!;
const PAGES = { comparaison: Comparison, apprendre: Learn, reference: Reference, guitare: Guitar } as const;
createApp(PAGES[root.dataset.page as keyof typeof PAGES] ?? Home).mount(root);
