/** Écriture d'un morceau au format texte .ymn, pour une largeur donnée en caractères. */
import { writeFrontmatter } from "./frontmatter.ts";
import { layout } from "./layout.ts";
import type { System } from "./layout.ts";
import type { Score } from "./model.ts";

export const DEFAULT_WIDTH = 96;
export const DEFAULT_CELL = 3;

export type WriteOptions = { width?: number };

/** Trait horizontal calqué sur la règle : les barres deviennent des croisements. */
const rule = (model: string) => [...model].map((c) => (c === "|" ? "┼" : "─")).join("");

export function renderSystemText(sys: System, cell: number, prefix: number): string[] {
  const head = ("m" + sys.bar).padEnd(prefix - 1) + "|";
  const line = (pick: (anchorIdx: number) => string) => {
    let s = "";
    let a = 0;
    for (const c of sys.columns) {
      if (c.kind === "anchor") s += pick(a++).padEnd(cell);
      else s += c.kind === "barSep" ? "||" : "|";
    }
    return s;
  };
  const ruler = head + line((a) => (sys.columns[sys.anchors[a]] as { label: string }).label);
  const rows = (list: System["right"]) =>
    list.map((r) => ((r.showOctave ? String(r.octave) : "").padEnd(prefix - 1) + "|" + line((a) => r.cells[a])).trimEnd());
  return [ruler, rule(ruler), ...rows(sys.right), rule(ruler), ...rows(sys.left)];
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
