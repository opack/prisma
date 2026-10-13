/** Écriture d'un morceau au format texte .ymn, pour une largeur donnée en caractères. */
import { writeFrontmatter } from "./frontmatter.ts";
import { layout } from "./layout.ts";
import type { Column, Mark, System, Voice } from "./layout.ts";
import { joinsText } from "./model.ts";
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

/**
 * Range des indications sur des lignes @ : chacune commence à sa colonne. Deux indications
 * voisines sont séparées par deux espaces quand une seule les réunirait en un même texte
 * (voir joinsText), par une seule sinon. Une indication qui ne tient pas passe sur une
 * ligne @ de plus.
 */
function stackLines(items: Item[]): string[] {
  const lines: { text: string[]; end: number; last: string }[] = [];
  for (const m of [...items].sort((a, b) => a.col - b.col)) {
    const fits = (l: { end: number; last: string }) => {
      if (!l.last) return true;
      return m.col >= l.end + (joinsText(l.last, m.text) ? 2 : 1);
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

export function renderSystemText(sys: System, cellAt: (t: number) => number, prefix: number): string[] {
  const head = ("m" + sys.bar).padEnd(prefix - 1) + "|";
  // largeur de chaque case : la largeur de base, ou plus si une indication l'exige
  const widths = sys.anchors.map((ci) => cellAt((sys.columns[ci] as { t: number }).t));
  const anchorCol: number[] = [];
  const columnCol: number[] = []; // colonne de départ de chaque colonne du système
  const line = (pick: (anchorIdx: number) => string, record = false) => {
    let s = "";
    let a = 0;
    for (const c of sys.columns) {
      if (record) columnCol.push(prefix + s.length);
      if (c.kind === "anchor") {
        if (record) anchorCol.push(prefix + s.length);
        s += pick(a).padEnd(widths[a]);
        a++;
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
    return columnCol[m.column!] + t.lastIndexOf("|");
  };
  // lignes @ d'une voix : nuances et textes sur leur ancre ; un soufflet couvre ses cases
  // (son dernier caractère tombe dans la dernière case, en laissant une espace avant la suivante)
  // un soufflet qui part d'une case portant une nuance s'écrit juste après elle : « p <--- »
  const voiceLines = (v: Voice) =>
    stackLines([
      ...v.marks.map((m) => ({ col: anchorCol[m.anchor], text: m.text })),
      ...v.hairpins.map((h) => {
        const before = Math.max(0, ...v.marks.filter((m) => m.anchor === h.fromAnchor).map((m) => m.text.length + 1));
        const col = anchorCol[h.fromAnchor] + before;
        const last = Math.max(col, anchorCol[h.toAnchor] + widths[h.toAnchor] - 2);
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
    // la pédale sur sa propre ligne @, tout en bas
    ...stackLines(sys.pedal.signs.map((p) => ({ col: anchorCol[p.anchor], text: p.text }))),
  ];
}

export function prefixWidth(score: Score): number {
  const longest = Math.max(...score.beats.map((b) => b.bar.length), 1);
  return Math.max(4, longest + 2);
}

/**
 * Largeur des cases qui doivent être élargies : une indication posée sur une case doit y
 * tenir, suivie de deux espaces (une seule réunirait deux textes voisins en un seul).
 * Un soufflet qui part de la même case qu'une nuance demande en plus sa place (« p <- »).
 */
function cellWidths(score: Score, cell: number): (t: number) => number {
  const need = new Map<number, number>();
  const want = (t: number, w: number) => need.set(t, Math.max(need.get(t) ?? cell, w));
  for (const e of score.expressions) {
    const pin = score.hairpins.some((h) => h.hand === e.hand && h.start === e.t);
    want(e.t, e.text.length + (pin ? 3 : 2));
  }
  for (const tm of score.texts) want(tm.t, tm.text.length + 2);
  for (const p of score.pedals) {
    const change = score.pedals.some((q) => q.end === p.start);
    want(p.start, (change ? "*Ped." : "Ped.").length + 1);
    if (!score.pedals.some((q) => q.start === p.end)) want(p.end, 2);
  }
  return (t) => need.get(t) ?? cell;
}

export function writeYmn(score: Score, opts: WriteOptions = {}): string {
  const cell = Number(score.meta.cell ?? DEFAULT_CELL);
  const prefix = prefixWidth(score);
  const cellAt = cellWidths(score, cell);
  const systems = layout(score, {
    width: opts.width ?? DEFAULT_WIDTH,
    prefix,
    cell,
    cellAt,
    beatSep: 1,
    barSep: 2,
    repeatDots: 1,
  });
  const meta = { ...score.meta };
  const ternary = score.beats.filter((b) => b.division === 3).length;
  if (ternary * 2 > score.beats.length) meta.division = 3;
  else delete meta.division;
  if (score.order.length) meta.order = score.order.join(" ");
  const out = writeFrontmatter(meta);
  systems.forEach((s, i) => {
    if (i) out.push("");
    out.push(...renderSystemText(s, cellAt, prefix));
  });
  return out.join("\n") + "\n";
}
