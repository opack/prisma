/**
 * Le site dans le navigateur : la page que dit l'élément racine (data-page). Construite, elle arrive
 * déjà écrite en HTML (scripts/prerender.ts) et Vue la reprend ; en développement, Vue l'écrit.
 */
import { createSite } from "./createSite.ts";
import "../tailwind.css";
import "./site.css";

const root = document.getElementById("root")!;
createSite(root.dataset.page, { hydrate: root.hasChildNodes() }).mount(root);
