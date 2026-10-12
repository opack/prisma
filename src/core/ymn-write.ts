/** Écriture d'un morceau au format texte .ymn, pour une largeur donnée en caractères. */
import { writeFrontmatter } from "./frontmatter.ts";
import { layout } from "./layout.ts";
import type { Column, Mark, System } from "./layout.ts";
import type { Score } from "./model.ts";
import { octaveLabel } from "./pitch.ts";

export const DEFAULT_WIDTH = 96;
export const DEFAULT_CELL = 3;

export type WriteOptions = { width?: number };

/** Trait horizontal calqué sur la règle : les barres deviennent des croisements. */
const rule = (model: string) => [...model].map((c) => (c === "|" ? "┼" : "─")).join("");

/** Texte d'un séparateur : « | », « || », « :|| », « ||: », « :||: » ou, en tête, « |: ». */
export function separatorText(c: Exclude<Column, { kind: "anchor" }>): string {
  if (c.kind === "beatSep") return "|";
  if (c.lead) return "|:"; // la première barre « | » fait partie de la colonne de gauche
  return (c.endRepeat ? ":" : "") + "||" + (c.startRepeat ? ":" : "");
}

/**
 * Place les indications de la ligne @ : chacune commence sur la colonne de son ancre, ou
 * sur celle de sa barre de mesure pour « [1. » et « ] ».
 * Quand deux indications se chevaucheraient, la seconde passe sur une ligne @ de plus.
 */
function markLines(sys: System, colOf: (m: Mark) => number): string[] {
  const lines: { text: string[]; end: number; last: string }[] = [];
  const marks = [...sys.marks].sort((a, b) => colOf(a) - colOf(b));
  for (const m of marks) {
    const col = colOf(m);
    // au moins une espace entre deux indications, sauf « ][2. » sur une même barre
    const fits = (l: { end: number; last: string }) => l.end < col || (l.end === col && l.last === "]" && m.text.startsWith("["));
    let line = lines.find(fits);
    if (!line) {
      line = { text: [], end: -1, last: "" };
      lines.push(line);
    }
    while (line.text.length < col) line.text.push(" ");
    line.text.push(...m.text);
    line.end = col + m.text.length;
    line.last = m.text;
  }
  return lines.map((l) => ("@" + l.text.join("").slice(1)).trimEnd());
}

export function renderSystemText(sys: System, cell: number, prefix: number): string[] {
  const head = ("m" + sys.bar).padEnd(prefix - 1) + "|";
  const anchorCol: number[] = [];
  const columnCol: number[] = []; // colonne de départ de chaque colonne du système
  const line = (pick: (anchorIdx: number) => string, record = false) => {
    let s = "";
    let a = 0;
    for (const c of sys.columns) {
      if (record) columnCol.push(prefix + s.length);
      if (c.kind === "anchor") {
        if (record) anchorCol.push(prefix + s.length);
        s += pick(a++).padEnd(cell);
      } else s += separatorText(c);
    }
    return s;
  };
  const ruler = head + line((a) => (sys.columns[sys.anchors[a]] as { label: string }).label, true);
  const rows = (list: System["right"]) =>
    list.map((r) => ((r.showOctave ? octaveLabel(r.octave) : "").padEnd(prefix - 1) + "|" + line((a) => r.cells[a])).trimEnd());
  // « ] » sur le premier « | » de sa barre, « [ » sur le dernier ; -1 : barre de gauche du
  // système (le « | » de la colonne de gauche, ou celui de « |: » si le système commence par une reprise)
  const sepText = (ci: number) => separatorText(sys.columns[ci] as Exclude<Column, { kind: "anchor" }>);
  const colOf = (m: Mark) => {
    if (m.anchor !== undefined) return anchorCol[m.anchor];
    if (m.column === -1) return sys.columns[0]?.kind === "barSep" && sys.columns[0].lead ? prefix : prefix - 1;
    const t = sepText(m.column!);
    return columnCol[m.column!] + (m.kind === "endingClose" ? t.indexOf("|") : t.lastIndexOf("|"));
  };
  return [...markLines(sys, colOf), ruler, rule(ruler), ...rows(sys.right), rule(ruler), ...rows(sys.left)];
}

export function prefixWidth(score: Score): number {
  const longest = Math.max(...score.beats.map((b) => b.bar.length), 1);
  return Math.max(4, longest + 2);
}

export function writeYmn(score: Score, opts: WriteOptions = {}): string {
  const cell = Number(score.meta.cell ?? DEFAULT_CELL);
  const prefix = prefixWidth(score);
  const systems = layout(score, {
    width: opts.width ?? DEFAULT_WIDTH,
    prefix,
    cell,
    beatSep: 1,
    barSep: 2,
    repeatDots: 1,
  });
  const meta = { ...score.meta };
  const ternary = score.beats.filter((b) => b.division === 3).length;
  if (ternary * 2 > score.beats.length) meta.division = 3;
  else delete meta.division;
  const out = writeFrontmatter(meta);
  systems.forEach((s, i) => {
    if (i) out.push("");
    out.push(...renderSystemText(s, cell, prefix));
  });
  return out.join("\n") + "\n";
}
