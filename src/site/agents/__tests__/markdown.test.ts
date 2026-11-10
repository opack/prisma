import { describe, expect, it } from "vitest";
import { pageMarkdown } from "../markdown.ts";

const SUMMARY = { title: "Apprendre", description: "La notation en huit étapes." };
const URL = "https://prisma.valdera.fr/apprendre.html";
const page = (main: string) => `<header><a href="index.html">Prisma</a></header><main>${main}</main><footer>bas</footer>`;

describe("une page en Markdown", () => {
  it("commence par son titre, sa description et son adresse, puis le texte de la page seul", () => {
    const markdown = pageMarkdown(page("<h1>Apprendre pas à pas</h1><p>Huit étapes.</p>"), SUMMARY, URL);
    expect(markdown).toBe(
      '---\ntitle: "Apprendre"\ndescription: "La notation en huit étapes."\nurl: "https://prisma.valdera.fr/apprendre.html"\n---\n\n# Apprendre pas à pas\n\nHuit étapes.\n',
    );
  });

  it("écrit un exemple dans son texte Prisma, sans sa gravure ni ses onglets", () => {
    const example = '<figure data-prisma="m1 |1  ||\n0  |5  ||\n"><div role="tablist"><button>Partition</button></div><svg></svg></figure>';
    expect(pageMarkdown(page(example), SUMMARY, URL)).toContain("```prisma\nm1 |1  ||\n0  |5  ||\n```");
  });

  it("garde le nom d'un dessin, et le texte en chasse fixe tel qu'il est", () => {
    const markdown = pageMarkdown(
      page('<svg role="img" aria-label="Deux octaves du clavier"><text>1</text></svg><pre>e|--3--|\nB|--0--|</pre>'),
      SUMMARY,
      URL,
    );
    expect(markdown).toContain("*Deux octaves du clavier*");
    expect(markdown).toContain("```\ne|--3--|\nB|--0--|\n```");
  });

  it("fait d'un tableau un tableau Markdown, et rattache les liens au site", () => {
    const markdown = pageMarkdown(
      page(
        '<table><tr><th>Note</th><th>Nombre</th></tr><tr><td><i>do</i></td><td><code>1</code></td></tr></table><a href="app/">L\'application</a>',
      ),
      SUMMARY,
      URL,
    );
    expect(markdown).toContain("| Note | Nombre |\n| --- | --- |\n| *do* | `1` |");
    expect(markdown).toContain("[L'application](https://prisma.valdera.fr/app/)");
  });
});
