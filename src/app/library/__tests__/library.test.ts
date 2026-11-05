import { describe, expect, it } from "vitest";
import { describe as describeFile, kindOf, scan } from "../library.ts";

describe("bibliothèque", () => {
  it("lit le titre et le compositeur : l'en-tête d'un .prisma, les crédits d'un MusicXML", async () => {
    expect(describeFile('---\nformat: 1\ntitle: "Gymnopédie n°1"\ncomposer: Erik Satie\n---\nm1 |1  ||\n', "prisma")).toEqual({ title: "Gymnopédie n°1", composer: "Erik Satie" });
    expect(describeFile("m1 |1  ||\n", "prisma")).toEqual({ title: undefined, composer: undefined });
    const xml = `<score-partwise><work><work-title>Clair &amp; net</work-title></work><identification><creator type="composer">Anonyme</creator></identification>`;
    expect(describeFile(xml, "musicxml")).toEqual({ title: "Clair & net", composer: "Anonyme" });
    expect(describeFile("<movement-title>Mouvement</movement-title>", "musicxml").title).toBe("Mouvement");
  });

  /** Une source en mémoire, comme le sera un drive en ligne : des chemins et leurs textes. */
  async function memorySource(files: Record<string, string>) {
    const stored = (name: string, text: string) => ({ name, where: "en mémoire", text: async () => text, write: async () => {} });
    const folder = (path: string) => ({
      name: path.split("/").at(-1) ?? "",
      file: async (name: string) => (files[path ? `${path}/${name}` : name] !== undefined ? stored(name, files[path ? `${path}/${name}` : name]) : null),
      create: async (name: string) => stored(name, ""),
      remove: async () => {},
    });
    return {
      kind: "disk" as const,
      label: "Mémoire",
      locked: { hint: "", action: "" },
      root: folder(""),
      access: async () => true,
      files: async () =>
        Object.entries(files)
          .filter(([path]) => kindOf(path))
          .map(([path, text]) => {
            const folderPath = path.split("/").slice(0, -1).join("/");
            const name = path.split("/").at(-1)!;
            return { path, folder: folderPath, name, modified: 1, file: stored(name, text), dir: folder(folderPath) };
          }),
    };
  }

  it("lit les morceaux d'une source : leur sorte, leur titre, les options de leurs réglages", async () => {
    const source = await memorySource({
      "Au clair.prisma": "---\nformat: 1\ntitle: Au clair de la lune\n---\nm1 |1  ||\n",
      "Au clair.prisma.json": JSON.stringify({ format: 1, options: { fingerings: false } }),
      "Satie/Gymnopedie.musicxml": "<work-title>Gymnopédie</work-title><creator type=\"composer\">Erik Satie</creator>",
      "notes.txt": "pas une partition",
    });
    const entries = await scan(source);
    expect(entries.map((e) => [e.path, e.folder, e.kind, e.title, e.composer])).toEqual([
      ["Au clair.prisma", "", "prisma", "Au clair de la lune", undefined],
      ["Satie/Gymnopedie.musicxml", "Satie", "musicxml", "Gymnopédie", "Erik Satie"],
    ]);
    expect(entries[0].own).toEqual({ fingerings: false });
    expect(entries[1].own).toBeUndefined();
  });
});
