import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePrisma, writePrisma } from "../index.ts";
import { REFERENCE_PARTS } from "../../site/pages/referenceLinks.ts";

/** Exemples ```prisma de la référence (éventuellement dans une liste, donc indentés). */
function examples(markdown: string): string[] {
  const out: string[] = [];
  const re = /^( *)```prisma\n([\s\S]*?)^\1```/gm;
  for (let match = re.exec(markdown); match; match = re.exec(markdown)) {
    const indent = match[1].length;
    out.push(
      match[2]
        .split("\n")
        .map((line) => line.slice(indent))
        .join("\n"),
    );
  }
  return out;
}

/** Forme écrite par l'application, sans la ligne de version (inutile dans un extrait). */
const canonical = (text: string) =>
  writePrisma(parsePrisma(text))
    .replace(/^format: \d+\n/m, "")
    .replace(/^---\n---\n\n?/, "")
    .trimEnd() + "\n";

describe("référence", () => {
  const reference = readFileSync(new URL("../../../REFERENCE.md", import.meta.url), "utf8");
  const list = examples(reference);

  it("contient des exemples", () => {
    expect(list.length).toBeGreaterThan(5);
  });

  it.each(list.map((text, index) => [index + 1, text]))("exemple %i : se lit sans erreur, tel que l'application l'écrit", (_, text) => {
    expect(() => parsePrisma(text as string)).not.toThrow();
    expect(text).toBe(canonical(text as string));
  });
});

describe("liens du site vers la référence", () => {
  it("chaque partie visée est un titre de la référence", () => {
    const titles = readFileSync("REFERENCE.md", "utf8")
      .split("\n")
      .filter((line) => line.startsWith("#"))
      .map((line) => line.replace(/^#+\s*/, ""));
    for (const text of Object.values(REFERENCE_PARTS)) expect(titles).toContain(text);
  });
});
