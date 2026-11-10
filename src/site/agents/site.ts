/** Le site en ligne, tel que le voient les moteurs de recherche et les agents : son adresse, ses pages publiées. */

/** L'adresse du site. */
export const ORIGIN = "https://prisma.valdera.fr";

/** Les pages publiées (leur fichier .html), dans l'ordre du plan du site ; la page 404 n'en est pas. */
export const PUBLISHED = ["index", "apprendre", "reference", "guitare", "comparaison"] as const;

export type PublishedPage = (typeof PUBLISHED)[number];

/** L'adresse canonique d'une page : la racine pour l'accueil. */
export const pageUrl = (page: PublishedPage) => (page === "index" ? `${ORIGIN}/` : `${ORIGIN}/${page}.html`);

/** La version Markdown d'une page, pour les agents. */
export const markdownPath = (page: PublishedPage) => `/${page}.md`;
