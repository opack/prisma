/** Une page du site écrite en HTML, sans navigateur : ce que lit un moteur de recherche ou un agent (scripts/prerender.ts). */
import { renderToString } from "vue/server-renderer";
import { createSite } from "./createSite.ts";

/** Le HTML de la page ; une erreur d'un composant fait échouer le rendu, plutôt qu'une page à moitié écrite. */
export async function render(page: string) {
  const site = createSite(page, { hydrate: true });
  const errors: unknown[] = [];
  site.config.errorHandler = (error) => void errors.push(error);
  const html = await renderToString(site);
  if (errors.length > 0) throw errors[0];
  return html;
}
