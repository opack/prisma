/**
 * Lecture du format texte .prisma vers le modèle.
 *
 * Les sauts de ligne sont libres : le temps absolu est reconstitué à partir des règles
 * de comptage. Voir FORMAT.md pour la grammaire complète.
 */
import { chordNotes } from "./chords.ts";
import { gridStrings, parseShape, shapePitches, splitShape } from "./shapes.ts";
import { PrismaError, parseFrontmatter } from "./frontmatter.ts";
import {
  ARPEGGIO_DOWN,
  BEND_MARK,
  DEAD_MARK,
  FERMATA,
  HARMONICS,
  MAX_BEND,
  RELEASE_MARK,
  SLIDE_MARKS,
  slideText,
  stringCell,
  articulationOf,
  effectOf,
  isEffect,
  isPick,
  isArticulationSign,
  HYPHEN,
  LYRIC_LINE,
  isExtender,
  sortLyrics,
  FINGER_MARK,
  GRACE_MARK,
  TRILL_MARK,
  isArpeggioSign,
  trillAux,
  MARKER_SIGN,
  PEDAL_CHANGE,
  PEDAL_DOWN,
  PEDAL_UP,
  TICKS_PER_BEAT,
  isDynamic,
  isHairpin,
  isPedalSign,
  isSlur,
  isPedalText,
  joinsText,
  sortArticulations,
  sortGraces,
  sortNotes,
  stringsOfStaff,
} from "./model.ts";
import type {
  Arpeggio,
  Articulation,
  Beat,
  Division,
  Effect,
  Expression,
  Grace,
  Hairpin,
  Part,
  Lyric,
  Marker,
  Note,
  Staff,
  Pedal,
  PedalText,
  Repeat,
  Score,
  Slur,
  TextMark,
} from "./model.ts";
import { CENTRAL_OCTAVE, midiOf, parseOctaveLabel } from "./pitch.ts";
import { INSTRUMENTS, guessInstrument, isInstrument, splitPartEntry, splitParts } from "./instruments.ts";
import { MAX_CAPO, MAX_FRET, isStringInstrument, soundingOf, stringsOf, tuningsOf } from "./strings.ts";
import type { Strings } from "./strings.ts";
import type { InstrumentName } from "./instruments.ts";

/** Un temps de la règle de comptage, et la barre qui le termine. */
type Segment = { from: number; to: number; barEnd: boolean; endRepeat: boolean; startRepeatAfter: boolean };
/** Plage de colonnes occupée par un séparateur (« | », « :|| »…). */
type SepSpan = { from: number; to: number; text: string };

/**
 * Trait entre deux portées : simple (« ─── », « --- ») entre deux portées d'une partie,
 * double (« ═══ », « === ») entre deux parties. Le trait au-dessus de la première portée
 * d'une partie porte son nom, entouré d'espaces : « ═══╪═ Piano ═══╪═══ ».
 */
type Rule = { double: boolean; name?: string };
const RULE_CHARS = /^[─━\-=═+┼╪|]+$/;
const HORIZONTAL = /[─━\-=═]/;
export function parseRule(line: string, lineNo: number): Rule | undefined {
  const text = line.trim();
  let body = text;
  let name: string | undefined;
  if (!RULE_CHARS.test(text)) {
    // le nom, n'importe où sur le trait, entre des espaces (une ou plusieurs)
    const match = text.match(/^([─━\-=═+┼╪|]+) +(\S.*?\S|\S) +([─━\-=═+┼╪|]+)$/);
    if (!match || !HORIZONTAL.test(match[1]) || !HORIZONTAL.test(match[3]) || !/\p{L}/u.test(match[2])) return undefined;
    body = match[1] + match[3];
    name = match[2];
  }
  if (text.length < 3 || !HORIZONTAL.test(body)) return undefined;
  const double = /[═=╪]/.test(body);
  if (double && /[─━-]/.test(body))
    throw new PrismaError("trait mélangé : simple (─) entre deux portées d'une partie, double (═) entre deux parties", lineNo, 1);
  return { double, ...(name ? { name } : {}) };
}
export const isRuler = (line: string) => /^m[^|\s]*\s*\|/.test(line);
const isMarkLine = (line: string) => line.startsWith("@");
/** Ligne des accords : « @c », puis chaque accord sur sa case. */
export const CHORD_LINE = "@c";
const isChordLine = (line: string) => line === CHORD_LINE || line.startsWith(CHORD_LINE + " ");
/** Ligne des paroles d'un couplet, sous les lignes de sa portée. */
const isLyricLine = (line: string) => line === LYRIC_LINE || line.startsWith(LYRIC_LINE + " ");

const SEPARATORS = new Set(["|", "||", ":||", "||:", ":||:"]);
const SUB_LABELS = new Set(["*", ".", ","]);

/** Découpe une règle de comptage en temps et en séparateurs. */
function parseRuler(ruler: string, lineNo: number, pipe: number) {
  const seps: { from: number; text: string }[] = [];
  let index = pipe;
  while (index < ruler.length) {
    if (ruler[index] === "|" || (ruler[index] === ":" && ruler[index + 1] === "|")) {
      let innerIndex = index;
      while (innerIndex < ruler.length && (ruler[innerIndex] === "|" || ruler[innerIndex] === ":")) innerIndex++;
      seps.push({ from: index, text: ruler.slice(index, innerIndex) });
      index = innerIndex;
    } else index++;
  }
  const trailing = ruler.slice(seps[seps.length - 1].from + seps[seps.length - 1].text.length);
  if (trailing.trim())
    throw new PrismaError(
      "la règle de comptage doit se terminer par une barre (« | », « || » ou « :|| »)",
      lineNo,
      ruler.length - trailing.length + 1,
    );

  // la première barre fait partie de la colonne de gauche : « | » ou « ||: »
  const lead = seps[0].text;
  if (lead !== "|" && lead !== "||:")
    throw new PrismaError(`début de règle invalide « ${lead} » : attendu « | » ou « ||: »`, lineNo, pipe + 1);
  for (const separator of seps.slice(1)) {
    if (!SEPARATORS.has(separator.text))
      throw new PrismaError(`barre invalide « ${separator.text} » : attendu |, ||, :||, ||: ou :||:`, lineNo, separator.from + 1);
  }
  const segs: Segment[] = [];
  for (let separatorIndex = 0; separatorIndex + 1 < seps.length; separatorIndex++) {
    const from = seps[separatorIndex].from + seps[separatorIndex].text.length;
    const to = seps[separatorIndex + 1].from;
    const text = seps[separatorIndex + 1].text;
    segs.push({ from, to, barEnd: text !== "|", endRepeat: text.startsWith(":"), startRepeatAfter: text.endsWith(":") });
  }
  if (!segs.length) throw new PrismaError("règle de comptage sans aucun temps", lineNo);
  const spans: SepSpan[] = seps.map((separator) => ({
    from: separator.from,
    to: separator.from + separator.text.length,
    text: separator.text,
  }));
  return { segs, spans, leadRepeat: lead === "||:" };
}

const nextBar = (bar: string) => (/^\d+$/.test(bar) ? String(Number(bar) + 1) : bar + "'");

/**
 * Indications d'une ligne @ : groupes de mots séparés par au moins deux espaces. Deux mots
 * à une seule espace forment un seul texte (« a tempo », « più f ») ; les signes (soufflets
 * « <--- », signes de pédale, débuts de section « [A] ») restent à part (voir joinsText).
 */
