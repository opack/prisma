/**
 * Les modèles de Fichier › Nouveau : de quoi commencer un morceau sans écrire l'en-tête ni la
 * première mesure. Le curseur se place dans la première case.
 */
export type Template = { id: string; label: string; hint: string; text: string };

export const TEMPLATES: Template[] = [
  { id: "empty", label: "Vide", hint: "rien : vous écrivez tout, en-tête compris", text: "" },
  {
    id: "piano",
    label: "Piano",
    hint: "l'en-tête habituel et une mesure vide, sur deux portées : la main droite, la main gauche",
    text: `---
format: 1
title: Nouveau morceau
parts: Piano
bpm: 90
---

m1 |1  |2  |3  |4  ||
───┼─ Piano ───┼───┼┼
0  |   |   |   |   ||
───┼───┼───┼───┼───┼┼
-1 |   |   |   |   ||
`,
  },
  {
    id: "guitar",
    label: "Guitare",
    hint: "l'en-tête habituel et une mesure vide, une ligne par corde, comme une tablature",
    text: `---
format: 1
title: Nouveau morceau
parts: Guitare
bpm: 90
---

m1 |1  |2  |3  |4  ||
───┼─ Guitare ─┼───┼┼
1  |   |   |   |   ||
2  |   |   |   |   ||
3  |   |   |   |   ||
4  |   |   |   |   ||
5  |   |   |   |   ||
6  |   |   |   |   ||
`,
  },
];

/** La première case à remplir d'un modèle : sa ligne et sa colonne, à partir de 1. */
export function firstCell(text: string): { line: number; column: number } | undefined {
  const lines = text.split("\n");
  const ruler = lines.findIndex((l) => /^m\d/.test(l));
  if (ruler < 0) return undefined;
  for (let k = ruler + 1; k < lines.length; k++) if (/^[-+]?\d+\s*\|/.test(lines[k])) return { line: k + 1, column: lines[k].indexOf("|") + 2 };
  return undefined;
}
