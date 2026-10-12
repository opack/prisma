/** Écriture d'un morceau au format texte .ymn, pour une largeur donnée en caractères. */
import { writeFrontmatter } from "./frontmatter.ts";
import { layout } from "./layout.ts";
import type { Column, System } from "./layout.ts";
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
 * Place les indications de la ligne @ : chacune commence sur la colonne de son ancre.
 * Quand deux indications se chevaucheraient, la seconde passe sur une ligne @ de plus.
 */
function markLines(sys: System, anchorCol: number[], prefix: number): string[] {
  const lines: { text: string[]; end: number }[] = [];
  for (const m of sys.marks) {
    const col = anchorCol[m.anchor];
    let line = lines.find((l) => l.end < col); // au moins une espace entre deux indications
    if (!line) {
      line = { text: [], end: -1 };
      lines.push(line);
    }
    while (line.text.length < col) line.text.push(" ");
    line.text.push(...m.text);
    line.end = col + m.text.length;
  }
  return lines.map((l) => ("@".padEnd(prefix) + l.text.join("").slice(prefix)).trimEnd());
}

export function renderSystemText(sys: System, cell: number, prefix: number): string[] {
  const head = ("m" + sys.bar).padEnd(prefix - 1) + "|";
  const anchorCol: number[] = [];
  const line = (pick: (anchorIdx: number) => string, record = false) => {
    let s = "";
    let a = 0;
    for (const c of sys.columns) {
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
  return [...markLines(sys, anchorCol, prefix), ruler, rule(ruler), ...rows(sys.right), rule(ruler), ...rows(sys.left)];
}

export function prefixWidth(score: Score): number {
  const longest = Math.max(...score.beats.map((b) => b.bar.length), 1);
  return Math.max(4, longest + 2);
}

export function writeYmn(score: Score, opts: WriteOptions = {}): string {
  const cell = Number(score.meta.case ?? DEFAULT_CELL);
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
