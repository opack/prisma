/** Écriture d'un morceau au format texte .ymn, pour une largeur donnée en caractères. */
import { writeFrontmatter } from "./frontmatter.ts";
import { layout } from "./layout.ts";
import type { Column, Mark, System, Voice } from "./layout.ts";
import { isHairpin } from "./model.ts";
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

type Item = { col: number; text: string };

/** Indication toujours lue à part, même à une espace de sa voisine. */
const solid = (t: string) => t.startsWith("[") || t === "]" || isHairpin(t);

/**
 * Range des indications sur des lignes @ : chacune commence à sa colonne. Deux textes
 * voisins sont séparés par au moins deux espaces (une seule les réunirait en un même
 * texte), une espace suffit à côté d'un signe de case ou d'un soufflet, et « ][2. »
 * s'écrivent collés sur une même barre. Sinon, l'indication passe sur une ligne de plus.
 */
function stackLines(items: Item[]): string[] {
  const lines: { text: string[]; end: number; last: string }[] = [];
  for (const m of [...items].sort((a, b) => a.col - b.col)) {
    const fits = (l: { end: number; last: string }) => {
      if (!l.last) return true;
      if (l.end === m.col) return l.last === "]" && m.text.startsWith("[");
      return m.col >= l.end + (solid(l.last) || solid(m.text) ? 1 : 2);
    };
    let line = lines.find(fits);
    if (!line) {
      line = { text: [], end: -1, last: "" };
      lines.push(line);
    }
    while (line.text.length < m.col) line.text.push(" ");
    line.text.push(...m.text);
    line.end = m.col + m.text.length;
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
  // lignes @ d'une voix : nuances et textes sur leur ancre ; un soufflet couvre ses cases
  // (son dernier caractère tombe dans la dernière case, en laissant une espace avant la suivante)
  const voiceLines = (v: Voice) =>
    stackLines([
      ...v.marks.map((m) => ({ col: anchorCol[m.anchor], text: m.text })),
      ...v.hairpins.map((h) => {
        const col = anchorCol[h.fromAnchor];
        const last = Math.max(col, anchorCol[h.toAnchor] + cell - 2);
        return { col, text: h.kind + "-".repeat(last - col) };
      }),
    ]);
  return [
    ...stackLines(sys.marks.map((m) => ({ col: colOf(m), text: m.text }))),
    ruler,
    rule(ruler),
    ...rows(sys.right),
    ...voiceLines(sys.voices.D),
    rule(ruler),
    ...rows(sys.left),
    ...voiceLines(sys.voices.G),
  ];
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
