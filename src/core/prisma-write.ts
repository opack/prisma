/** Écriture d'un morceau au format texte .prisma, pour une largeur donnée en caractères. */
import { writeFrontmatter } from "./frontmatter.ts";
import { layout, noteText } from "./layout.ts";
import type { Column, Mark, System, SystemRow, Voice } from "./layout.ts";
import {
  ARTICULATION_SIGNS,
  EFFECT_SIGNS,
  GRACE_MARK,
  HYPHEN,
  LYRIC_LINE,
  firstStaves,
  graceDigits,
  joinsText,
  staffCount,
} from "./model.ts";
import type { Score } from "./model.ts";
import { octaveLabel } from "./pitch.ts";

export const DEFAULT_WIDTH = 96;
export const DEFAULT_CELL = 3;

export type WriteOptions = { width?: number };

/**
 * Trait horizontal calqué sur la règle : les barres deviennent des croisements. Double (═)
 * entre deux parties ; name : le nom de la partie qui commence sous ce trait, écrit
 * juste après la colonne de gauche.
 */
function rule(model: string, prefix: number, double = false, name?: string): string {
  const line: string[] = [...model].map((cell) => (cell === "|" ? (double ? "╪" : "┼") : double ? "═" : "─"));
  if (name) {
    const label = [...(" " + name + " ")];
    while (line.length < prefix + 1 + label.length + 1) line.push(double ? "═" : "─");
    line.splice(prefix + 1, label.length, ...label);
    // un morceau de trait après le nom, même quand un croisement tombe juste là
    const after = prefix + 1 + label.length;
    if (line[after] !== (double ? "═" : "─")) line.splice(after, 0, double ? "═" : "─");
  }
  return line.join("");
}

/** Texte d'un séparateur : « | », « || », « :|| », « ||: », « :||: » ou, en tête, « |: ». */
export function separatorText(separator: Exclude<Column, { kind: "anchor" }>): string {
  if (separator.kind === "beatSep") return "|";
  if (separator.lead) return "|:"; // la première barre « | » fait partie de la colonne de gauche
  return (separator.endRepeat ? ":" : "") + "||" + (separator.startRepeat ? ":" : "");
}

/** t : l'instant d'un texte, qui déborde sur les cases suivantes (absent pour un signe). */
type Item = { col: number; text: string; t?: number };

/** Largeur des petites notes d'une case : chaque rang prend son numéro le plus long, plus « ' ». */
const graceWidth = (digits: number[]) => digits.reduce((total, digitCount) => total + digitCount + GRACE_MARK.length, 0);

/**
 * Range des indications sur des lignes @ : chacune commence à sa colonne. Deux indications
 * voisines sont séparées par deux espaces quand une seule les réunirait en un même texte
 * (voir joinsText), par une seule sinon. Une indication qui ne tient pas passe sur une
 * ligne @ de plus ; si c'est un texte qui l'en empêche sur la première, `collide` reçoit
 * l'instant de ce texte, pour élargir sa case.
 */
function stackLines(items: Item[], collide?: (t: number) => void): string[] {
  const lines: { text: string[]; end: number; last: string; t?: number }[] = [];
  for (const item of [...items].sort((first, second) => first.col - second.col)) {
    const fits = (candidate: { end: number; last: string }) => {
      if (!candidate.last) return true;
      return item.col >= candidate.end + (joinsText(candidate.last, item.text) ? 2 : 1);
    };
    if (lines[0] && !fits(lines[0]) && lines[0].t !== undefined) collide?.(lines[0].t);
    let line = lines.find(fits);
    if (!line) {
      line = { text: [], end: -1, last: "" };
      lines.push(line);
    }
    while (line.text.length < item.col) line.text.push(" ");
    line.text.push(...item.text);
    line.end = item.col + item.text.length;
    line.last = item.text;
    line.t = item.t;
  }
  return lines.map((stacked) => ("@" + stacked.text.join("").slice(1)).trimEnd());
}

