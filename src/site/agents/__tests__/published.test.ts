import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { PUBLISHED, pageUrl } from "../site.ts";

const read = (file: string) => readFileSync(new URL(`../../../../${file}`, import.meta.url), "utf8");

describe("ce que le site publie pour les moteurs de recherche et les agents", () => {
  it("le plan du site donne chaque page publiée, et elles seules", () => {
    const urls = [...read("public/sitemap.xml").matchAll(/<loc>([^<]*)<\/loc>/g)].map((match) => match[1]);
    expect(urls).toEqual(PUBLISHED.map(pageUrl));
  });

  it("robots.txt ouvre le site, permet l'entraînement des IA et donne le plan du site", () => {
    const robots = read("public/robots.txt");
    expect(robots).toContain("Content-Signal: search=yes, ai-input=yes, ai-train=yes");
    expect(robots).not.toMatch(/^Disallow: \/$/m);
    expect(robots).toContain("Sitemap: https://prisma.valdera.fr/sitemap.xml");
  });

  it("llms.txt mène à la version Markdown de chaque page, au format et au texte complet", () => {
    const links = [...read("public/llms.txt").matchAll(/\]\((https:\/\/prisma\.valdera\.fr\/[^)]*)\)/g)].map((match) => match[1]);
    for (const page of PUBLISHED) expect(links).toContain(`https://prisma.valdera.fr/${page}.md`);
    expect(links).toContain("https://prisma.valdera.fr/format.md");
    expect(links).toContain("https://prisma.valdera.fr/llms-full.txt");
  });

  it("chaque page publiée a sa propre description", () => {
    const descriptions = PUBLISHED.map((page) => /name="description"\s+content="([^"]*)"/.exec(read(`${page}.html`))?.[1]);
    expect(new Set(descriptions).size).toBe(PUBLISHED.length);
  });
});
