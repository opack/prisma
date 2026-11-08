/** Les pages du site, et l'application, pour le haut et le bas des pages. */

/** L'application, dans le dossier app/ du site. */
export const APP = "app/";

/** Les pages du site, dans l'ordre de la navigation. */
export const PAGES = [
  ["apprendre", "Apprendre"],
  ["reference", "Référence"],
  ["guitare", "Guitare et basse"],
  ["comparaison", "Prisma et la partition classique"],
] as const;

export type SitePage = "index" | (typeof PAGES)[number][0];