export function renderSystemText(sys: System, cellAt: (t: number) => number, prefix: number, collide?: (t: number) => void): string[] {
  const head = ("m" + sys.bar).padEnd(prefix - 1) + "|";
  // largeur de chaque case : la largeur de base, ou plus si une indication l'exige
  const tickAt = (anchor: number) => (sys.columns[sys.anchors[anchor]] as { t: number }).t;
  const widths = sys.anchors.map((_, anchor) => cellAt(tickAt(anchor)));
  const anchorCol: number[] = [];
  const columnCol: number[] = []; // colonne de départ de chaque colonne du système
  const line = (pick: (anchorIdx: number) => string, record = false) => {
    let text = "";
    let anchor = 0;
    for (const column of sys.columns) {
      if (record) columnCol.push(prefix + text.length);
      if (column.kind === "anchor") {
        if (record) anchorCol.push(prefix + text.length);
        text += pick(anchor).padEnd(widths[anchor]);
        anchor++;
      } else text += separatorText(column);
    }
    return text;
  };
  const ruler = head + line((anchor) => (sys.columns[sys.anchors[anchor]] as { label: string }).label, true);
  // petites notes en tête de case, rang par rang ; le contenu de la case vient après, sur
  // toutes les lignes, pour que les notes jouées ensemble restent alignées
  const graceW = sys.anchors.map((_, anchor) => Math.max(...sys.staves.map((systemStaff) => graceWidth(systemStaff.graceDigits[anchor]))));
  const cellText = (systemRow: SystemRow, anchor: number) => {
    const graces = sys.staves[systemRow.staff].graceDigits[anchor]
      .map((width, rank) =>
        (systemRow.graces[anchor][rank] ? systemRow.graces[anchor][rank] + GRACE_MARK : "").padEnd(width + GRACE_MARK.length),
      )
      .join("");
    return graces.trim() || systemRow.cells[anchor] ? graces.padEnd(graceW[anchor]) + systemRow.cells[anchor] : "";
  };
  const rows = (list: SystemRow[]) =>
    list.map((systemRow) =>
      (
        (systemRow.string !== undefined ? String(systemRow.string) : systemRow.showOctave ? octaveLabel(systemRow.octave) : "").padEnd(
          prefix - 1,
        ) +
        "|" +
        line((anchor) => cellText(systemRow, anchor))
      ).trimEnd(),
    );
  // « ] » sur le premier « | » de sa barre, « [ » sur le dernier ; -1 : barre de gauche du
  // système (le « | » de la colonne de gauche, ou celui de « |: » si le système commence par une reprise)
  const sepText = (ci: number) => separatorText(sys.columns[ci] as Exclude<Column, { kind: "anchor" }>);
  const colOf = (mark: Mark) => {
    if (mark.anchor !== undefined) return anchorCol[mark.anchor];
    if (mark.column === -1) return sys.columns[0]?.kind === "barSep" && sys.columns[0].lead ? prefix : prefix - 1;
    const text = sepText(mark.column!);
    return columnCol[mark.column!] + text.lastIndexOf("|");
  };
  // lignes @ d'une voix : nuances et textes sur leur ancre ; un soufflet couvre ses cases
  // (son dernier caractère tombe dans la dernière case, en laissant une espace avant la suivante)
  // un soufflet qui part d'une case portant une nuance s'écrit juste après elle : « p <--- »
  // lignes @ d'une portée, rangées par famille dans l'ordre de la gravure : le phrasé
  // (liaisons), puis l'expression (nuances, soufflets, textes, arpèges) ; une famille
  // n'occupe une ligne que si elle a quelque chose dans ce système
  const expressionLines = (voice: Voice) =>
    stackLines(
      [
        // deux articulations d'une même case se suivent sur la même ligne : « . ! »
        ...voice.marks.map((voiceMark, index) => {
          const before =
            voiceMark.kind === "articulation"
              ? voice.marks.slice(0, index).filter((other) => other.kind === "articulation" && other.anchor === voiceMark.anchor)
              : [];
          return {
            col: anchorCol[voiceMark.anchor] + before.reduce((total, other) => total + other.text.length + 1, 0),
            text: voiceMark.text,
            ...(voiceMark.kind === "text" ? { t: tickAt(voiceMark.anchor) } : {}),
          };
        }),
        ...voice.hairpins.map((hairpinSpan) => {
          const before = Math.max(
            0,
            ...voice.marks.filter((voiceMark) => voiceMark.anchor === hairpinSpan.fromAnchor).map((voiceMark) => voiceMark.text.length + 1),
          );
          const col = anchorCol[hairpinSpan.fromAnchor] + before;
          const last = Math.max(col, anchorCol[hairpinSpan.toAnchor] + widths[hairpinSpan.toAnchor] - 2);
          return { col, text: hairpinSpan.kind + "-".repeat(last - col) };
        }),
        // l'étouffé et le vibrato, comme un soufflet : « P.M.--- », « ~~~~ »
        ...voice.effects.map((effectSpan) => {
          const before = Math.max(
            0,
            ...voice.marks.filter((voiceMark) => voiceMark.anchor === effectSpan.fromAnchor).map((voiceMark) => voiceMark.text.length + 1),
          );
          const col = anchorCol[effectSpan.fromAnchor] + before;
          const last = Math.max(col, anchorCol[effectSpan.toAnchor] + widths[effectSpan.toAnchor] - 2);
          const sign = EFFECT_SIGNS[effectSpan.kind];
          return {
            col,
            text:
              effectSpan.kind === "palmMute" ? sign + "-".repeat(Math.max(0, last - col + 1 - sign.length)) : sign.repeat(last - col + 1),
          };
        }),
      ],
      collide,
    );
  // liaison : « ( » sur la case de la première note, « ) » dans celle de la dernière ;
  // coupée, elle va jusqu'au bout du système. Les suites de liaisons commencées plus tôt
  // s'écrivent de haut en bas dans l'ordre de leur début (v.slurs est trié ainsi), comme
  // le relit le lecteur
  const phrasingLines = (voice: Voice) =>
    stackLines(
      voice.slurs.map((slurSpan) => {
        const col = anchorCol[slurSpan.fromAnchor];
        const last = slurSpan.closes
          ? Math.max(col + 1, anchorCol[slurSpan.toAnchor] + 1)
          : anchorCol[slurSpan.toAnchor] + widths[slurSpan.toAnchor] - 2;
        return { col, text: (slurSpan.opens ? "(" : "-") + "-".repeat(Math.max(0, last - col - 1)) + (slurSpan.closes ? ")" : "-") };
      }),
    );
  // paroles : une ligne @l par couplet, chaque syllabe sur sa case (« lu- » si le mot
  // continue) ; une prolongation part juste après sa syllabe, ou du début du système
  // pour une syllabe commencée plus tôt, et finit dans sa dernière case comme un soufflet
  const lyricLines = (voice: Voice) =>
    voice.lyrics.map((lyricLine) => {
      const items = [
        ...lyricLine.syllables.map((syllable) => ({
          col: anchorCol[syllable.anchor],
          text: syllable.text + (syllable.hyphen ? HYPHEN : ""),
        })),
        ...lyricLine.extenders.map((extender) => {
          const syl = extender.opens ? lyricLine.syllables.find((syllable) => syllable.anchor === extender.fromAnchor) : undefined;
          const col = anchorCol[extender.fromAnchor] + (syl ? syl.text.length + 1 : 0);
          const last = Math.max(col, anchorCol[extender.toAnchor] + widths[extender.toAnchor] - 2);
          return { col, text: "-".repeat(last - col + 1) };
        }),
      ].sort((first, second) => first.col - second.col);
      return items.reduce((text, item) => text.padEnd(item.col) + item.text, LYRIC_LINE).trimEnd();
    });
  const firsts = firstStaves(sys.parts);
  // accords : une ligne à part, juste au-dessus de la règle, chaque accord sur sa case
  const chordLine = sys.chords.length
    ? [sys.chords.reduce((written, chord) => written.padEnd(anchorCol[chord.anchor]) + chord.text, CHORD_LINE).trimEnd()]
    : [];
  return [
    ...stackLines(
      sys.marks.map((mark) => ({
        col: colOf(mark),
        text: mark.text,
        ...(mark.kind === "text" && mark.anchor !== undefined ? { t: tickAt(mark.anchor) } : {}),
      })),
      collide,
    ),
    ...chordLine,
    ruler,
    // chaque portée sous son trait : double au début d'une partie (avec son nom), simple sinon ;
    // ses lignes de notes, ses paroles, ses nuances, puis sa pédale sur sa propre ligne @
    ...sys.staves.flatMap((systemStaff, staffIndex) => {
      const first = firsts.indexOf(staffIndex);
      return [
        rule(ruler, prefix, first > 0, first >= 0 ? sys.parts[first].name : undefined),
        ...rows(systemStaff.rows),
        ...phrasingLines(systemStaff.voice),
        ...lyricLines(systemStaff.voice),
        ...expressionLines(systemStaff.voice),
        ...stackLines(
          [
            ...systemStaff.pedal.signs.map((x): Item => ({ col: anchorCol[x.anchor], text: x.text })),
            ...systemStaff.pedal.texts.map((x): Item => ({ col: anchorCol[x.anchor], text: x.text, t: tickAt(x.anchor) })),
          ],
          collide,
        ),
      ];
    }),
  ];
}

