/** Écriture d'un morceau au format texte .ymn, pour une largeur donnée en caractères. */
import { writeFrontmatter } from "./frontmatter.ts";
import { layout, noteText } from "./layout.ts";
import type { Column, Mark, System, SystemRow, Voice } from "./layout.ts";
import { GRACE_MARK, HYPHEN, LYRIC_LINE, firstParts, graceDigits, joinsText, partCount } from "./model.ts";
import type { Score } from "./model.ts";
import { octaveLabel } from "./pitch.ts";

export const DEFAULT_WIDTH = 96;
export const DEFAULT_CELL = 3;

export type WriteOptions = { width?: number };

/**
 * Trait horizontal calqué sur la règle : les barres deviennent des croisements. Double (═)
 * entre deux instruments ; name : le nom de l'instrument qui commence sous ce trait, écrit
 * juste après la colonne de gauche.
 */
function rule(model: string, prefix: number, double = false, name?: string): string {
  const line: string[] = [...model].map((c) => (c === "|" ? (double ? "╪" : "┼") : double ? "═" : "─"));
  if (name) {
    const label = [..." " + name + " "];
    while (line.length < prefix + 1 + label.length + 1) line.push(double ? "═" : "─");
    line.splice(prefix + 1, label.length, ...label);
  }
  return line.join("");
}

/** Texte d'un séparateur : « | », « || », « :|| », « ||: », « :||: » ou, en tête, « |: ». */
export function separatorText(c: Exclude<Column, { kind: "anchor" }>): string {
  if (c.kind === "beatSep") return "|";
  if (c.lead) return "|:"; // la première barre « | » fait partie de la colonne de gauche
  return (c.endRepeat ? ":" : "") + "||" + (c.startRepeat ? ":" : "");
}

type Item = { col: number; text: string };

/** Largeur des petites notes d'une case : chaque rang prend son numéro le plus long, plus « ' ». */
const graceWidth = (digits: number[]) => digits.reduce((w, d) => w + d + GRACE_MARK.length, 0);

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
  // petites notes en tête de case, rang par rang ; le contenu de la case vient après, sur
  // toutes les lignes, pour que les notes jouées ensemble restent alignées
  const graceW = sys.anchors.map((_, a) => Math.max(...sys.parts.map((p) => graceWidth(p.graceDigits[a]))));
  const cellText = (r: SystemRow, a: number) => {
    const g = sys.parts[r.part].graceDigits[a].map((d, k) => (r.graces[a][k] ? r.graces[a][k] + GRACE_MARK : "").padEnd(d + GRACE_MARK.length)).join("");
    return g.trim() || r.cells[a] ? g.padEnd(graceW[a]) + r.cells[a] : "";
  };
  const rows = (list: SystemRow[]) =>
    list.map((r) => ((r.showOctave ? octaveLabel(r.octave) : "").padEnd(prefix - 1) + "|" + line((a) => cellText(r, a))).trimEnd());
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
      // liaison : « ( » sur la case de la première note (après une nuance de la même case),
      // « ) » dans celle de la dernière ; coupée, elle va jusqu'au bout du système. Les suites
      // de liaisons commencées plus tôt s'écrivent de haut en bas dans l'ordre de leur début
      // (v.slurs est trié ainsi), comme le relit le lecteur
      ...v.slurs.map((s) => {
        const before = s.opens ? Math.max(0, ...v.marks.filter((m) => m.anchor === s.fromAnchor).map((m) => m.text.length + 1)) : 0;
        const col = anchorCol[s.fromAnchor] + before;
        const last = s.closes ? Math.max(col + 1, anchorCol[s.toAnchor] + 1) : anchorCol[s.toAnchor] + widths[s.toAnchor] - 2;
        return { col, text: (s.opens ? "(" : "-") + "-".repeat(Math.max(0, last - col - 1)) + (s.closes ? ")" : "-") };
      }),
    ]);
  // paroles : une ligne @l par couplet, chaque syllabe sur sa case (« lu- » si le mot
  // continue) ; une prolongation part juste après sa syllabe, ou du début du système
  // pour une syllabe commencée plus tôt, et finit dans sa dernière case comme un soufflet
  const lyricLines = (v: Voice) =>
    v.lyrics.map((l) => {
      const items = [
        ...l.syllables.map((x) => ({ col: anchorCol[x.anchor], text: x.text + (x.hyphen ? HYPHEN : "") })),
        ...l.extenders.map((e) => {
          const syl = e.opens ? l.syllables.find((x) => x.anchor === e.fromAnchor) : undefined;
          const col = anchorCol[e.fromAnchor] + (syl ? syl.text.length + 1 : 0);
          const last = Math.max(col, anchorCol[e.toAnchor] + widths[e.toAnchor] - 2);
          return { col, text: "-".repeat(last - col + 1) };
        }),
      ].sort((a, b) => a.col - b.col);
      return items.reduce((s, x) => s.padEnd(x.col) + x.text, LYRIC_LINE).trimEnd();
    });
  const firsts = firstParts(sys.instruments);
  // accords : une ligne à part, juste au-dessus de la règle, chaque accord sur sa case
  const chordLine = sys.chords.length
    ? [sys.chords.reduce((l, c) => l.padEnd(anchorCol[c.anchor]) + c.text, CHORD_LINE).trimEnd()]
    : [];
  return [
    ...stackLines(sys.marks.map((m) => ({ col: colOf(m), text: m.text }))),
    ...chordLine,
    ruler,
    // chaque partie sous son trait : double au début d'un instrument (avec son nom), simple sinon ;
    // ses lignes de notes, ses paroles, ses nuances, puis sa pédale sur sa propre ligne @
    ...sys.parts.flatMap((p, k) => {
      const first = firsts.indexOf(k);
      return [
        rule(ruler, prefix, first > 0, first >= 0 ? sys.instruments[first].name : undefined),
        ...rows(p.rows),
        ...lyricLines(p.voice),
        ...voiceLines(p.voice),
        ...stackLines([...p.pedal.signs, ...p.pedal.texts].map((x) => ({ col: anchorCol[x.anchor], text: x.text }))),
      ];
    }),
  ];
}

