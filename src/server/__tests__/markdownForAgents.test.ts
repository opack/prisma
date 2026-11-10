import { describe, expect, it } from "vitest";
import { config } from "../../../netlify/edge-functions/markdown.ts";
import { PAGE_PATHS, markdownFor } from "../markdownForAgents.ts";

const request = (path: string, accept?: string) =>
  new Request(`https://prisma.valdera.fr${path}`, { headers: accept === undefined ? {} : { accept } });

describe("le Markdown pour les agents", () => {
  it("sert la version .md d'une page demandée en Markdown", () => {
    expect(markdownFor(request("/apprendre.html", "text/markdown"))).toBe("/apprendre.md");
    expect(markdownFor(request("/apprendre", "text/markdown, text/html;q=0.9"))).toBe("/apprendre.md");
    expect(markdownFor(request("/", "text/markdown"))).toBe("/index.md");
  });

  it("laisse le HTML à un navigateur, à curl, et à qui préfère le HTML", () => {
    const browser = "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8";
    expect(markdownFor(request("/apprendre.html", browser))).toBeUndefined();
    expect(markdownFor(request("/apprendre.html", "*/*"))).toBeUndefined();
    expect(markdownFor(request("/apprendre.html"))).toBeUndefined();
    expect(markdownFor(request("/apprendre.html", "text/html, text/markdown;q=0.5"))).toBeUndefined();
    expect(markdownFor(request("/apprendre.html", "text/markdown;q=0"))).toBeUndefined();
  });

  it("ne touche qu'aux pages du site", () => {
    expect(markdownFor(request("/app/", "text/markdown"))).toBeUndefined();
    expect(markdownFor(request("/llms.txt", "text/markdown"))).toBeUndefined();
  });

  it("la fonction de Netlify répond aux adresses de toutes les pages, et seulement à elles", () => {
    expect([...config.path].sort()).toEqual([...PAGE_PATHS.keys()].sort());
  });
});
