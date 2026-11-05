import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { compareVersions, releases, updatedSince } from "../changelog.ts";

describe("nouveautés", () => {
  const list = releases(readFileSync(new URL("../../../../CHANGELOG.md", import.meta.url), "utf8"));
  const pkg = JSON.parse(readFileSync(new URL("../../../../package.json", import.meta.url), "utf8"));

  it("commencent par la version de l'application", () => {
    expect(list[0].version).toBe(pkg.version);
  });

  it("vont de la plus récente à la plus ancienne, chacune datée et avec ses changements", () => {
    for (let index = 1; index < list.length; index++) expect(compareVersions(list[index].version, list[index - 1].version)).toBeLessThan(0);
    for (const release of list) {
      expect(release.date).toMatch(/^\d{1,2} \p{L}+ \d{4}$/u);
      expect(release.html).toContain("<li>");
    }
  });

  it("lisent le Markdown d'une version, avec ses classes", () => {
    const [r] = releases("# Nouveautés\n\n## 1.2.0 — 3 mars 2027\n\n- Un `7` de plus.\n\n## 1.1.0 — 1 mars 2027\n\n- Avant.\n");
    expect(r).toMatchObject({ version: "1.2.0", date: "3 mars 2027" });
    expect(r.html).toContain('<code class="font-mono');
    expect(r.html).not.toContain("Avant");
  });
});

describe("versions", () => {
  it("se comparent nombre par nombre", () => {
    expect(compareVersions("0.10.0", "0.9.3")).toBeGreaterThan(0);
    expect(compareVersions("1.0.0", "1.0.0")).toBe(0);
    expect(compareVersions("1.0.1", "1.1.0")).toBeLessThan(0);
  });

  it("une mise à jour : une version vue plus ancienne ; pas une première visite, ni un retour en arrière", () => {
    expect(updatedSince("0.2.0", "0.3.0")).toBe(true);
    expect(updatedSince(null, "0.3.0")).toBe(false);
    expect(updatedSince("0.3.0", "0.3.0")).toBe(false);
    expect(updatedSince("0.4.0", "0.3.0")).toBe(false);
    expect(updatedSince("n'importe quoi", "0.3.0")).toBe(false);
  });
});