/** Ligne des accords, au-dessus de la règle de comptage (voir prisma-parse). */
const CHORD_LINE = "@c";

/** Largeur de la colonne de gauche : le numéro de mesure le plus long. */
export function prefixWidth(score: Score): number {
  const longest = Math.max(...score.beats.map((beat) => beat.bar.length), 1);
  return Math.max(4, longest + 2);
}

/**
 * Largeur des cases qui doivent être élargies : un signe posé sur une case doit y tenir, suivi
 * de deux espaces (une seule réunirait deux textes voisins en un seul). Un texte, lui, déborde
 * sur les cases suivantes ; sa case ne s'élargit (instants `widen`) que s'il buterait sinon sur
 * l'indication suivante de sa ligne.
 * Un soufflet qui part de la même case qu'une nuance demande en plus sa place (« p <- »).
 * Les petites notes d'une case s'ajoutent à sa largeur de base.
 */
function cellWidths(score: Score, cell: number, widen: Set<number> = new Set()): (t: number) => number {
  const need = new Map<number, number>();
  const want = (tick: number, width: number) => need.set(tick, Math.max(need.get(tick) ?? cell, width));
  // un texte (« dolce », « rit. ») déborde sur les cases suivantes : sa longueur ne compte pas, il
  // vaut pour l'instant de sa case ; seule une nuance, signe court, doit tenir dans la sienne
  for (const expression of score.expressions) {
    if (expression.kind !== "dynamic") {
      if (widen.has(expression.t)) want(expression.t, expression.text.length + 2);
      continue;
    }
    const pin = score.hairpins.some((hairpin) => hairpin.staff === expression.staff && hairpin.start === expression.t);
    want(expression.t, expression.text.length + (pin ? 3 : 2));
  }
  // une articulation, suivie d'une espace (deux signes d'une même case : « . ! »)
  for (const tick of new Set(score.articulations.map((articulation) => articulation.t))) {
    const here = score.articulations.filter((articulation) => articulation.t === tick);
    want(
      tick,
      here.reduce((total, articulation) => total + ARTICULATION_SIGNS[articulation.kind].length + 1, 0),
    );
  }
  for (const textMark of score.chords) want(textMark.t, textMark.text.length + 1);
  // l'étouffé de la paume commence par « P.M. », qui tient dans sa case
  for (const effect of score.effects) if (effect.kind === "palmMute") want(effect.start, EFFECT_SIGNS.palmMute.length + 1);
  // une syllabe tient dans sa case, trait d'union compris, suivie d'une espace
  for (const lyric of score.lyrics) want(lyric.t, lyric.text.length + (lyric.hyphen ? HYPHEN.length : 0) + 1);
  // une trille ou un doigté (« 12~10 », « 12_3 ») élargit sa case, suivie d'une espace
  const trillNeed = new Map<number, number>();
  for (const note of score.notes) {
    if (
      note.trill === undefined &&
      !note.finger &&
      !note.harmonic &&
      !note.slide &&
      !note.slideOut &&
      !note.slideIn &&
      note.bend === undefined
    )
      continue;
    const len = noteText(note, score.parts).length + 1;
    trillNeed.set(note.start, Math.max(trillNeed.get(note.start) ?? cell, len));
    want(note.start, len);
  }
  for (const grace of score.graces) {
    const graces = Math.max(
      ...Array.from({ length: staffCount(score.parts) }, (_, staff) => graceWidth(graceDigits(score.graces, staff, grace.t, score.parts))),
    );
    want(grace.t, graces + (trillNeed.get(grace.t) ?? cell));
  }
  for (const text of score.texts) if (widen.has(text.t)) want(text.t, text.text.length + 2);
  for (const pedalText of score.pedalTexts) if (widen.has(pedalText.t)) want(pedalText.t, pedalText.text.length + 2);
  for (const written of score.pedals) {
    const change = score.pedals.some((pedal) => pedal.staff === written.staff && pedal.end === written.start);
    want(written.start, (change ? "*Ped." : "Ped.").length + 1);
    if (!score.pedals.some((pedal) => pedal.staff === written.staff && pedal.start === written.end)) want(written.end, 2);
  }
  return (tick) => need.get(tick) ?? cell;
}

