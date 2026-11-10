/**
 * Après `vite build` : les pages du site pour qui les lit sans JavaScript (moteurs de recherche, agents).
 *
 * - le HTML de chaque page, écrit dans dist/ ; Vue la reprend ensuite dans le navigateur (src/site/main.ts) ;
 * - l'en-tête de chaque page publiée : adresse canonique, aperçu, données structurées (src/site/agents/head.ts) ;
 * - sa version Markdown, à côté (`apprendre.md`…), pour les agents (src/site/agents/markdown.ts) ;
 *   la référence et le format tels qu'ils sont écrits (`reference.md`, `format.md`), et les deux ensemble
 *   dans `llms-full.txt`, de quoi apprendre à lire et écrire du Prisma en une lecture.
 *
 * L'application (dist/app/) n'est pas touchée.
 */
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { build } from "vite";
import { headTags } from "../src/site/agents/head.ts";
import { pageMarkdown } from "../src/site/agents/markdown.ts";
import { ORIGIN, PUBLISHED, pageUrl } from "../src/site/agents/site.ts";
import type { PublishedPage } from "../src/site/agents/site.ts";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = `${root}dist`;
/** Le rendu, construit pour Node : dans node_modules, pour y trouver Vue et les autres dépendances. */
const outDir = `${root}node_modules/.prerender`;

await build({ root, logLevel: "warn", build: { ssr: "src/site/render.ts", outDir, emptyOutDir: true } });
const { render } = (await import(`${outDir}/render.js`)) as typeof import("../src/site/render.ts");

/** Le titre et la description d'une page, tels que les donne son en-tête. */
function summary(html: string, page: string) {
  const title = /<title>([^<]*)<\/title>/.exec(html)?.[1];
  const description = /<meta\s+name="description"\s+content="([^"]*)"/.exec(html)?.[1];
  if (!title || !description) throw new Error(`${page}.html : il manque le titre ou la description`);
  return { title, description };
}

/** Écrit le HTML de la page dans son élément racine ; rend ce HTML. */
async function prerender(page: string) {
  const file = `${dist}/${page}.html`;
  const empty = `<div id="root" data-page="${page}"></div>`;
  const html = readFileSync(file, "utf8");
  if (!html.includes(empty)) throw new Error(`${page}.html : l'élément racine vide est introuvable`);
  const content = await render(page);
  const written = html.replace(empty, `<div id="root" data-page="${page}">${content}</div>`);
  writeFileSync(file, written);
  return { file, html: written, content };
}

for (const page of PUBLISHED as readonly PublishedPage[]) {
  const { file, html, content } = await prerender(page);
  const pageSummary = summary(html, page);
  writeFileSync(file, html.replace("</head>", `\n    ${headTags(page, pageSummary)}\n  </head>`));
  // la référence : telle qu'elle est écrite, ses exemples compris
  if (page !== "reference") writeFileSync(`${dist}/${page}.md`, pageMarkdown(content, pageSummary, pageUrl(page)));
}
await prerender("404");

const reference = readFileSync(`${root}REFERENCE.md`, "utf8").replaceAll("](FORMAT.md)", "](format.md)");
const format = readFileSync(`${root}FORMAT.md`, "utf8");
writeFileSync(`${dist}/reference.md`, reference);
writeFileSync(`${dist}/format.md`, format);
writeFileSync(
  `${dist}/llms-full.txt`,
  `# Prisma : la référence et le format\n\n> Prisma est une notation musicale chromatique. Ce fichier réunit la référence pour le musicien (${ORIGIN}/reference.md) puis la description exacte du format .prisma (${ORIGIN}/format.md).\n\n${reference}\n\n${format}`,
);

rmSync(outDir, { recursive: true });
console.log(`pré-rendu : ${PUBLISHED.length} pages et la page 404, leurs versions Markdown, llms-full.txt`);
