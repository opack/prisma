import { describe, expect, it } from "vitest";
import { countOf, groupEntries } from "../browse.ts";
import type { LibraryEntry } from "../library.ts";

/** Un morceau de la bibliothèque, son chemin, sa sorte et, au besoin, son titre et son compositeur. */
function entry(path: string, details: Partial<LibraryEntry> = {}): LibraryEntry {
  const name = path.split("/").at(-1)!;
  const folder = path.includes("/") ? path.slice(0, path.lastIndexOf("/")) : "";
  return { path, folder, name, modified: 0, kind: name.endsWith(".prisma") ? "prisma" : "musicxml", ...details } as LibraryEntry;
}

const ENTRIES = [
  entry("Satie/gymnopedie.prisma", { title: "Gymnopédie n°1", composer: "Erik Satie" }),
  entry("clair.prisma", { title: "Au clair de la lune" }),
  entry("Bach/prelude.musicxml", { title: "Prélude", composer: "Bach" }),
  entry("Satie/gnossienne.prisma", { title: "Gnossienne", composer: "Erik Satie" }),
];
const shown = (groups: ReturnType<typeof groupEntries>) => groups.map((group) => [group.folder, group.entries.map((found) => found.title)]);

describe("parcourir la bibliothèque", () => {
  it("range par sous-dossier, le dossier lui-même en tête, et trie par titre", () => {
    expect(shown(groupEntries(ENTRIES, "", "title", "all"))).toEqual([
      ["", ["Au clair de la lune"]],
      ["Bach", ["Prélude"]],
      ["Satie", ["Gnossienne", "Gymnopédie n°1"]],
    ]);
  });

  it("cherche sans tenir compte des accents ni des majuscules, dans le titre, le compositeur et le chemin", () => {
    expect(shown(groupEntries(ENTRIES, "GYMNOPEDIE", "title", "all"))).toEqual([["Satie", ["Gymnopédie n°1"]]]);
    expect(shown(groupEntries(ENTRIES, "bach", "title", "all"))).toEqual([["Bach", ["Prélude"]]]);
  });

  it("ne montre qu'une sorte, et compte chacune", () => {
    expect(shown(groupEntries(ENTRIES, "", "title", "musicxml"))).toEqual([["Bach", ["Prélude"]]]);
    expect([countOf(ENTRIES, "all"), countOf(ENTRIES, "prisma"), countOf(ENTRIES, "musicxml")]).toEqual([4, 3, 1]);
  });
});
