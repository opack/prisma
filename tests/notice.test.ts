import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parsePrisma, writePrisma } from "../src/core/index.ts";

/** Exemples ```prisma de la notice (éventuellement dans une liste, donc indentés). */
function examples(markdown: string): string[] {
  const out: string[] = [];
  const re = /^( *)```prisma\n([\s\S]*?)^\1```/gm;
  for (let m = re.exec(markdown); m; m = re.exec(markdown)) {
    const indent = m[1].length;
    out.push(m[2].split("\n").map((l) => l.slice(indent)).join("\n"));
  }
  return out;
}

/** Forme écrite par l'application, sans la ligne de version (inutile dans un extrait). */
const canonical = (text: string) =>
  writePrisma(parsePrisma(text))
    .replace(/^format: \d+\n/m, "")
    .replace(/^---\n---\n\n?/, "")
    .trimEnd() + "\n";

describe("notice", () => {
  const notice = readFileSync(new URL("../NOTICE.md", import.meta.url), "utf8");
  const list = examples(notice);

  it("contient des exemples", () => {
    expect(list.length).toBeGreaterThan(5);
  });

  it.each(list.map((text, i) => [i + 1, text]))("exemple %i : se lit sans erreur, tel que l'application l'écrit", (_, text) => {
    expect(() => parsePrisma(text as string)).not.toThrow();
    expect(text).toBe(canonical(text as string));
  });
});
