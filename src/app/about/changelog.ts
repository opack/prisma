/**
 * Les nouveautés (CHANGELOG.md) en versions : chacune avec son numéro (semver), sa date et ses
 * changements en HTML, chaque élément avec ses classes (le Markdown rendu n'a pas d'autre place où
 * les poser). Ne dépend pas du navigateur : les tests le lisent aussi.
 */
import { Marked } from "marked";

/** Une version des nouveautés : son numéro, sa date telle qu'écrite, ses changements. */
export type Release = { version: string; date: string; html: string };

/** Le titre d'une version : « ## 0.3.0 — 5 novembre 2026 ». */
const TITLE = /^## (\d+\.\d+\.\d+) — (.+)$/gm;

const CLASSES: [RegExp, string][] = [
  [/<p>/g, `<p class="my-1">`],
  [/<ul>/g, `<ul class="my-1 pl-5 list-disc grid gap-0.5">`],
  [/<a /g, `<a class="underline" `],
  [/<code>/g, `<code class="font-mono text-[12px] bg-white px-1 py-px rounded-[3px]">`],
];

const marked = new Marked();

/** Les versions, de la plus récente à la plus ancienne, comme dans le fichier ; ce qui précède la première est l'en-tête. */
export function releases(markdown: string): Release[] {
  const titles = [...markdown.matchAll(TITLE)];
  return titles.map((t, i) => {
    const body = markdown.slice(t.index + t[0].length, titles[i + 1]?.index ?? markdown.length);
    const html = CLASSES.reduce((h, [tag, open]) => h.replace(tag, open), marked.parse(body.trim(), { async: false }));
    return { version: t[1], date: t[2].trim(), html };
  });
}

/** Compare deux versions semver (sans étiquette) : négatif si a est plus ancienne que b. */
export function compareVersions(a: string, b: string) {
  const [x, y] = [a, b].map((v) => v.split(".").map(Number));
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return (x[i] ?? 0) - (y[i] ?? 0);
  return 0;
}

/** L'application vient de passer à une version plus récente que celle déjà vue (rien de vu : une première visite, pas une mise à jour). */
export const updatedSince = (seen: string | null, current: string) =>
  !!seen && /^\d+\.\d+\.\d+$/.test(seen) && compareVersions(seen, current) < 0;