export function markTokens(line: string) {
  const out: { col: number; text: string }[] = [];
  const body = " " + line.slice(1); // seul le « @ » est retiré
  // morceaux : les mots
  const pieces: { col: number; text: string }[] = [];
  for (let regExp = /\S+/g, match = regExp.exec(body); match; match = regExp.exec(body)) {
    // un soufflet collé à une nuance (« p<--- ») en est séparé ; la découpe ne retire
    // aucun caractère : chaque morceau commence où finit le précédent
    let col = match.index;
    for (const staff of match[0].split(/(?<=[^\s<>])(?=[<>][-|]*$)/)) {
      pieces.push({ col, text: staff });
      col += staff.length;
    }
  }
  for (const piece of pieces) {
    // les barres recopiées pour se repérer sont ignorées
    const lead = piece.text.length - piece.text.replace(/^[|:]+/, "").length;
    const text = piece.text.slice(lead).replace(/[|:]+$/, "");
    if (!text) continue;
    const col = piece.col + lead;
    const prev = out[out.length - 1];
    // un mot qui suit un autre mot à une seule espace prolonge le même texte
    if (prev && joinsText(prev.text, text) && col === prev.col + prev.text.length + 1) {
      prev.text += " " + text;
    } else out.push({ col, text });
  }
  return out;
}

/**
 * Ce qui précise une partie, entre parenthèses dans `parts:` : son instrument, et pour un
 * instrument à cordes (écrit, ou deviné d'après le nom) son accordage et son capo. Une partie
 * à cordes a ses cordes, même sans rien de précisé.
 */
export function partExtras(name: string, extras: string[], line: number): { instrument?: InstrumentName; strings?: Strings } {
  const instrument = extras.find(isInstrument);
  const played = instrument ?? guessInstrument(name);
  let tuning: string | undefined,
    capo = 0;
  for (const extra of extras) {
    if (extra === instrument) continue;
    const match = extra.match(/^capo\s*(\d+)$/);
    if (match) {
      capo = Number(match[1]);
      if (capo < 1 || capo > MAX_CAPO) throw new PrismaError(`« parts » : capo ${capo} pour « ${name} » : de 1 à ${MAX_CAPO}`, line);
      continue;
    }
    if (isStringInstrument(played) && tuningsOf(played).includes(extra)) {
      tuning = extra;
      continue;
    }
    if (isStringInstrument(played))
      throw new PrismaError(
        `« parts » : « ${extra} » pour « ${name} » n'est ni un instrument, ni un accordage (${tuningsOf(played).join(", ")}), ni un capo (capo 2)`,
        line,
      );
    throw new PrismaError(
      `« parts » : instrument « ${extra} » inconnu pour « ${name} » ; les instruments : ${INSTRUMENTS.join(", ")}`,
      line,
    );
  }
  if (!isStringInstrument(played)) {
    if (capo) throw new PrismaError(`« parts » : « ${name} » n'est pas un instrument à cordes : pas de capo`, line);
    return instrument ? { instrument } : {};
  }
  return { ...(instrument ? { instrument } : {}), strings: stringsOf(played, tuning ?? "standard", capo)! };
}

