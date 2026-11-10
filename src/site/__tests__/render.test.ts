import { describe, expect, it } from "vitest";
import { render } from "../render.ts";

/** Les pages du site et le titre que doit lire, sans JavaScript, un moteur de recherche ou un agent. */
const PAGES = [
  ["index", "Une note, un nombre."],
  ["apprendre", "Apprendre pas à pas"],
  ["reference", "Lire et jouer en Prisma"],
  ["guitare", "La guitare et la basse"],
  ["comparaison", "Prisma et la partition classique"],
  ["404", "Cette page n&#39;existe pas"],
] as const;

describe("le site écrit en HTML au build", () => {
  it.each(PAGES)("%s : la page entière, avec son titre", async (page, title) => {
    const html = await render(page);
    expect(html).toMatch(new RegExp(`<h1[^>]*>[^<]*${title}`));
    expect(html).toContain("<footer");
  });
});
