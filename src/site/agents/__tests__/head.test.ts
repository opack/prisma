import { describe, expect, it } from "vitest";
import { headTags } from "../head.ts";

const SUMMARY = { title: "Apprendre Prisma pas à pas", description: 'Les nombres, les octaves & les durées, en "huit" étapes.' };

describe("l'en-tête d'une page publiée", () => {
  it("donne son adresse canonique, sa version Markdown et son aperçu", () => {
    const tags = headTags("apprendre", SUMMARY);
    expect(tags).toContain('<link rel="canonical" href="https://prisma.valdera.fr/apprendre.html" />');
    expect(tags).toContain('<link rel="alternate" type="text/markdown" href="/apprendre.md" />');
    expect(tags).toContain('<meta property="og:title" content="Apprendre Prisma pas à pas" />');
    expect(tags).toContain(
      '<meta property="og:description" content="Les nombres, les octaves &amp; les durées, en &quot;huit&quot; étapes." />',
    );
    expect(tags).not.toContain("application/ld+json");
  });

  it("l'accueil : la racine du site, et ce qu'est Prisma en données structurées", () => {
    const tags = headTags("index", { title: "Prisma", description: "<b>Une note</b>, un nombre." });
    expect(tags).toContain('<link rel="canonical" href="https://prisma.valdera.fr/" />');
    const json = /<script type="application\/ld\+json">(.*)<\/script>/.exec(tags)![1];
    expect(json).not.toContain("<");
    expect(JSON.parse(json).map((thing: { "@type": string }) => thing["@type"])).toEqual(["WebSite", "SoftwareApplication"]);
  });
});