/** Ligne des accords, au-dessus de la règle de comptage (voir ymn-parse). */
const CHORD_LINE = "@c";

/** Largeur de la colonne de gauche : le numéro de mesure le plus long. */
export function prefixWidth(score: Score): number {
  const longest = Math.max(...score.beats.map((b) => b.bar.length), 1);
  return Math.max(4, longest + 2);
}

/**
 * Largeur des cases qui doivent être élargies : une indication posée sur une case doit y
 * tenir, suivie de deux espaces (une seule réunirait deux textes voisins en un seul).
 * Un soufflet qui part de la même case qu'une nuance demande en plus sa place (« p <- »).
 * Les petites notes d'une case s'ajoutent à sa largeur de base.
 */
function cellWidths(score: Score, cell: number): (t: number) => number {
  const need = new Map<number, number>();
  const want = (t: number, w: number) => need.set(t, Math.max(need.get(t) ?? cell, w));
  for (const e of score.expressions) {
    const pin = score.hairpins.some((h) => h.part === e.part && h.start === e.t) || score.slurs.some((s) => s.part === e.part && s.start === e.t);
    want(e.t, e.text.length + (pin ? 3 : 2));
  }
  for (const tm of score.texts) want(tm.t, tm.text.length + 2);
  for (const c of score.chords) want(c.t, c.text.length + 1);
  // une syllabe tient dans sa case, trait d'union compris, suivie d'une espace
  for (const l of score.lyrics) want(l.t, l.text.length + (l.hyphen ? HYPHEN.length : 0) + 1);
  // une trille ou un doigté (« 12~10 », « 12_3 ») élargit sa case, suivie d'une espace
  const trillNeed = new Map<number, number>();
  for (const n of score.notes) {
    if (n.trill === undefined && !n.finger) continue;
    const len = noteText(n).length + 1;
    trillNeed.set(n.start, Math.max(trillNeed.get(n.start) ?? cell, len));
    want(n.start, len);
  }
  for (const g of score.graces) {
    const graces = Math.max(...Array.from({ length: partCount(score.instruments) }, (_, k) => graceWidth(graceDigits(score.graces, k, g.t))));
    want(g.t, graces + (trillNeed.get(g.t) ?? cell));
  }
  for (const p of score.pedalTexts) want(p.t, p.text.length + 2);
  for (const p of score.pedals) {
    const change = score.pedals.some((q) => q.part === p.part && q.end === p.start);
    want(p.start, (change ? "*Ped." : "Ped.").length + 1);
    if (!score.pedals.some((q) => q.part === p.part && q.start === p.end)) want(p.end, 2);
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
  // noms des instruments : déclarés ici, écrits sur le trait de chacun
  if (score.instruments.some((x) => x.name)) meta.parts = score.instruments.map((x) => x.name).join(", ");
  const out = writeFrontmatter(meta);
  systems.forEach((s, i) => {
    if (i) out.push("");
    out.push(...renderSystemText(s, cellAt, prefix));
  });
  return out.join("\n") + "\n";
}
