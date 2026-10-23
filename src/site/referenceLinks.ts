/** Les parties de la référence vers lesquelles le site renvoie : le titre tel qu'il est écrit dans REFERENCE.md. */
import { slug } from "../app/slug.ts";

export const REFERENCE_PARTS = {
  ornaments: "4. Petites notes, ornements, point d'orgue, doigtés",
  expression: "6. Nuances, soufflets, liaisons, pédale",
  chords: "Les accords d'accompagnement",
  lyrics: "Les paroles",
  strings: "Les instruments à cordes",
  techniques: "Les techniques des cordes",
} as const;

/** Le lien vers une partie de la référence. */
export const referenceLink = (part: keyof typeof REFERENCE_PARTS) => `reference.html#${slug(REFERENCE_PARTS[part])}`;