export function parsePrisma(text: string): Score {
  const lines = text.replace(/\t/g, "    ").split(/\r?\n/);
  const { meta, bodyStartLine } = parseFrontmatter(lines);
  // parties déclarées : « parts: Chant (flute), Piano », chacune nommée sur le trait au-dessus de sa
  // première portée ; entre parenthèses, l'instrument qui la joue à l'écoute
  const partsLine = lines.findIndex((line, index) => index < bodyStartLine && /^parts\s*:/.test(line)) + 1;
  const entries =
    meta.parts === undefined
      ? undefined
      : splitParts(String(meta.parts))
          .map(splitPartEntry)
          .map((entry) => ({ name: entry.name, ...partExtras(entry.name, entry.extras, partsLine) }));
  const declared = entries?.map((entry) => entry.name);
  delete meta.parts;
  if (declared) {
    if (declared.some((name) => !name))
      throw new PrismaError(
        "« parts » : les noms des parties, séparés par des virgules (parts: Chant, Piano ou parts: Chant, Guitare)",
        partsLine,
      );
    const twice = declared.find((name, index) => declared.indexOf(name) !== index);
    if (twice) throw new PrismaError(`« parts » : la partie « ${twice} » est nommée deux fois`, partsLine);
  }
  let parts: Part[] | undefined; // fixés par le premier système
  const defaultDivision = (Number(meta.division ?? 2) === 3 ? 3 : 2) as Division;

  // découpage en blocs : lignes @, une règle de comptage, puis les lignes qui la suivent
  type Block = { marks: number[]; ruler: number; lines: number[] };
  const blocks: Block[] = [];
  let pendingMarks: number[] = [];
  for (let index = bodyStartLine; index < lines.length; index++) {
    const line = lines[index];
    if (!line.trim() || line.trimStart().startsWith("#")) {
      if (!line.trim() && blocks.length) blocks[blocks.length - 1].lines.push(-1); // fin de bloc
      continue;
    }
    if (isMarkLine(line)) {
      const last = blocks[blocks.length - 1];
      // sous les lignes d'une portée, sans ligne vide : ligne @ de cette portée (nuances, soufflets)
      if (last && !last.lines.includes(-1) && !pendingMarks.length) last.lines.push(index);
      else pendingMarks.push(index);
      continue;
    }
    if (isRuler(line)) {
      blocks.push({ marks: pendingMarks, ruler: index, lines: [] });
      pendingMarks = [];
      continue;
    }
    const last = blocks[blocks.length - 1];
    if (!last || pendingMarks.length)
      throw new PrismaError("une règle de comptage (« m1 |1 … ») doit précéder les lignes de notes", index + 1);
    if (last.lines.includes(-1)) throw new PrismaError("ligne de notes séparée de sa règle de comptage par une ligne vide", index + 1);
    last.lines.push(index);
  }
  if (pendingMarks.length) throw new PrismaError("ligne @ sans règle de comptage en dessous", pendingMarks[0] + 1);
  if (!blocks.length) throw new PrismaError("aucune règle de comptage trouvée", bodyStartLine + 1);

  const beats: Beat[] = [];
  const notes: Note[] = [];
  // les glissés vers la note suivante, vérifiés une fois toutes les notes lues
  const slides: { note: Note; text: string; fret: number; line: number; col: number }[] = [];
  const graces: Grace[] = [];
  const repeats = new Map<number, Repeat>();
  const repeatAt = (barIndex: number) => {
    if (!repeats.has(barIndex)) repeats.set(barIndex, { barIndex });
    return repeats.get(barIndex)!;
  };
  const texts: TextMark[] = [];
  const fermatas: number[] = [];
  const chords: TextMark[] = [];
  const lyrics: Lyric[] = [];
  // fin de la case de chaque syllabe prolongée : sa prolongation doit la dépasser
  const lyricCell = new Map<Lyric, { end: number; line: number; col: number }>();
  const arpeggios: Arpeggio[] = [];
  const articulations: Articulation[] = [];
  /** Arpège posé une seule fois par instant et par portée (ou pour toutes les portées). */
  const addArpeggio = (x: Arpeggio, line: number, col: number) => {
    const clash = arpeggios.find((y) => y.t === x.t && (y.staff === undefined || x.staff === undefined || y.staff === x.staff));
    if (clash)
      throw new PrismaError(
        "un seul arpège par accord : sur la ligne @ d'une portée, ou sur celle du haut pour toutes les portées",
        line,
        col,
      );
    arpeggios.push(x);
  };
  const expressions: Expression[] = [];
  const hairpins: Hairpin[] = [];
  const effects: Effect[] = [];
  const pedals: Pedal[] = [];
  const slurs: Slur[] = [];
  type OpenSlur = { slur: Slur; line: number; col: number };
  let openSlurs: OpenSlur[] = []; // liaisons ouvertes dans ce système, qui continuent au suivant
  let pendingSlurs: OpenSlur[] = [];
  const slurAt = new Map<Slur, { line: number; col: number }>(); // position du « ( », pour les erreurs // liaisons du système précédent, à reprendre en tête de celui-ci
  const pedalTexts: PedalText[] = [];
  const pedalDown = new Map<Staff, Pedal>(); // pédale enfoncée de chaque portée, peut-être depuis un système précédent
  const timesMarks: { bar: number; times: number; line: number; col: number }[] = [];
  const markers: (Marker & { line: number; col: number })[] = [];
  let barIndex = -1;
  let lastBar = "0";
  let lastBarClosed = true;
  let repeatNext = false; // « ||: » en fin de système : la mesure suivante commence une reprise
  let pending: Note[] = []; // notes encore tenues à la fin du bloc précédent

  for (const block of blocks) {
    pendingSlurs = openSlurs;
    openSlurs = [];
    const rulerLine = lines[block.ruler];
    const rulerLineNumber = block.ruler + 1;
    const pipe = rulerLine.indexOf("|");
    const barLabel = rulerLine.slice(1, pipe).trim();
    const { segs, spans, leadRepeat } = parseRuler(rulerLine, rulerLineNumber, pipe);

    // temps du bloc
    const blockBeat0 = beats.length;
    let bar = barLabel || nextBar(lastBar);
    // une case va d'une étiquette de la règle à la suivante, quelle que soit sa largeur
    const anchors: { t: number; from: number; to: number; seg: number; barIndex: number }[] = [];
    const segBar: number[] = []; // mesure de chaque temps
    const segOpensBar: boolean[] = []; // le temps ouvre une mesure
    segs.forEach((segment, segmentIndex) => {
      // chaque case du temps commence par son étiquette : le numéro du temps, puis « * », « . » ou « , »
      const labels: { from: number; text: string }[] = [];
      const body = rulerLine.slice(segment.from, segment.to);
      for (let regExp = /\S+/g, match = regExp.exec(body); match; match = regExp.exec(body))
        labels.push({ from: segment.from + match.index, text: match[0] });
      if (!labels.length || labels[0].from !== segment.from || !/^\d+$/.test(labels[0].text) || Number(labels[0].text) < 1) {
        throw new PrismaError("chaque temps commence par son numéro, collé à la barre", rulerLineNumber, segment.from + 1);
      }
      for (const cellLabel of labels.slice(1)) {
        if (!SUB_LABELS.has(cellLabel.text))
          throw new PrismaError(
            `étiquette de case « ${cellLabel.text} » inconnue : attendu « * », « . » ou « , »`,
            rulerLineNumber,
            cellLabel.from + 1,
          );
      }
      const count = labels.length;
      if (TICKS_PER_BEAT % count)
        throw new PrismaError(`découpage en ${count} cases non pris en charge`, rulerLineNumber, segment.from + 1);
      const cells = labels.map((cellLabel) => cellLabel.text);
      const label = Number(cells[0]);
      const stars = cells.filter((cell) => cell === "*").length;
      const division: Division = stars === 2 ? 3 : stars === 1 ? 2 : defaultDivision;
      // nouvelle mesure ? (début de bloc après une mesure fermée, ou après une barre de mesure)
      const newBar = segmentIndex === 0 ? lastBarClosed || label === 1 : segs[segmentIndex - 1].barEnd;
      if (segmentIndex === 0 && !newBar && barLabel && barLabel !== lastBar) {
        throw new PrismaError(
          `la mesure ${lastBar} n'est pas terminée : ce système devrait commencer par « m${lastBar} »`,
          rulerLineNumber,
          1,
          {
            cascade: true,
          },
        );
      }
      if (segmentIndex === 0 && !newBar && leadRepeat)
        throw new PrismaError("« ||: » ne peut pas couper une mesure en deux", rulerLineNumber, pipe + 1);
      if (segmentIndex === 0 && !newBar) bar = lastBar;
      if (segmentIndex > 0 && newBar) bar = nextBar(bar);
      if (newBar) {
        barIndex++;
        if (repeatNext || (segmentIndex === 0 && leadRepeat) || (segmentIndex > 0 && segs[segmentIndex - 1].startRepeatAfter))
          repeatAt(barIndex).start = true;
        repeatNext = false;
      }
      if (segment.endRepeat) repeatAt(barIndex).end = true;
      segBar.push(barIndex);
      segOpensBar.push(newBar);
      const beatIndex = beats.length;
      beats.push({ bar, barIndex, label, division });
      for (let cellIndex = 0; cellIndex < count; cellIndex++) {
        anchors.push({
          t: beatIndex * TICKS_PER_BEAT + (cellIndex * TICKS_PER_BEAT) / count,
          from: labels[cellIndex].from,
          to: labels[cellIndex + 1]?.from ?? segment.to,
          seg: segmentIndex,
          barIndex,
        });
      }
    });
    repeatNext = segs[segs.length - 1].startRepeatAfter;
    lastBar = bar;
    lastBarClosed = segs[segs.length - 1].barEnd;
    const t0 = blockBeat0 * TICKS_PER_BEAT;
    const t1 = beats.length * TICKS_PER_BEAT;

    // ligne(s) @ au-dessus de la règle : débuts de section, nombre de passages, textes
    for (const lineIndex of block.marks) {
      if (isLyricLine(lines[lineIndex]))
        throw new PrismaError("les paroles se placent sous les lignes de leur portée, comme ses nuances", lineIndex + 1, 1);
      if (isChordLine(lines[lineIndex])) {
        // accords : chaque mot est un accord, posé sur une case (pas de texte de plusieurs mots)
        const line = lines[lineIndex];
        const regExp = /\S+/g;
        regExp.lastIndex = CHORD_LINE.length;
        for (let match = regExp.exec(line); match; match = regExp.exec(line)) {
          const col = match.index;
          const anchor = anchors.find((candidate) => candidate.from === col);
          if (!anchor)
            throw new PrismaError(
              `accord « ${match[0]} » : il doit commencer exactement sur une case de la règle de comptage`,
              lineIndex + 1,
              col + 1,
            );
          if (!chordNotes(match[0])) {
            throw new PrismaError(
              `accord inconnu « ${match[0]} » : nom Prisma (10:m, 8:7, 7:m7b5, 8/12…), nom anglais (Am, G7, G/B…) ou notes Prisma séparées par des virgules, de la basse vers l'aigu (10,1,5)`,
              lineIndex + 1,
              col + 1,
            );
          }
          const { shape } = splitShape(match[0]);
          if (shape !== undefined) {
            // la grille : une case par corde de la guitare du morceau, qui ne joue que des notes de l'accord
            const at = col + match[0].indexOf("=") + 2;
            const frets = parseShape(shape);
            const guitarStrings = gridStrings((entries ?? []).map((entry) => entry.strings));
            if (!frets)
              throw new PrismaError(
                `grille « ${shape} » : une case par corde, de la plus grave à la plus aiguë, x pour une corde qu'on ne joue pas (x02210, ou x-12-14-14-13-x quand une case a deux chiffres)`,
                lineIndex + 1,
                at,
              );
            if (frets.length !== guitarStrings.open.length)
              throw new PrismaError(
                `grille « ${shape} » : ${frets.length} cordes pour une guitare de ${guitarStrings.open.length}`,
                lineIndex + 1,
                at,
              );
            const notes = new Set(chordNotes(match[0])!.map((note) => (note - 1) % 12));
            const stray = shapePitches(frets, guitarStrings).find((pitchClass) => !notes.has(pitchClass));
            if (stray !== undefined)
              throw new PrismaError(
                `grille « ${shape} » : elle joue le ${stray + 1}${guitarStrings.capo ? ` (capo ${guitarStrings.capo} compris : les cases se comptent depuis le capo)` : ""}, qui n'est pas dans l'accord`,
                lineIndex + 1,
                at,
              );
          }
          if (chords.some((textMark) => textMark.t === anchor.t))
            throw new PrismaError("deux accords sur une même case", lineIndex + 1, col + 1);
          chords.push({ t: anchor.t, text: match[0] });
        }
        continue;
      }
      for (const token of markTokens(lines[lineIndex])) {
        const marker = token.text.match(MARKER_SIGN);
        if (marker) {
          // « [A] » : son « [ » sur le dernier « | » de la barre qui ouvre la mesure
          const spanIndex = spans.findIndex((candidate) => token.col >= candidate.from && token.col < candidate.to);
          const span = spans[spanIndex];
          if (spanIndex < 0 || spanIndex >= segs.length || !segOpensBar[spanIndex]) {
            throw new PrismaError(`« ${token.text} » doit être placé sur la barre qui ouvre une mesure`, lineIndex + 1, token.col + 1);
          }
          if (token.col !== span.from + span.text.lastIndexOf("|")) {
            throw new PrismaError(`« ${token.text} » doit être placé sur le dernier « | » de la barre`, lineIndex + 1, token.col + 1);
          }
          markers.push({ label: marker[1], barIndex: segBar[spanIndex], line: lineIndex + 1, col: token.col + 1 });
          continue;
        }
        const anchor = anchors.find((candidate) => candidate.from === token.col);
        if (!anchor)
          throw new PrismaError(
            `« ${token.text} » doit commencer exactement sur une case de la règle de comptage`,
            lineIndex + 1,
            token.col + 1,
          );
        const times = token.text.match(/^(\d+)\s*[×xX]$/);
        if (times) timesMarks.push({ bar: anchor.barIndex, times: Number(times[1]), line: lineIndex + 1, col: token.col + 1 });
        else if (token.text === FERMATA) {
          if (!fermatas.includes(anchor.t)) fermatas.push(anchor.t);
        } else if (isArpeggioSign(token.text)) {
          addArpeggio({ t: anchor.t, ...(token.text === ARPEGGIO_DOWN ? { down: true } : {}) }, lineIndex + 1, token.col + 1);
        } else if (isArticulationSign(token.text)) {
          throw new PrismaError(
            `« ${token.text} » : une articulation se place sur une ligne @ sous sa portée`,
            lineIndex + 1,
            token.col + 1,
          );
        } else texts.push({ t: anchor.t, text: token.text });
      }
    }

    // portées : séparées par des traits ; un trait facultatif sous la règle ouvre la première
    const content = block.lines.filter((index) => index >= 0);
    const rules = new Map<number, Rule>();
    for (const index of content) {
      const rule = parseRule(lines[index], index + 1);
      if (rule) rules.set(index, rule);
    }
    const staffOfLine = new Map<number, Staff>();
    const blockStaves: { rule?: Rule; line: number }[] = [{ line: rulerLineNumber }];
    content.forEach((lineIndex, position) => {
      const rule = rules.get(lineIndex);
      if (!rule) return staffOfLine.set(lineIndex, blockStaves.length - 1);
      if (position === 0) {
        if (rule.double)
          throw new PrismaError("le trait sous la règle est simple (─) : le double (═) sépare deux parties", lineIndex + 1, 1);
        blockStaves[0] = { rule, line: lineIndex + 1 };
      } else blockStaves.push({ rule, line: lineIndex + 1 });
    });
    // parties du système : un trait double en commence une nouvelle
    const here: { name?: string; staves: number; line: number }[] = [];
    blockStaves.forEach((blockStaff, index) => {
      if (index === 0 || blockStaff.rule!.double)
        here.push({ ...(blockStaff.rule?.name ? { name: blockStaff.rule.name } : {}), staves: 1, line: blockStaff.line });
      else {
        if (blockStaff.rule!.name)
          throw new PrismaError(
            `« ${blockStaff.rule!.name} » : le nom d'une partie s'écrit sur le trait double (═) qui la commence`,
            blockStaff.line,
            1,
          );
        here[here.length - 1].staves++;
      }
    });
    here.forEach((part, index) => {
      if (!declared) {
        if (part.name)
          throw new PrismaError(`partie « ${part.name} » non déclarée : nommez les parties dans le frontmatter (parts: …)`, part.line, 1);
        return;
      }
      if (index >= declared.length)
        throw new PrismaError(`partie de trop : « parts » en déclare ${declared.length} (${declared.join(", ")})`, part.line, 1);
      if (!part.name)
        throw new PrismaError(
          `il manque le nom de la partie « ${declared[index]} » sur le trait au-dessus de sa première portée`,
          part.line,
          1,
          {
            cascade: true,
          },
        );
      if (part.name !== declared[index]) {
        throw new PrismaError(
          declared.includes(part.name)
            ? `« ${part.name} » à la place de « ${declared[index]} » : les parties se suivent dans l'ordre de « parts »`
            : `partie « ${part.name} » non déclarée dans « parts » (${declared.join(", ")})`,
          part.line,
          1,
          { cascade: true },
        );
      }
    });
    if (declared && here.length < declared.length)
      throw new PrismaError(
        `il manque des parties : « parts » en déclare ${declared.length} (${declared.join(", ")})`,
        rulerLineNumber,
        1,
        {
          cascade: true,
        },
      );
    if (!parts) {
      parts = here.map(({ name, staves }, index) => ({
        ...(name ? { name } : {}),
        staves,
        ...(entries?.[index]?.instrument ? { instrument: entries[index].instrument } : {}),
        ...(entries?.[index]?.strings ? { strings: entries[index].strings } : {}),
      }));
      const multi = parts.find((part) => part.strings && part.staves > 1);
      if (multi)
        throw new PrismaError(`« ${multi.name} » est un instrument à cordes : une seule portée, une ligne par corde`, rulerLineNumber, 1);
    } else if (here.length !== parts.length || here.some((part, index) => part.staves !== parts![index].staves)) {
      const shape = (list: { staves: number }[]) => list.map((part) => part.staves).join(" + ");
      throw new PrismaError(
        `ce système n'a pas les mêmes portées que le premier (${shape(here)} au lieu de ${shape(parts)}) : chaque système écrit toutes les portées, même vides`,
        rulerLineNumber,
        1,
        { cascade: true },
      );
    }
    const staffTotal = blockStaves.length;
    // dernière portée de chaque partie : celle qui porte la pédale
    const lastStaves = new Set(here.map((_, index) => here.slice(0, index + 1).reduce((total, part) => total + part.staves, 0) - 1));
    const inSpan = (column: number) => spans.some((sepSpan) => column >= sepSpan.from && column < sepSpan.to);

    // ligne @ d'une portée : nuances, textes (« cresc. », « dolce »…), soufflets, et pédale
    // sous la dernière portée d'une partie
    const pedalSigns: { staff: Staff; t: number; text: string; line: number; col: number }[] = [];
    const readVoiceLine = (row: string, lineNumber: number, staff: Staff) => {
      for (const token of markTokens(row)) {
        // un soufflet, une liaison ou une articulation peut commencer dans la case, juste
        // après une autre indication (« p <--- », « . ! ») ; le reste commence exactement sur une case
        const anchorIndex =
          isHairpin(token.text) || isEffect(token.text) || isSlur(token.text) || isArticulationSign(token.text)
            ? anchors.findIndex((candidate) => token.col >= candidate.from && token.col < candidate.to)
            : anchors.findIndex((candidate) => candidate.from === token.col);
        if (anchorIndex < 0)
          throw new PrismaError(
            `« ${token.text} » doit commencer exactement sur une case de la règle de comptage`,
            lineNumber,
            token.col + 1,
          );
        const anchor = anchors[anchorIndex];
        if (isArpeggioSign(token.text)) {
          addArpeggio({ t: anchor.t, staff, ...(token.text === ARPEGGIO_DOWN ? { down: true } : {}) }, lineNumber, token.col + 1);
        } else if (isArticulationSign(token.text)) {
          const kind = articulationOf(token.text)!;
          if (isPick(kind) && !stringsOfStaff(parts!, staff))
            throw new PrismaError(
              `« ${token.text} » : le sens du médiator se note pour une partie de guitare ou de basse`,
              lineNumber,
              token.col + 1,
            );
          if (
            articulations.some((articulation) => articulation.staff === staff && articulation.t === anchor.t && articulation.kind === kind)
          )
            throw new PrismaError(`« ${token.text} » posé deux fois sur la même case`, lineNumber, token.col + 1);
          articulations.push({ staff, t: anchor.t, kind });
        } else if (isPedalSign(token.text) || isPedalText(token.text)) {
          if (!lastStaves.has(staff))
            throw new PrismaError(
              `« ${token.text} » : la pédale se note sur une ligne @ sous la dernière portée de sa partie`,
              lineNumber,
              token.col + 1,
            );
          if (isPedalText(token.text)) pedalTexts.push({ staff, t: anchor.t, text: token.text });
          else pedalSigns.push({ staff, t: anchor.t, text: token.text, line: lineNumber, col: token.col + 1 });
        } else if (isSlur(token.text)) {
          // suite d'une liaison du système précédent : elle reprend sur la première case
          // plusieurs suites : de haut en bas, dans l'ordre où les liaisons ont commencé
          const continued = token.text.startsWith("(")
            ? undefined
            : pendingSlurs
                .filter((openSlur) => openSlur.slur.staff === staff)
                .sort((first, second) => first.slur.start - second.slur.start)[0];
          if (!token.text.startsWith("(") && (!continued || anchorIndex !== 0)) {
            throw new PrismaError("« ---) » sans liaison ouverte : une liaison commence par « ( »", lineNumber, token.col + 1, {
              cascade: true,
            });
          }
          const slur = continued ? continued.slur : { staff, start: anchor.t, end: -1 };
          if (continued) pendingSlurs = pendingSlurs.filter((openSlur) => openSlur !== continued);
          else {
            slurs.push(slur);
            slurAt.set(slur, { line: lineNumber, col: token.col + 1 });
          }
          if (token.text.endsWith(")")) {
            const last = token.col + token.text.length - 1;
            const end = anchors.filter((candidate) => candidate.from <= last).pop()!;
            slur.end = end.t;
          } else openSlurs.push({ slur, line: lineNumber, col: token.col + 1 });
        } else if (isEffect(token.text)) {
          // l'étouffé ou le vibrato finit avec la case qui contient son dernier caractère, comme un soufflet
          const kind = effectOf(token.text)!;
          if (!stringsOfStaff(parts!, staff))
            throw new PrismaError(
              `« ${token.text} » : ${kind === "palmMute" ? "l'étouffé de la paume" : "le vibrato"} se note pour une partie de guitare ou de basse`,
              lineNumber,
              token.col + 1,
            );
          const last = token.col + token.text.length - 1;
          const next = anchors.find((candidate) => candidate.from > last);
          const end = next ? next.t : t1;
          const prev =
            anchorIndex === 0 ? effects.find((effect) => effect.staff === staff && effect.kind === kind && effect.end === t0) : undefined;
          if (prev) prev.end = end;
          else effects.push({ staff, kind, start: anchor.t, end });
        } else if (isHairpin(token.text)) {
          // le soufflet finit avec la case qui contient son dernier caractère
          const last = token.col + token.text.length - 1;
          const next = anchors.find((candidate) => candidate.from > last);
          const end = next ? next.t : t1;
          const kind = token.text[0] as Hairpin["kind"];
          // suite d'un soufflet du système précédent
          const prev =
            anchorIndex === 0
              ? hairpins.find((hairpin) => hairpin.staff === staff && hairpin.kind === kind && hairpin.end === t0)
              : undefined;
          if (prev) prev.end = end;
          else hairpins.push({ staff, kind, start: anchor.t, end });
        } else {
          expressions.push({ staff, t: anchor.t, text: token.text, kind: isDynamic(token.text) ? "dynamic" : "text" });
        }
      }
    };

    // ligne de paroles d'une voix : une syllabe par case, « lu- » si le mot continue sur la
    // suivante, « --- » pour prolonger la syllabe précédente sur plusieurs notes
    const readLyricLine = (row: string, lineNumber: number, staff: Staff, verse: number) => {
      let last: Lyric | undefined; // syllabe précédente sur la ligne
      let extended = false; // elle a déjà sa prolongation
      // seules les espaces séparent les syllabes : une espace insécable reste dans la syllabe (« Oh ! »)
      for (const match of row.slice(LYRIC_LINE.length).matchAll(/[^ ]+/g)) {
        const token = match[0];
        const col = LYRIC_LINE.length + match.index!;
        if (/^[|:]+$/.test(token)) continue; // barres recopiées pour se repérer
        if (isExtender(token)) {
          // la prolongation va jusqu'au bout de la case qui contient son dernier caractère
          const lastColumn = col + token.length - 1;
          const end = anchors.find((candidate) => candidate.from > lastColumn)?.t ?? t1;
          if (!last) {
            // suite de la prolongation d'une syllabe du système précédent
            const prev =
              col === anchors[0].from
                ? lyrics.find((lyric) => lyric.staff === staff && lyric.verse === verse && lyric.extend === t0)
                : undefined;
            if (!prev)
              throw new PrismaError(
                "« --- » prolonge la syllabe qui le précède sur la ligne : écrivez d'abord la syllabe",
                lineNumber,
                col + 1,
                {
                  cascade: true,
                },
              );
            prev.extend = end;
            last = prev;
          } else {
            if (last.hyphen)
              throw new PrismaError(
                `« ${last.text}${HYPHEN} » continue sur la syllabe suivante : elle ne se prolonge pas`,
                lineNumber,
                col + 1,
              );
            if (extended) throw new PrismaError("une seule prolongation par syllabe", lineNumber, col + 1);
            // une syllabe sur la dernière case d'un système se prolonge au suivant : vérifié à la fin
            const anchorIndex = anchors.findIndex((candidate) => candidate.t === last!.t);
            lyricCell.set(last, { end: anchors[anchorIndex + 1]?.t ?? t1, line: lineNumber, col: col + 1 });
            last.extend = end;
          }
          extended = true;
          continue;
        }
        const anchor = anchors.find((candidate) => candidate.from === col);
        if (!anchor)
          throw new PrismaError(
            `syllabe « ${token} » : elle doit commencer exactement sur une case de la règle de comptage`,
            lineNumber,
            col + 1,
          );
        const hyphen = token.length > 1 && token.endsWith(HYPHEN);
        last = { staff, verse, t: anchor.t, text: hyphen ? token.slice(0, -HYPHEN.length) : token, ...(hyphen ? { hyphen: true } : {}) };
        extended = false;
        lyrics.push(last);
      }
    };

    const nextPending: Note[] = [];
    // petites notes du bloc, par portée et instant : leur rang se lit de gauche à droite dans la case
    const blockGraces = new Map<string, { staff: Staff; t: number; col: number; midi: number; string?: number }[]>();
    const lastOctave: (number | undefined)[] = Array(staffTotal).fill(undefined);
    const voiceLine: boolean[] = Array(staffTotal).fill(false);
    const verses: number[] = Array(staffTotal).fill(0); // couplets : les lignes @l d'une portée, de haut en bas
    for (const lineIndex of content) {
      if (rules.has(lineIndex)) continue;
      const row = lines[lineIndex];
      const lineNumber = lineIndex + 1;
      const staff = staffOfLine.get(lineIndex)!;
      if (isChordLine(row)) throw new PrismaError("les accords se placent au-dessus de la règle de comptage", lineNumber, 1);
      if (isLyricLine(row)) {
        voiceLine[staff] = true;
        readLyricLine(row, lineNumber, staff, ++verses[staff]);
        continue;
      }
      if (isMarkLine(row)) {
        voiceLine[staff] = true;
        readVoiceLine(row, lineNumber, staff);
        continue;
      }
      if (voiceLine[staff]) {
        throw new PrismaError(
          "ligne de notes sous une ligne @ : les lignes @ d'une portée se placent après toutes ses lignes de notes",
          lineNumber,
          1,
        );
      }
      if (row[pipe] !== "|")
        throw new PrismaError(
          "le « | » de début de ligne doit être aligné sur celui de la règle",
          lineNumber,
          Math.min(row.length, pipe) + 1,
        );
      // les barres (et leurs deux points de reprise, facultatifs) sont alignées sur la règle
      for (let column = pipe; column < row.length; column++) {
        const rulerChar = rulerLine[column],
          rowChar = row[column];
        if (inSpan(column)) {
          if (rulerChar === "|" && rowChar !== "|")
            throw new PrismaError("barre attendue ici, alignée sur la règle de comptage", lineNumber, column + 1);
          if (rulerChar === ":" && rowChar !== ":" && rowChar !== " ")
            throw new PrismaError("« : » de reprise ou espace attendu ici", lineNumber, column + 1);
        } else if (rowChar === "|") {
          throw new PrismaError("« | » mal placé : il ne tombe pas sur une barre de la règle", lineNumber, column + 1);
        }
      }
      // rien après la dernière barre de la règle : une note n'y aurait pas de case
      const end = rulerLine.trimEnd().length;
      const extra = row.slice(end).search(/\S/);
      if (extra >= 0) throw new PrismaError("rien ne s'écrit après la dernière barre de la règle de comptage", lineNumber, end + extra + 1);
      const label = row.slice(0, pipe).trim();
      // instrument à cordes : chaque ligne est une corde, numérotée de l'aiguë (1, en haut) à la plus grave
      const strings = stringsOfStaff(parts!, staff);
      if (strings) {
        const count = strings.open.length;
        if (!label)
          throw new PrismaError(`une ligne par corde : chaque ligne commence par le numéro de sa corde (1 à ${count})`, lineNumber, 1);
        const stringNumber = /^\d+$/.test(label) ? Number(label) : NaN;
        if (!(stringNumber >= 1 && stringNumber <= count))
          throw new PrismaError(`corde invalide : « ${label} » (attendu 1, la plus aiguë, à ${count})`, lineNumber, 1);
        const above = lastOctave[staff];
        if (above !== undefined && stringNumber <= above) {
          throw new PrismaError(
            stringNumber === above
              ? `corde « ${label} » écrite deux fois dans le système : une corde ne joue qu'une note à la fois`
              : `corde « ${label} » sous la corde « ${above} » : les cordes vont de l'aiguë (1, en haut) à la plus grave`,
            lineNumber,
            1,
          );
        }
        lastOctave[staff] = stringNumber;
      } else if (label) {
        const labelOctave = parseOctaveLabel(label);
        if (labelOctave === undefined) {
          throw new PrismaError(`octave invalide : « ${label} » (attendu 0 pour l'octave du do central, +1, -1, +2…)`, lineNumber, 1);
        }
        // dans une portée, les octaves se suivent de l'aigu au grave, comme sur la partition
        const above = lastOctave[staff];
        if (above !== undefined && labelOctave >= above) {
          const name = (lane: number) => (lane > CENTRAL_OCTAVE ? `+${lane - CENTRAL_OCTAVE}` : String(lane - CENTRAL_OCTAVE));
          throw new PrismaError(
            labelOctave === above
              ? `octave « ${label} » écrite deux fois dans la portée : ses lignes suivantes s'écrivent sans numéro`
              : `octave « ${label} » sous l'octave « ${name(above)} » : dans une portée, les octaves vont de l'aigu (en haut) au grave (en bas)`,
            lineNumber,
            1,
          );
        }
        lastOctave[staff] = labelOctave;
      }
      const octave = lastOctave[staff];
      if (octave === undefined) throw new PrismaError("la première ligne de chaque portée doit indiquer son octave", lineNumber, 1);
      // la hauteur d'un nombre de la ligne : une note de l'octave, ou une case de la corde
      const string = strings ? octave : undefined;
      const pitch = (number: number) => (strings ? soundingOf(strings, octave, number) : midiOf(octave, number));
      const [lowest, highest] = strings ? [0, MAX_FRET] : [1, 12];
      const what = strings ? `une case de 0 à ${MAX_FRET}` : "un numéro de 1 à 12";
      const onString = string !== undefined ? { string } : {};

      let open: Note | undefined;
      const close = (tick: number) => {
        if (open) open.end = tick;
        open = undefined;
      };
      anchors.forEach((anchor, anchorIndex) => {
        let raw = row.slice(anchor.from, anchor.to);
        // petites notes (« 3' »), avant la note de la case
        let graceEnd = 0;
        for (const grace of raw.matchAll(/(\d+)'/g)) {
          const graceColumn = anchor.from + grace.index! + 1;
          const number = Number(grace[1]);
          if (number < lowest || number > highest)
            throw new PrismaError(
              `petite note invalide « ${grace[0]} » : attendu ${what} suivi de « ${GRACE_MARK} »`,
              lineNumber,
              graceColumn,
            );
          const key = staff + ":" + anchor.t;
          if (!blockGraces.has(key)) blockGraces.set(key, []);
          blockGraces.get(key)!.push({ staff, t: anchor.t, col: graceColumn, midi: pitch(number), ...onString });
          graceEnd = grace.index! + grace[0].length;
        }
        if (graceEnd) {
          const before = raw.slice(0, graceEnd).replace(/\d+'/g, (grace) => " ".repeat(grace.length));
          if (before.trim())
            throw new PrismaError("une petite note se place avant la note de sa case", lineNumber, anchor.from + before.search(/\S/) + 1);
          raw = " ".repeat(graceEnd) + raw.slice(graceEnd);
        }
        const cell = raw.trim();
        const col = anchor.from + 1 + (raw.length - raw.trimStart().length);
        // sur une corde, les techniques : « x » étouffée, « <12> » harmonique, « 7/ » glissé (« 7// » vers rien,
        // « //7 » depuis rien), « 7b9 » bend (« 7b9r » relâché)
        const tech = strings ? stringCell(cell) : undefined;
        if (tech) {
          const { dead, harmonic, fret, slide, slideOut, slideIn, bend, release, finger } = tech;
          if (fret > highest) throw new PrismaError(`case invalide « ${cell} » : ${what}`, lineNumber, col);
          if (harmonic && HARMONICS[fret] === undefined)
            throw new PrismaError(
              `harmonique « ${cell} » : une harmonique naturelle s'effleure sur la case ${Object.keys(HARMONICS).join(", ")}`,
              lineNumber,
              col,
            );
          if (bend !== undefined && (bend <= fret || bend - fret > MAX_BEND || bend > highest))
            throw new PrismaError(
              `bend « ${cell} » : la case tirée, puis celle dont elle prend le son, plus haut de ${MAX_BEND} cases au plus (7${BEND_MARK}9)`,
              lineNumber,
              col,
            );
          if (finger && (finger < 1 || finger > 5)) throw new PrismaError(`doigté « ${cell} » : un doigt de 1 à 5`, lineNumber, col);
          if (slideIn === "down" && fret + 1 > highest)
            throw new PrismaError(`glissé « ${cell} » : il vient d'une case plus haute que la ${highest}ᵉ`, lineNumber, col);
          close(anchor.t);
          open = {
            staff,
            midi: pitch(fret),
            start: anchor.t,
            end: t1,
            ...(dead ? { dead: true } : {}),
            ...(harmonic ? { harmonic: true } : {}),
            ...(slide ? { slide } : {}),
            ...(slideOut ? { slideOut } : {}),
            ...(slideIn ? { slideIn } : {}),
            ...(bend !== undefined ? { bend: pitch(bend), ...(release ? { release: true } : {}) } : {}),
            ...(finger ? { finger } : {}),
            ...onString,
          };
          notes.push(open);
          if (slide) slides.push({ note: open, text: cell, fret, line: lineNumber, col });
          return;
        }
        const match = cell.match(/^(-?)(\d{0,2})(?:~(\d{1,2}))?(?:_(\d))?$/);
        const bad = (key?: string) => !!key && (Number(key) < lowest || Number(key) > highest);
        const badFinger = match && match[4] && (Number(match[4]) < 1 || Number(match[4]) > 5 || match[1] || !match[2]);
        if (
          !match ||
          bad(match[2]) ||
          bad(match[3]) ||
          (!match[1] && !match[2] && cell) ||
          (match[3] && (match[1] || !match[2])) ||
          badFinger
        ) {
          throw new PrismaError(
            `case invalide « ${cell} » : attendu ${what}, « - », « -N », une trille « N${TRILL_MARK}N », un doigté « N${FINGER_MARK}D » (doigt de 1 à 5), des petites notes « N' »${strings ? `, une note étouffée « ${DEAD_MARK} », une harmonique « <12> », un glissé « 7${SLIDE_MARKS.up} » ou « 9${SLIDE_MARKS.down} », vers rien « 7${SLIDE_MARKS.up.repeat(2)} » ou depuis rien « ${SLIDE_MARKS.up.repeat(2)}7 », un bend « 7${BEND_MARK}9 » (« 7${BEND_MARK}9${RELEASE_MARK} » relâché)` : ""} ou une case vide`,
            lineNumber,
            col,
          );
        }
        const [, dash, digits, aux, finger] = match;
        if (!cell) return close(anchor.t);
        if (!dash) {
          close(anchor.t);
          const midi = pitch(Number(digits));
          if (aux && Number(aux) === Number(digits)) throw new PrismaError("une trille alterne avec une autre note", lineNumber, col);
          // sur une corde, la voisine d'une trille est une case de la même corde
          const trill = aux ? (strings ? pitch(Number(aux)) : trillAux(midi, Number(aux))) : undefined;
          open = {
            staff,
            midi,
            start: anchor.t,
            end: t1,
            ...(trill !== undefined ? { trill } : {}),
            ...(finger ? { finger: Number(finger) } : {}),
            ...onString,
          };
          notes.push(open);
          return;
        }
        // tenue
        if (!digits) {
          if (open?.dead) throw new PrismaError(`« - » après « ${DEAD_MARK} » : une note étouffée ne se tient pas`, lineNumber, col);
          if (open) return;
          throw new PrismaError(
            anchorIndex === 0
              ? "tenue en début de système : écrivez le numéro de la note, par exemple « -7 »"
              : "« - » sans note à prolonger",
            lineNumber,
            col,
            anchorIndex === 0 ? { cascade: true } : undefined,
          );
        }
        const midi = pitch(Number(digits));
        if (open) {
          if (open.midi !== midi)
            throw new PrismaError(
              `« -${digits} » prolonge une note différente (${strings ? open.midi - pitch(0) : (open.midi % 12) + 1})`,
              lineNumber,
              col,
              { cascade: true },
            );
          return;
        }
        const prev =
          anchorIndex === 0
            ? pending.find((note) => note.staff === staff && note.midi === midi && note.string === string && note.end === t0)
            : undefined;
        if (prev) {
          pending = pending.filter((note) => note !== prev);
          open = prev;
        } else {
          // tenue sans origine connue (début de fichier, saisie partielle) : la note commence ici
          open = { staff, midi, start: anchor.t, end: t1, ...onString };
          notes.push(open);
        }
      });
      if (open) {
        open.end = t1;
        nextPending.push(open);
      }
    }
    pending = nextPending;
    for (const list of blockGraces.values()) {
      const cols = [...new Set(list.map((grace) => grace.col))].sort((first, second) => first - second);
      for (const grace of list)
        graces.push({
          staff: grace.staff,
          midi: grace.midi,
          t: grace.t,
          slot: cols.indexOf(grace.col),
          ...(grace.string !== undefined ? { string: grace.string } : {}),
        });
    }

    // pédale : dans l'ordre du temps, en relâchant avant d'enfoncer à un même instant
    const order = (sign: string) => (sign === PEDAL_UP ? 0 : sign === PEDAL_CHANGE ? 1 : 2);
    pedalSigns.sort((first, second) => first.staff - second.staff || first.t - second.t || order(first.text) - order(second.text));
    for (const sign of pedalSigns) {
      const down = pedalDown.get(sign.staff);
      if (sign.text !== PEDAL_DOWN) {
        if (!down) {
          throw new PrismaError(
            sign.text === PEDAL_UP ? "« * » sans pédale enfoncée" : "« *Ped. » sans pédale enfoncée : écrivez « Ped. »",
            sign.line,
            sign.col,
          );
        }
        down.end = sign.t;
        pedalDown.delete(sign.staff);
      }
      if (sign.text !== PEDAL_UP) {
        if (pedalDown.has(sign.staff))
          throw new PrismaError("« Ped. » alors que la pédale est déjà enfoncée : écrivez « *Ped. » pour la changer", sign.line, sign.col);
        const pedal = { staff: sign.staff, start: sign.t, end: -1 };
        pedalDown.set(sign.staff, pedal);
        pedals.push(pedal);
      }
    }
    if (pendingSlurs.length) {
      const openSlur = pendingSlurs[0];
      throw new PrismaError(
        "liaison coupée en fin de système : reprenez-la au début du suivant par « ---) »",
        openSlur.line,
        openSlur.col,
        {
          cascade: true,
        },
      );
    }
  }
  if (openSlurs.length)
    throw new PrismaError("liaison jamais refermée : terminez-la par « ) »", openSlurs[0].line, openSlurs[0].col, { global: true });
  for (const slur of slurs) {
    if (slur.end <= slur.start) {
      throw new PrismaError(
        "une liaison relie au moins deux notes : « ( » et « ) » dans deux cases différentes",
        slurAt.get(slur)!.line,
        slurAt.get(slur)!.col,
        { global: true },
      );
    }
  }
  // un glissé arrive, sans silence, sur la note suivante de sa corde, et dans son sens
  for (const slide of slides) {
    const slidNote = slide.note;
    const next = notes
      .filter((note) => note.staff === slidNote.staff && note.string === slidNote.string && note.start > slidNote.start)
      .sort((first, second) => first.start - second.start)[0];
    if (!next || next.start !== slidNote.end) {
      throw new PrismaError(
        `glissé « ${slide.text} » : il arrive, sans silence, sur la note suivante de la corde ; pour glisser vers rien, « ${slide.fret}${slideText(slidNote.slide!, true)} »`,
        slide.line,
        slide.col,
        { global: true },
      );
    }
    if (next.midi === slidNote.midi)
      throw new PrismaError(
        `glissé « ${slide.text} » : la note suivante de la corde est la même ; il glisse vers une autre case`,
        slide.line,
        slide.col,
        { global: true },
      );
    const direction = next.midi > slidNote.midi ? "up" : "down";
    if (direction !== slidNote.slide) {
      throw new PrismaError(
        `glissé « ${slide.text} » : la note suivante de la corde est plus ${direction === "up" ? "aiguë" : "grave"} ; « ${slide.fret}${slideText(direction, false)} » glisse vers elle`,
        slide.line,
        slide.col,
        { global: true },
      );
    }
  }
  for (const [lyric, cell] of lyricCell) {
    if (lyric.extend! <= cell.end)
      throw new PrismaError("la prolongation doit dépasser la case de sa syllabe", cell.line, cell.col, { global: true });
  }
  // une pédale jamais relâchée tient jusqu'à la fin du morceau
  for (const pedal of pedalDown.values()) pedal.end = beats.length * TICKS_PER_BEAT;

  // nombre de passages : porté par une mesure qui finit une reprise
  for (const timesMark of timesMarks) {
    const repeat = repeats.get(timesMark.bar);
    if (!repeat?.end)
      throw new PrismaError(
        `« ${timesMark.times}× » doit être placé dans une mesure qui se termine par « :|| »`,
        timesMark.line,
        timesMark.col,
        {
          global: true,
        },
      );
    if (timesMark.times !== 2) repeat.times = timesMark.times;
  }

  // sections : chaque lettre une seule fois, la première au tout début, et aucune reprise
  // à cheval sur deux sections (une reprise reste locale)
  markers.sort((first, second) => first.barIndex - second.barIndex);
  for (const marker of markers) {
    if (markers.find((other) => other.label === marker.label) !== marker)
      throw new PrismaError(`section « [${marker.label}] » posée deux fois`, marker.line, marker.col, { global: true });
  }
  if (markers.length && markers[0].barIndex !== 0) {
    throw new PrismaError(
      `le morceau commence avant la première section « [${markers[0].label}] » : posez une section sur la première mesure`,
      markers[0].line,
      markers[0].col,
      { global: true },
    );
  }
  let repeatStart = 0;
  for (const repeat of [...repeats.values()].sort((first, second) => first.barIndex - second.barIndex)) {
    if (repeat.start) repeatStart = repeat.barIndex;
    if (!repeat.end) continue;
    const inside = markers.find((marker) => marker.barIndex > repeatStart && marker.barIndex <= repeat.barIndex);
    if (inside)
      throw new PrismaError(
        `la reprise passe le début de la section « [${inside.label}] » : une reprise reste dans sa section`,
        inside.line,
        inside.col,
        { global: true },
      );
    repeatStart = repeat.barIndex + 1;
  }

  // ordre de jeu : « order: A A B C » dans le frontmatter
  const orderLine = lines.findIndex((line, index) => index < bodyStartLine && /^order\s*:/.test(line)) + 1;
  const order = meta.order === undefined ? [] : String(meta.order).trim().split(/\s+/).filter(Boolean);
  delete meta.order;
  for (const label of order) {
    if (!/^[A-Z]$/.test(label))
      throw new PrismaError(`ordre de jeu : « ${label} » n'est pas une lettre de section (A à Z)`, orderLine, undefined, { global: true });
    if (!markers.some((marker) => marker.label === label))
      throw new PrismaError(`ordre de jeu : aucune section « [${label}] » dans le morceau`, orderLine, undefined, { global: true });
  }
  // une section que l'ordre ne nomme pas ne serait jamais jouée : un oubli, presque toujours
  const unplayed = order.length ? markers.find((marker) => !order.includes(marker.label)) : undefined;
  if (unplayed) {
    throw new PrismaError(
      `la section « [${unplayed.label}] » n'est jamais jouée : ajoutez-la à l'ordre de jeu (« order »), ou retirez-la`,
      unplayed.line,
      unplayed.col,
      { global: true },
    );
  }

  return {
    meta,
    parts: parts!,
    beats,
    notes: sortNotes(notes),
    graces: sortGraces(graces),
    repeats: [...repeats.values()].sort((first, second) => first.barIndex - second.barIndex),
    texts,
    expressions: expressions.sort((first, second) => first.t - second.t || first.staff - second.staff),
    hairpins: hairpins.sort((first, second) => first.start - second.start || first.staff - second.staff),
    effects: effects.sort((first, second) => first.start - second.start || first.staff - second.staff),
    slurs: slurs.sort((first, second) => first.start - second.start || first.staff - second.staff || first.end - second.end),
    pedals: pedals
      .filter((pedal) => pedal.end > pedal.start)
      .sort((first, second) => first.start - second.start || first.staff - second.staff),
    pedalTexts: pedalTexts.sort((first, second) => first.t - second.t || first.staff - second.staff),
    markers: markers.map(({ label, barIndex }) => ({ label, barIndex })),
    chords: chords.sort((first, second) => first.t - second.t),
    lyrics: sortLyrics(lyrics),
    arpeggios: arpeggios.sort((first, second) => first.t - second.t || (first.staff ?? -1) - (second.staff ?? -1)),
    articulations: sortArticulations(articulations),
    fermatas: fermatas.sort((first, second) => first - second),
    order,
  };
}
