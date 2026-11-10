/**
 * Après `vite build` : écrit dans dist/ le HTML de chaque page du site, pour qu'elle se lise sans
 * JavaScript (moteurs de recherche, agents). Vue la reprend ensuite dans le navigateur (src/site/main.ts).
 * L'application (dist/app/) n'est pas touchée.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "vite";

const root = fileURLToPath(new URL("..", import.meta.url));
/** Le rendu, construit pour Node : dans node_modules, pour y trouver Vue et les autres dépendances. */
const outDir = `${root}node_modules/.prerender`;
const PAGES = ["index", "apprendre", "reference", "guitare", "comparaison"];

await build({ root, logLevel: "warn", build: { ssr: "src/site/render.ts", outDir, emptyOutDir: true } });
const { render } = (await import(`${outDir}/render.js`)) as typeof import("../src/site/render.ts");

for (const page of PAGES) {
  const file = `${root}dist/${page}.html`;
  const empty = `<div id="root" data-page="${page}"></div>`;
  const html = readFileSync(file, "utf8");
  if (!html.includes(empty)) throw new Error(`${page}.html : l'élément racine vide est introuvable`);
  writeFileSync(file, html.replace(empty, `<div id="root" data-page="${page}">${await render(page)}</div>`));
}
rmSync(outDir, { recursive: true });
console.log(`pré-rendu : ${PAGES.length} pages`);
