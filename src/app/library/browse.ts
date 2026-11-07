/**
 * Parcourir la bibliothèque : les morceaux cherchés (sans tenir compte des accents ni des
 * majuscules), filtrés par sorte, rangés par sous-dossier et triés par titre ou par compositeur ;
 * ou, ouverts récemment, en une seule liste, du plus récent au plus ancien. Partagé par les
 * bibliothèques de React et de Vue.
 */
import { recentOpenings } from "./library.ts";
import type { LibraryEntry } from "./library.ts";

export type Sort = "title" | "composer" | "recent";
export const SORTS: { value: Sort; label: string }[] = [
  { value: "title", label: "Titre" },
  { value: "composer", label: "Compositeur" },
  { value: "recent", label: "Ouverts récemment" },
];

/** Les morceaux montrés : tous, les partitions .prisma seules, ou les MusicXML à importer seuls. */
export type Kinds = "all" | "prisma" | "musicxml";

/** En liste, pour chercher vite ; en vignettes, pour retrouver un morceau à l'œil. */
export type LibraryView = "list" | "thumbs";

/** Pour chercher et trier sans tenir compte des accents ni des majuscules. */
const fold = (text: string) => text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
export const titleOf = (libraryEntry: LibraryEntry) => libraryEntry.title ?? libraryEntry.name.replace(/\.[^.]+$/, "");
const compare = (first: string, second: string) => first.localeCompare(second, "fr", { sensitivity: "base", numeric: true });

/** Les morceaux d'une sorte. */
export const countOf = (entries: LibraryEntry[], shown: Kinds) =>
  entries.filter((libraryEntry) => shown === "all" || libraryEntry.kind === shown).length;

/** Les morceaux qui répondent à la recherche, par sous-dossier (le dossier lui-même en tête), triés. */
export function groupEntries(entries: LibraryEntry[], query: string, sort: Sort, kinds: Kinds) {
  const needle = fold(query.trim());
  const found = entries.filter(
    (libraryEntry) =>
      (kinds === "all" || libraryEntry.kind === kinds) &&
      (!needle || fold([titleOf(libraryEntry), libraryEntry.composer ?? "", libraryEntry.path].join(" ")).includes(needle)),
  );
  if (sort === "recent") {
    const recent = recentOpenings();
    const at = (entry: LibraryEntry) => recent[entry.path] ?? 0;
    return [
      { folder: "", entries: [...found].sort((first, second) => at(second) - at(first) || compare(titleOf(first), titleOf(second))) },
    ];
  }
  const key = (entry: LibraryEntry) =>
    sort === "composer" ? [entry.composer ?? "￿", titleOf(entry)] : [titleOf(entry), entry.composer ?? ""];
  const byFolder = new Map<string, LibraryEntry[]>();
  for (const entry of found) byFolder.set(entry.folder, [...(byFolder.get(entry.folder) ?? []), entry]);
  return [...byFolder]
    .sort(([first], [second]) => (first === "" ? -1 : second === "" ? 1 : compare(first, second)))
    .map(([folder, folderEntries]) => ({
      folder,
      entries: folderEntries.sort((first, second) => compare(key(first)[0], key(second)[0]) || compare(key(first)[1], key(second)[1])),
    }));
}
