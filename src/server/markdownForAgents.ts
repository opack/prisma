/**
 * Le Markdown pour les agents : une page du site demandée en Markdown (`Accept: text/markdown`)
 * est servie dans sa version .md, écrite au build (scripts/prerender.ts) ; un navigateur, qui
 * demande du HTML, reçoit toujours la page. Une fonction Netlify en ligne
 * (netlify/edge-functions/markdown.ts).
 */
import { PUBLISHED, markdownPath } from "../site/agents/site.ts";

/** Les adresses de chaque page publiée (avec ou sans .html, la racine pour l'accueil), et sa version Markdown. */
export const PAGE_PATHS: ReadonlyMap<string, string> = new Map(
  PUBLISHED.flatMap((page) => {
    const paths = page === "index" ? ["/", "/index", "/index.html"] : [`/${page}`, `/${page}.html`];
    return paths.map((path) => [path, markdownPath(page)] as const);
  }),
);

/** Ce que l'en-tête Accept dit d'un type : sa qualité (`q`, 0 s'il ne le cite pas), et s'il le cite par son nom (plutôt que par `text/*` ou `*\/*`). */
function preference(accept: string, type: string) {
  const [major] = type.split("/");
  let best = { precision: -1, quality: 0 };
  for (const entry of accept.toLowerCase().split(",")) {
    const [range, ...parameters] = entry.split(";").map((part) => part.trim());
    const precision = range === type ? 2 : range === `${major}/*` ? 1 : range === "*/*" ? 0 : -1;
    if (precision <= best.precision) continue;
    const quality = parameters.find((parameter) => parameter.startsWith("q="));
    best = { precision, quality: quality ? Number(quality.slice(2)) || 0 : 1 };
  }
  return { named: best.precision === 2, quality: best.quality };
}

/**
 * La version Markdown à servir pour cette requête : une page du site, dont l'en-tête Accept nomme
 * `text/markdown` et ne lui préfère pas le HTML ; sinon rien (`*\/*` seul, celui de curl, reste du HTML).
 */
export function markdownFor(request: Request) {
  const path = PAGE_PATHS.get(new URL(request.url).pathname);
  if (path === undefined) return undefined;
  const accept = request.headers.get("accept") ?? "";
  const markdown = preference(accept, "text/markdown");
  return markdown.named && markdown.quality > 0 && markdown.quality >= preference(accept, "text/html").quality ? path : undefined;
}