export function writePrisma(score: Score, opts: WriteOptions = {}): string {
  const cell = Number(score.meta.cell ?? DEFAULT_CELL);
  const prefix = prefixWidth(score);
  // un texte déborde sur les cases suivantes ; s'il bute sur l'indication qui le suit, sa case
  // s'élargit et l'on recompose (élargir peut en faire buter un autre : quelques passes au plus)
  const widen = new Set<number>();
  let cellAt = cellWidths(score, cell, widen);
  const compose = () => layout(score, { width: opts.width ?? DEFAULT_WIDTH, prefix, cell, cellAt, beatSep: 1, barSep: 2, repeatDots: 1 });
  let systems = compose();
  for (let pass = 0; pass < 4; pass++) {
    const before = widen.size;
    for (const system of systems) renderSystemText(system, cellAt, prefix, (tick) => widen.add(tick));
    if (widen.size === before) break;
    cellAt = cellWidths(score, cell, widen);
    systems = compose();
  }
  const meta = { ...score.meta };
  const ternary = score.beats.filter((beat) => beat.division === 3).length;
  if (ternary * 2 > score.beats.length) meta.division = 3;
  else delete meta.division;
  if (score.order.length) meta.order = score.order.join(" ");
  // noms des parties : déclarés ici, avec l'instrument qui les joue s'il est écrit, et sur le trait de chacune
  // et pour un instrument à cordes, son accordage (hors accordage standard) et son capo
  const extras = (x: Score["parts"][number]) =>
    [
      x.instrument,
      x.strings && x.strings.tuning !== "standard" ? x.strings.tuning : undefined,
      x.strings?.capo ? `capo ${x.strings.capo}` : undefined,
    ].filter(Boolean);
  if (score.parts.some((part) => part.name))
    meta.parts = score.parts.map((part) => (extras(part).length ? `${part.name} (${extras(part).join(", ")})` : part.name)).join(", ");
  const out = writeFrontmatter(meta);
  systems.forEach((system, index) => {
    if (index) out.push("");
    out.push(...renderSystemText(system, cellAt, prefix));
  });
  return out.join("\n") + "\n";
}
