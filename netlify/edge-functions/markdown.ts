/** Le Markdown pour les agents, en fonction Netlify en périphérie (voir src/server/markdownForAgents.ts). */
import { markdownFor } from "../../src/server/markdownForAgents.ts";

/** Ce que donne Netlify à la fonction : la suite, la page telle qu'elle serait servie sans elle. */
type Context = { next: () => Promise<Response> };

export default async (request: Request, context: Context) => {
  const markdown = markdownFor(request);
  // la même adresse donne du HTML ou du Markdown : un cache doit tenir compte de l'en-tête Accept
  const response = markdown ? await fetch(new URL(markdown, request.url)) : await context.next();
  const served = new Response(response.body, response);
  served.headers.append("Vary", "Accept");
  if (markdown) served.headers.set("Content-Type", "text/markdown; charset=utf-8");
  return served;
};

// les adresses des pages du site (une liste écrite telle quelle, lue par Netlify ; un test la compare à PAGE_PATHS)
export const config = {
  path: [
    "/",
    "/index",
    "/index.html",
    "/apprendre",
    "/apprendre.html",
    "/reference",
    "/reference.html",
    "/guitare",
    "/guitare.html",
    "/comparaison",
    "/comparaison.html",
  ],
};
