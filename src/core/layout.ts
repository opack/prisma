/**
 * Mise en page : découpe le morceau en systèmes qui tiennent dans une largeur donnée,
 * et calcule pour chaque système ses ancres, ses lignes et le contenu de chaque case.
 *
 * Le moteur ne connaît que des « unités » de largeur : des caractères pour le texte,
 * des millimètres pour le rendu graphique. Seules les mesures changent.
 */
import {
  ARPEGGIO_DOWN,
  ARPEGGIO_UP,
  ARTICULATION_SIGNS,
  BEND_MARK,
  DEAD_MARK,
  FINGER_MARK,
  RELEASE_MARK,
  slideText,
  staffCount,
  stringsOfStaff,
  PEDAL_CHANGE,
  PEDAL_DOWN,
  PEDAL_UP,
  TICKS_PER_BEAT,
  TRILL_MARK,
  beatStart,
  graceDigits,
  repeatOf,
} from "./model.ts";
import type { Beat, Division, EffectKind, Hairpin, Part, Note, Staff, Score } from "./model.ts";
import { CENTRAL_OCTAVE, numberOf, octaveOf } from "./pitch.ts";
import { fretOf } from "./strings.ts";
import type { Strings } from "./strings.ts";

export type Metrics = {
  /** Largeur totale disponible pour un système. */
  width: number;
  /** Largeur de la colonne de gauche (numéro de mesure ou d'octave), séparateur compris. */
  prefix: number;
  cell: number;
  /**
   * Largeur de la case qui commence à l'instant t, si elle doit être plus large que cell
   * (texte .prisma : une indication trop longue élargit sa case). Par défaut : cell.
   */
  cellAt?: (t: number) => number;
  beatSep: number;
  barSep: number;
  /** Largeur ajoutée par les deux points d'un signe de reprise, de chaque côté. */
  repeatDots: number;
  /**
   * Notes alignées (gravure seulement) : une note rejouée ou qui revient garde la ligne
   * de la précédente, au lieu de remonter en haut de son couloir (replayed) ; de plus, deux
   * notes jouées dans une même mesure ne partagent jamais une ligne, l'aiguë au-dessus (pitch) :
   * une ligne par note, qui dessine la mélodie et les arpèges.
   */
  align?: Align;
  /**
   * Sections à la suite : une section qui commence en cours de ligne ne passe pas à la ligne
   * suivante ; un blanc de sectionSep la sépare de la précédente. Par défaut, chaque section
   * commence une nouvelle ligne.
   */
  sectionSep?: number;
  /** Instruments à cordes : toutes les cordes, même celles qui ne jouent rien dans le système (gravure). */
  allStrings?: boolean;
  /** Règle détaillée (gravure) : chaque temps découpé au moins jusqu'à ce niveau, même sans attaque (voir beatGrids). */
  detail?: RulerDetail;
};

/**
 * Règle détaillée : written, les seules cases écrites ; division, chaque temps découpé au moins une
 * fois (« * » : en 2, en 3 dans un temps ternaire) ; subdivision, recoupé une fois de plus (« . » :
 * en 4, en 6).
 */
export type RulerDetail = "written" | "division" | "subdivision";

export type Align = "replayed" | "pitch";

export type Column =
  | { kind: "anchor"; t: number; label: string; beatIndex: number; cellIndex: number; cellCount: number }
  | { kind: "beatSep" }
  /**
   * Barre de mesure. endRepeat : « :|| » (la mesure précédente termine une reprise) ;
   * startRepeat : « ||: » (la mesure suivante en commence une). lead : barre de début de
   * système, présente seulement quand le système commence par « ||: ».
   */
  /**
   * section : double barre de fin de section ; spaced : une nouvelle section suit sur la même
   * ligne, après un blanc (la barre ferme la section, puis la suivante s'ouvre comme une ligne).
   */
  | { kind: "barSep"; endRepeat?: boolean; startRepeat?: boolean; lead?: boolean; final?: boolean; section?: boolean; spaced?: boolean };
// final : dernière barre du morceau (double barre de fin, trait fin puis trait épais) ;
// section : barre qui termine une section (double barre)

export type SystemRow = {
  staff: Staff;
  /** Couloir d'octave ; sur une corde, l'octave du do central, sans autre sens. */
  octave: number;
  /** Instrument à cordes : la corde de la ligne (1 : la plus aiguë) ; ses cases sont des numéros de case. */
  string?: number;
  /** Faux pour les lignes suivantes d'un même groupe d'octave : on n'écrit le numéro qu'une fois. */
  showOctave: boolean;
  /** Contenu de chaque ancre : "", "-", "-N" (rappel en début de système), "N", "N~N" (trille), "N_D" (doigté). */
  cells: string[];
  /** Pour chaque ancre, vrai si la note qui y sonne est une trille (attaque ou tenue). */
  trill: boolean[];
  /**
   * Petites notes de chaque ancre, jouées avant son contenu : un numéro par rang (voir
   * System.graceDigits), "" pour un rang joué sur une autre ligne. Vide sans petite note.
   */
  graces: string[][];
  /**
   * Pour chaque ancre, décalage vertical (en lignes) qui centre le bloc de notes dans
   * son couloir d'octave. Sert seulement au rendu graphique « notes centrées ».
   */
  center: number[];
};

/**
 * Indication de la ligne @. Les débuts de section (« [A] ») sont placés sur une barre de
 * mesure (column : index dans columns, -1 pour la barre de gauche du système) ; les autres
 * indications sur une ancre (anchor : index dans anchors).
 */
export type Mark = {
  anchor?: number;
  column?: number;
  text: string;
  kind: "times" | "text" | "marker" | "fermata" | "arpeggio";
  /** Début de section : sa lettre. */
  label?: string;
};

/** Position d'une indication dans l'ordre des colonnes du système, pour les trier. */
export const markColumn = (sys: { anchors: number[] }, mark: Mark) => (mark.anchor !== undefined ? sys.anchors[mark.anchor] : mark.column!);

/** Indication d'une voix (nuance ou texte), sur une ancre. */
export type VoiceMark = { anchor: number; text: string; kind: "dynamic" | "text" | "arpeggio" | "articulation" };

/** Portion d'un soufflet visible dans un système. */
export type HairpinSpan = {
  kind: Hairpin["kind"];
  /** Première et dernière ancres couvertes. */
  fromAnchor: number;
  toAnchor: number;
  /** Avancement du soufflet (0 à 1) au début et à la fin de la portion : un soufflet coupé reste ouvert. */
  from: number;
  to: number;
};

/**
 * Portion d'une liaison visible dans un système : de la case de sa première note à celle
 * de sa dernière. opens / closes : la liaison commence / se termine dans ce système.
 * level : étage, pour les liaisons imbriquées ou qui se chevauchent (0 au plus près des notes).
 */
export type SlurSpan = { fromAnchor: number; toAnchor: number; opens: boolean; closes: boolean; level: number };

/**
 * Paroles d'un couplet dans un système : ses syllabes, et les prolongations (mélismes).
 * Une prolongation va de la case de sa syllabe (opens), ou du début du système, jusqu'à
 * l'ancre toAnchor comprise ; closes : elle se termine dans ce système.
 */
export type LyricLine = {
  syllables: { anchor: number; text: string; hyphen: boolean }[];
  extenders: { fromAnchor: number; toAnchor: number; opens: boolean; closes: boolean }[];
};

/** Portion d'un jeu des cordes qui dure (étouffé, vibrato) visible dans un système ; opens / closes : il commence / finit dans ce système. */
export type EffectSpan = { kind: EffectKind; fromAnchor: number; toAnchor: number; opens: boolean; closes: boolean };

/** Ligne @ d'une portée : sous ses lignes de notes. lyrics : un couplet par ligne, dans l'ordre. */
export type Voice = { marks: VoiceMark[]; hairpins: HairpinSpan[]; effects: EffectSpan[]; slurs: SlurSpan[]; lyrics: LyricLine[] };

/**
 * Pédale dans un système : ses signes (pour le texte .prisma) et ses traits (pour la gravure).
 * Un trait va de l'ancre où la pédale s'enfonce (-1 : bord gauche, pédale déjà enfoncée)
 * à l'ancre où elle se relâche (-1 : bord droit du système).
 */
export type PedalLine = {
  signs: { anchor: number; text: string }[];
  /** Consignes de pédale (« Ped. simile »…). */
  texts: { anchor: number; text: string }[];
  /** implied : pédale déduite d'un « Ped. simile », gravée atténuée. */
  spans: {
    fromAnchor: number;
    toAnchor: number;
    opens: boolean;
    closes: boolean;
    changeStart: boolean;
    changeEnd: boolean;
    implied?: boolean;
  }[];
};

/**
 * Une portée dans un système. graceDigits : pour chaque ancre, le nombre de chiffres de
 * chaque rang de petites notes. pedal : sa pédale (vide sauf sous la dernière portée d'un piano).
 */
export type SystemStaff = { rows: SystemRow[]; voice: Voice; pedal: PedalLine; graceDigits: number[][] };

export type System = {
  /** Numéro de la mesure par laquelle commence le système. */
  bar: string;
  start: number;
  end: number;
  columns: Column[];
  /** Index, dans columns, de chaque ancre. */
  anchors: number[];
  /** Parties du morceau, dans l'ordre de leurs portées. */
  parts: Part[];
  /** Chaque portée, de haut en bas : ses lignes, ses indications, sa pédale. */
  staves: SystemStaff[];
  marks: Mark[];
  /** Lettre de la section que ce système ouvre (chaque section commence un système). */
  section?: string;
  /** Le système termine une section. */
  endsSection: boolean;
  /** Accords d'accompagnement, sur leur ancre, tels qu'écrits. */
  chords: { anchor: number; text: string }[];
  /** Arpèges du système, sur leur ancre ; part absente : toutes les portées. */
  arpeggios: { anchor: number; staff?: Staff; down: boolean }[];
  /** Largeur naturelle du système, en unités. */
  width: number;
};

/**
 * Plus petit nombre d'ancres qui place tous les événements du temps sur une ancre. Il
 * existe toujours : au pire, une ancre par tick.
 */
function resolution(offsets: number[]): number {
  for (let count = 1; ; count++) {
    if (TICKS_PER_BEAT % count) continue;
    const step = TICKS_PER_BEAT / count;
    if (offsets.every((offset) => offset % step === 0)) return count;
  }
}

/** Découpage effectif d'un temps, pour nommer ses ancres. */
function baseDivision(count: number, def: Division, attacks: number[]): Division {
  if (count % 6 === 0) {
    // découpages binaire et ternaire possibles : on regarde où tombent les attaques
    const third = TICKS_PER_BEAT / 3,
      half = TICKS_PER_BEAT / 2;
    const onThirds = attacks.some((offset) => offset > 0 && offset % third === 0 && offset % half !== 0);
    const onHalf = attacks.includes(half);
    if (onThirds && !onHalf) return 3;
    if (onHalf && !onThirds) return 2;
    return def;
  }
  if (count % 3 === 0) return 3;
  if (count % 2 === 0) return 2;
  return def;
}

/** Nom d'une ancre : chiffre du temps, « * » premier découpage, « . » second, « , » au-delà. */
export function anchorLabel(index: number, count: number, base: Division, beatLabel: number): string {
  if (index === 0) return String(beatLabel);
  if ((index * base) % count === 0) return "*";
  if ((index * base * 2) % count === 0) return ".";
  return ",";
}

/** Les cases d'un temps : leur nombre, et le nom de chacune (chiffre du temps, « * », « . », « , »). */
export type BeatGrid = { count: number; labels: string[] };

const gcd = (first: number, second: number): number => (second ? gcd(second, first % second) : first);
const lcm = (first: number, second: number) => (first / gcd(first, second)) * second;

/**
 * Les cases de chaque temps, telles que les montrent le texte et la gravure : les cases écrites, ou
 * avec une règle détaillée (detail), au moins celles de son niveau. Le découpage ajouté suit celui
 * du temps : un triolet reste en 3 (puis 6), sans mélange de demis et de tiers.
 */
export function beatGrids(score: Score, detail: RulerDetail = "written"): BeatGrid[] {
  const beatTicks = TICKS_PER_BEAT;
  const offsets: number[][] = score.beats.map(() => []);
  const attacks: number[][] = score.beats.map(() => []);
  const add = (tick: number, isAttack: boolean) => {
    const index = Math.floor(tick / beatTicks);
    if (index < 0 || index >= score.beats.length) return;
    const offset = tick - index * beatTicks;
    if (offset) offsets[index].push(offset);
    if (isAttack) attacks[index].push(offset);
  };
  for (const note of score.notes) {
    add(note.start, true);
    add(note.end, false);
  }
  for (const textMark of score.texts) add(textMark.t, false);
  for (const tick of score.fermatas) add(tick, false);
  for (const grace of score.graces) add(grace.t, false);
  for (const arpeggio of score.arpeggios) add(arpeggio.t, false);
  for (const articulation of score.articulations) add(articulation.t, false);
  for (const textMark of score.chords) add(textMark.t, false);
  for (const lyric of score.lyrics) {
    add(lyric.t, false);
    if (lyric.extend !== undefined) add(lyric.extend, false);
  }
  for (const slur of score.slurs) {
    add(slur.start, false);
    add(slur.end, false);
  }
  for (const expression of score.expressions) add(expression.t, false);
  for (const span of [...score.hairpins, ...score.effects]) {
    add(span.start, false);
    add(span.end, false);
  }
  for (const pedal of score.pedals) {
    add(pedal.start, false);
    add(pedal.end, false);
  }
  return score.beats.map((beat, index) => {
    const written = resolution(offsets[index]);
    const own = baseDivision(written, beat.division, attacks[index]);
    const count = detail === "written" ? written : lcm(written, detail === "division" ? own : own * 2);
    const base = baseDivision(count, own, attacks[index]);
    return { count, labels: Array.from({ length: count }, (_, cellIndex) => anchorLabel(cellIndex, count, base, beat.label)) };
  });
}

/** Largeur des cases d'un temps. */
function cellsWidth(beat: number, count: number, metrics: Metrics): number {
  if (!metrics.cellAt) return count * metrics.cell;
  let width = 0;
  for (let index = 0; index < count; index++) width += metrics.cellAt(beatStart(beat) + (index * TICKS_PER_BEAT) / count);
  return width;
}

/** Regroupe les temps par mesure (rang dans le morceau). */
function barsOf(beats: Beat[]): number[][] {
  const bars: number[][] = [];
  beats.forEach((beat, index) => {
    const last = bars[bars.length - 1];
    if (last && beats[last[0]].barIndex === beat.barIndex) last.push(index);
    else bars.push([index]);
  });
  return bars;
}

/** Répartit les temps en systèmes (listes d'index de temps), sans couper une mesure si possible. */
function breakSystems(score: Score, grids: BeatGrid[], metrics: Metrics): number[][] {
  const bars = barsOf(score.beats);
  const avail = metrics.width - metrics.prefix;
  const sectionStarts = new Set(score.markers.map((mk) => mk.barIndex));
  const barEndW = (barIndex: number) => {
    const repeat = repeatOf(score, barIndex);
    const next = repeatOf(score, barIndex + 1);
    return (
      metrics.barSep +
      (repeat?.end ? metrics.repeatDots : 0) +
      (next?.start ? metrics.repeatDots : 0) +
      (sectionStarts.has(barIndex + 1) ? (metrics.sectionSep ?? 0) : 0)
    );
  };
  const beatW = (index: number, last: boolean) => cellsWidth(index, grids[index].count, metrics) + (last ? barEndW(score.beats[index].barIndex) : metrics.beatSep);
  const barW = (bar: number[]) => bar.reduce((total, index, innerIndex) => total + beatW(index, innerIndex === bar.length - 1), 0);
  // une reprise en début de système ajoute « |: » après la barre de gauche
  const leadW = (bar: number[]) => (repeatOf(score, score.beats[bar[0]].barIndex)?.start ? metrics.repeatDots + metrics.beatSep : 0);

  const systems: number[][] = [];
  let current: number[] = [];
  let used = 0;
  const flush = () => {
    if (current.length) systems.push(current);
    current = [];
    used = 0;
  };
  // par défaut, chaque section commence un nouveau système, comme les couplets d'une chanson
  for (const bar of bars) {
    if (metrics.sectionSep === undefined && sectionStarts.has(score.beats[bar[0]].barIndex)) flush();
    const width = barW(bar);
    if (current.length && used + width <= avail) {
      current.push(...bar);
      used += width;
      continue;
    }
    const leadWidth = leadW(bar);
    if (width + leadWidth <= avail) {
      flush();
      current.push(...bar);
      used = width + leadWidth;
      continue;
    }
    // mesure plus large qu'un système : on la coupe sur un temps
    flush();
    used = leadWidth;
    bar.forEach((index, position) => {
      const beatWidth = beatW(index, position === bar.length - 1);
      if (used + beatWidth > avail && current.length) flush();
      current.push(index);
      used += beatWidth;
    });
  }
  flush();
  return systems;
}

/** Une ligne d'un couloir d'octave. */
type Lane = { staff: Staff; octave: number; notes: Note[]; string?: number };

/**
 * Bloc : suite de notes d'un même couloir qui se chevauchent (directement ou de proche
 * en proche). Deux blocs ne sonnent jamais en même temps, ils peuvent donc être rangés
 * indépendamment l'un de l'autre.
 */
type Block = { start: number; end: number; size: number };

/** Couloir d'octave d'une portée : ses lignes et ses blocs. */
type Group = { staff: Staff; octave: number; lanes: Lane[]; blocks: Block[]; string?: number };

/**
 * Répartit les notes d'un système en couloirs (une portée, une octave), puis en lignes
 * (jamais deux notes à la fois sur une ligne).
 *
 * Dans chaque bloc, les notes sont rangées de haut en bas, la plus aiguë en premier :
 * une note seule est toujours sur la ligne du haut, quel que soit le reste du couloir.
 */
function groups(notes: Note[], t0: number, align?: Align, barOf?: (tick: number) => number, strings?: Strings): Group[] {
  if (strings) {
    // une ligne par corde, de l'aiguë à la plus grave
    const used = [...new Set(notes.map((note) => note.string!))].sort((first, second) => first - second);
    return used.map((string) => {
      const list = notes.filter((note) => note.string === string).sort((first, second) => first.start - second.start);
      return {
        staff: list[0].staff,
        octave: CENTRAL_OCTAVE,
        string,
        lanes: [{ staff: list[0].staff, octave: CENTRAL_OCTAVE, string, notes: list }],
        blocks: [],
      };
    });
  }
  const byKey = new Map<string, Note[]>();
  for (const note of notes) {
    const key = note.staff + ":" + octaveOf(note.midi);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(note);
  }
  const out: Group[] = [];
  for (const list of byKey.values()) {
    const startOf = (note: Note) => Math.max(note.start, t0);
    const sorted = [...list].sort((first, second) => startOf(first) - startOf(second) || second.midi - first.midi);
    const group: Group = { staff: sorted[0].staff, octave: octaveOf(sorted[0].midi), lanes: [], blocks: [] };
    if (align) {
      group.lanes = alignedLanes(list, t0, group.staff, group.octave, align === "pitch" ? barOf : undefined);
      out.push(group);
      continue;
    }
    let local: Note[][] = [];
    let block: Block | undefined;
    const flush = () => {
      if (!block) return;
      block.size = local.length;
      group.blocks.push(block);
      local.forEach((notes, index) => {
        if (!group.lanes[index]) group.lanes[index] = { staff: group.staff, octave: group.octave, notes: [] };
        group.lanes[index].notes.push(...notes);
      });
    };
    for (const current of sorted) {
      if (!block || startOf(current) >= block.end) {
        flush();
        block = { start: startOf(current), end: current.end, size: 0 };
        local = [];
      }
      block.end = Math.max(block.end, current.end);
      const lane = local.find((candidate) => candidate.every((note) => note.end <= startOf(current)));
      if (lane) lane.push(current);
      else local.push([current]);
    }
    flush();
    out.push(group);
  }
  return out.sort((first, second) => second.octave - first.octave);
}

/** Silence le plus long entre deux notes de même hauteur qui restent sur la même ligne (notes alignées). */
const ALIGN_GAP = TICKS_PER_BEAT;

/**
 * Lignes d'un couloir, notes alignées : chaque note rejouée (après au plus un temps de
 * silence) reste sur la ligne de la précédente, ce qui forme des chaînes. Deux chaînes qui
 * sonnent ensemble à un instant (barOf donné : qui ont une note dans une même mesure) se rangent
 * l'aiguë au-dessus de la grave ; chacune prend la première ligne sous toutes celles qui
 * doivent être au-dessus d'elle. C'est le moins de lignes possible pour ces chaînes : des
 * lignes restent vides par endroits.
 */
function alignedLanes(list: Note[], t0: number, staff: Staff, octave: number, barOf?: (t: number) => number): Lane[] {
  const startOf = (note: Note) => Math.max(note.start, t0);
  const chains: { midi: number; notes: Note[] }[] = [];
  const last = new Map<number, { midi: number; notes: Note[] }>();
  for (const note of [...list].sort((first, second) => startOf(first) - startOf(second) || second.midi - first.midi)) {
    const known = last.get(note.midi);
    const prev = known?.notes[known.notes.length - 1];
    if (known && prev && startOf(note) >= prev.end && startOf(note) - prev.end <= ALIGN_GAP) known.notes.push(note);
    else {
      const chain = { midi: note.midi, notes: [note] };
      chains.push(chain);
      last.set(note.midi, chain);
    }
  }
  // les mesures où sonne une note : de celle de son attaque à celle où elle s'arrête
  const bars = (note: Note) => [barOf!(startOf(note)), barOf!(Math.max(startOf(note), note.end - 1))];
  const overlap = barOf
    ? (firstNotes: Note[], notes: Note[]) => firstNotes.some((note) => notes.some((other) => bars(note)[0] <= bars(other)[1] && bars(other)[0] <= bars(note)[1]))
    : (notes: Note[], secondNotes: Note[]) => notes.some((note) => secondNotes.some((other) => startOf(note) < other.end && startOf(other) < note.end));
  // de l'aigu au grave : toutes les chaînes à ranger au-dessus d'une chaîne sont déjà placées
  const sorted = [...chains].sort((first, second) => second.midi - first.midi);
  const lane = new Map<(typeof chains)[number], number>();
  for (const chain of sorted) {
    let level = 0;
    for (const above of sorted) {
      if (above.midi <= chain.midi) break;
      if (overlap(above.notes, chain.notes)) level = Math.max(level, lane.get(above)! + 1);
    }
    lane.set(chain, level);
  }
  const lanes: Lane[] = [];
  for (const chain of sorted) {
    const level = lane.get(chain)!;
    for (let index = lanes.length; index <= level; index++) lanes.push({ staff, octave, notes: [] });
    lanes[level].notes.push(...chain.notes);
  }
  for (const row of lanes) row.notes.sort((first, second) => first.start - second.start);
  return lanes;
}

/**
 * Le nombre d'une hauteur sur sa ligne : son numéro dans l'octave, ou sur une corde (strs
 * donné), sa case.
 */
const numberOn = (midi: number, strings?: Strings, string?: number) =>
  strings && string !== undefined ? fretOf(strings, string, midi) : numberOf(midi);

/**
 * Texte d'une attaque : le numéro, puis la voisine d'une trille (« 5~7 ») et le doigt (« 5_3 ») ;
 * avec les parties (parts), la case d'une note jouée sur une corde.
 */
export const noteText = (note: Note, parts?: Part[]) => {
  const strings = parts && note.string !== undefined ? stringsOfStaff(parts, note.staff) : undefined;
  const written = (midi: number) => numberOn(midi, strings, note.string);
  const finger = note.finger ? FINGER_MARK + note.finger : "";
  // les techniques des cordes : étouffée, harmonique, glissé, bend
  if (note.dead) return DEAD_MARK + finger;
  if (note.harmonic) return `<${written(note.midi)}>` + finger;
  // le glissé d'entrée avant la case ; après elle, le glissé vers la note suivante, ou vers rien
  const into = note.slideIn ? slideText(note.slideIn, true) : "";
  if (note.slide || note.slideOut) return into + written(note.midi) + (note.slide ? slideText(note.slide, false) : slideText(note.slideOut!, true)) + finger;
  if (note.bend !== undefined) return into + written(note.midi) + BEND_MARK + written(note.bend) + (note.release ? RELEASE_MARK : "") + finger;
  if (into) return into + written(note.midi) + finger;
  return String(written(note.midi)) + (note.trill !== undefined ? TRILL_MARK + written(note.trill) : "") + finger;
};

function cell(lane: Lane, tick: number, t0: number, parts: Part[]): string {
  const attack = lane.notes.find((note) => note.start === tick);
  if (attack) return noteText(attack, parts);
  // sur une corde, la dernière note attaquée est celle qui sonne
  const held = lane.notes.filter((note) => note.start < tick && note.end > tick).at(-1);
  if (!held) return "";
  return tick === t0 ? "-" + numberOn(held.midi, stringsOfStaff(parts, held.staff), held.string) : "-";
}

export function layout(score: Score, metrics: Metrics): System[] {
  const grids = beatGrids(score, metrics.detail);
  const beatTicks = TICKS_PER_BEAT;
  return breakSystems(score, grids, metrics).map((beatIndexes) => {
    const t0 = beatStart(beatIndexes[0]);
    const t1 = beatStart(beatIndexes[beatIndexes.length - 1] + 1);
    const columns: Column[] = [];
    const anchors: number[] = [];
    let width = metrics.prefix;
    const firstBeat = score.beats[beatIndexes[0]];
    const startsBar = beatIndexes[0] === 0 || score.beats[beatIndexes[0] - 1].barIndex !== firstBeat.barIndex;
    if (startsBar && repeatOf(score, firstBeat.barIndex)?.start) {
      columns.push({ kind: "barSep", lead: true, startRepeat: true });
      width += metrics.repeatDots + metrics.beatSep;
    }
    beatIndexes.forEach((beatIndex, innerIndex) => {
      const beatGrid = grids[beatIndex];
      for (let cellIndex = 0; cellIndex < beatGrid.count; cellIndex++) {
        anchors.push(columns.length);
        const tick = beatStart(beatIndex) + (cellIndex * beatTicks) / beatGrid.count;
        columns.push({ kind: "anchor", t: tick, label: beatGrid.labels[cellIndex], beatIndex, cellIndex, cellCount: beatGrid.count });
        width += metrics.cellAt ? metrics.cellAt(tick) : metrics.cell;
      }
      const barIndex = score.beats[beatIndex].barIndex;
      const barEnd = score.beats[beatIndex + 1]?.barIndex !== barIndex;
      if (!barEnd) {
        columns.push({ kind: "beatSep" });
        width += metrics.beatSep;
        return;
      }
      const lastOfSystem = innerIndex === beatIndexes.length - 1;
      const endRepeat = !!repeatOf(score, barIndex)?.end;
      // « ||: » de la mesure suivante : en fin de système, il passe au début du système suivant
      const startRepeat = !lastOfSystem && !!repeatOf(score, barIndex + 1)?.start;
      const separator: Column = { kind: "barSep" };
      if (endRepeat) separator.endRepeat = true;
      if (startRepeat) separator.startRepeat = true;
      if (beatIndex === score.beats.length - 1) separator.final = true;
      // fin de section : double barre
      else if (!endRepeat && !startRepeat && score.markers.some((mk) => mk.barIndex === barIndex + 1)) separator.section = true;
      // une section qui suit sur la même ligne : un blanc la sépare de la précédente
      const spaced = metrics.sectionSep !== undefined && !lastOfSystem && score.markers.some((mk) => mk.barIndex === barIndex + 1);
      if (spaced) separator.spaced = true;
      columns.push(separator);
      width += metrics.barSep + (endRepeat ? metrics.repeatDots : 0) + (startRepeat ? metrics.repeatDots : 0) + (spaced ? metrics.sectionSep! : 0);
    });

    const inSystem = score.notes.filter((note) => note.start < t1 && note.end > t0);
    const anchorTicks = anchors.map((columnIndex) => (columns[columnIndex] as { t: number }).t);
    const digits = (staff: Staff) => anchorTicks.map((tick) => graceDigits(score.graces, staff, tick, score.parts));
    const barOf = (tick: number) => score.beats[Math.min(score.beats.length - 1, Math.floor(tick / beatTicks))].barIndex;
    const toRows = (staff: Staff): SystemRow[] => {
      const strings = stringsOfStaff(score.parts, staff);
      const staffGroups = groups(
        inSystem.filter((note) => note.staff === staff),
        t0,
        metrics.align,
        barOf,
        strings,
      );
      // toutes les cordes, à la gravure : une tablature se lit sur une grille fixe
      if (strings && metrics.allStrings) {
        for (let string = 1; string <= strings.open.length; string++) {
          if (!staffGroups.some((group) => group.string === string))
            staffGroups.push({ staff, octave: CENTRAL_OCTAVE, string, lanes: [{ staff, octave: CENTRAL_OCTAVE, string, notes: [] }], blocks: [] });
        }
        staffGroups.sort((first, second) => first.string! - second.string!);
      }
      // petites notes : sur la première ligne libre de leur couloir d'octave (créé au besoin)
      const graces = score.graces.filter((grace) => grace.staff === staff && grace.t >= t0 && grace.t < t1);
      const slotsAt = digits(staff);
      const placed = new Map<Lane, string[][]>();
      for (const grace of graces) {
        const octave = strings ? CENTRAL_OCTAVE : octaveOf(grace.midi);
        // sur une corde : la ligne de sa corde
        let group = strings ? staffGroups.find((candidate) => candidate.string === grace.string) : staffGroups.find((candidate) => candidate.octave === octave);
        if (!group) {
          group = strings
            ? { staff, octave, string: grace.string, lanes: [{ staff, octave, string: grace.string, notes: [] }], blocks: [] }
            : { staff, octave, lanes: [], blocks: [] };
          staffGroups.push(group);
          staffGroups.sort((first, second) => (strings ? first.string! - second.string! : second.octave - first.octave));
        }
        const anchor = anchorTicks.indexOf(grace.t);
        let lane = group.lanes.find((candidate) => !placed.get(candidate)?.[anchor]?.[grace.slot]);
        if (!lane && strings) continue; // une corde ne joue qu'une petite note à la fois
        if (!lane) {
          lane = { staff, octave, notes: [] };
          group.lanes.push(lane);
        }
        if (!placed.has(lane))
          placed.set(
            lane,
            anchorTicks.map(() => []),
          );
        const cellGraces = placed.get(lane)![anchor];
        while (cellGraces.length < slotsAt[anchor].length) cellGraces.push("");
        cellGraces[grace.slot] = String(numberOn(grace.midi, strings, grace.string));
      }
      return staffGroups.flatMap((group) =>
        group.lanes.map((lane, index) => ({
          staff,
          octave: group.octave,
          ...(group.string !== undefined ? { string: group.string } : {}),
          showOctave: index === 0,
          cells: anchorTicks.map((tick) => cell(lane, tick, t0, score.parts)),
          trill: anchorTicks.map((tick) => lane.notes.some((note) => note.trill !== undefined && note.start <= tick && note.end > tick)),
          graces: placed.get(lane) ?? anchorTicks.map(() => []),
          // décalage pour centrer chaque bloc dans son couloir (rendu graphique, option)
          center: anchors.map((columnIndex) => {
            const tick = (columns[columnIndex] as { t: number }).t;
            const block = group.blocks.find((candidate) => candidate.start <= tick && tick < candidate.end);
            return block ? (group.lanes.length - block.size) / 2 : 0;
          }),
        })),
      );
    };

    // ancres de chaque mesure du système
    const barAnchors = new Map<number, number[]>();
    anchors.forEach((columnIndex, anchor) => {
      const beatIndex = (columns[columnIndex] as { beatIndex: number }).beatIndex;
      const bar = score.beats[beatIndex].barIndex;
      if (!barAnchors.has(bar)) barAnchors.set(bar, []);
      barAnchors.get(bar)!.push(anchor);
    });
    const firstAnchorOfBar = (bar: number) => {
      const list = barAnchors.get(bar);
      if (!list) return undefined;
      // seulement si la mesure commence bien dans ce système
      const columnIndex = anchors[list[0]];
      const column = columns[columnIndex] as { cellIndex: number; beatIndex: number };
      const beat = score.beats[column.beatIndex];
      const prev = score.beats[column.beatIndex - 1];
      return column.cellIndex === 0 && (!prev || prev.barIndex !== beat.barIndex) ? list[0] : undefined;
    };
    const lastAnchorOfBar = (bar: number) => {
      const list = barAnchors.get(bar);
      if (!list) return undefined;
      const anchor = list[list.length - 1];
      const beatIndex = (columns[anchors[anchor]] as { beatIndex: number }).beatIndex;
      return score.beats[beatIndex + 1]?.barIndex !== bar ? anchor : undefined; // la mesure se termine dans ce système
    };

    const marks: Mark[] = [];
    for (const repeat of score.repeats) {
      if (!repeat.end || !repeat.times || repeat.times === 2) continue;
      const anchor = lastAnchorOfBar(repeat.barIndex);
      if (anchor !== undefined) marks.push({ anchor, text: `${repeat.times}×`, kind: "times" });
    }
    // début de section : sa lettre en tête du système, ou contre la barre qui l'ouvre en cours de ligne
    const section = score.markers.find((mk) => firstAnchorOfBar(mk.barIndex) === 0);
    if (section) marks.push({ column: -1, text: `[${section.label}]`, kind: "marker", label: section.label });
    for (const mk of score.markers) {
      const anchor = firstAnchorOfBar(mk.barIndex);
      if (anchor === undefined || anchor === 0) continue;
      let column = anchors[anchor] - 1;
      while (column > 0 && columns[column].kind !== "barSep") column--;
      marks.push({ column, text: `[${mk.label}]`, kind: "marker", label: mk.label });
    }
    for (const tick of score.fermatas) {
      const anchor = anchors.findIndex((columnIndex) => (columns[columnIndex] as { t: number }).t === tick);
      if (anchor >= 0) marks.push({ anchor, text: "^", kind: "fermata" });
    }
    const arpeggios: System["arpeggios"] = [];
    for (const arpeggio of score.arpeggios) {
      const anchor = anchorTicks.indexOf(arpeggio.t);
      if (anchor < 0) continue;
      arpeggios.push({ anchor, ...(arpeggio.staff !== undefined ? { staff: arpeggio.staff } : {}), down: !!arpeggio.down });
      if (arpeggio.staff === undefined) marks.push({ anchor, text: arpeggio.down ? ARPEGGIO_DOWN : ARPEGGIO_UP, kind: "arpeggio" });
    }
    for (const textMark of score.texts) {
      const anchor = anchors.findIndex((columnIndex) => (columns[columnIndex] as { t: number }).t === textMark.t);
      if (anchor >= 0) marks.push({ anchor, text: textMark.text, kind: "text" });
    }
    marks.sort((first, second) => markColumn({ anchors }, first) - markColumn({ anchors }, second));

    const anchorAt = (tick: number) => anchors.findIndex((columnIndex) => (columns[columnIndex] as { t: number }).t === tick);
    const lastAnchorBefore = (tick: number) => {
      let anchor = -1;
      anchors.forEach((columnIndex, index) => {
        if ((columns[columnIndex] as { t: number }).t < tick) anchor = index;
      });
      return anchor;
    };
    // liaisons : les plus courtes d'abord, chacune au premier étage où elle ne touche aucune autre
    const slurSpans = (staff: Staff): SlurSpan[] => {
      const spans = score.slurs
        .filter((slur) => slur.staff === staff && slur.start < t1 && slur.end >= t0)
        .map((slur) => ({
          fromAnchor: anchorAt(Math.max(slur.start, t0)),
          toAnchor: slur.end < t1 ? anchorAt(slur.end) : anchors.length - 1,
          opens: slur.start >= t0,
          closes: slur.end < t1,
          level: 0,
        }))
        .filter((span) => span.fromAnchor >= 0 && span.toAnchor >= span.fromAnchor);
      const placed: SlurSpan[] = [];
      for (const span of [...spans].sort((first, second) => first.toAnchor - first.fromAnchor - (second.toAnchor - second.fromAnchor))) {
        // deux liaisons qui se touchent seulement (l'une finit sur la note où l'autre commence) restent au même étage
        while (placed.some((slurSpan) => slurSpan.level === span.level && slurSpan.fromAnchor < span.toAnchor && span.fromAnchor < slurSpan.toAnchor)) span.level++;
        placed.push(span);
      }
      return spans;
    };
    // paroles : autant de lignes que le plus haut couplet présent dans le système
    const lyricLines = (staff: Staff): LyricLine[] => {
      const here = score.lyrics.filter(
        (lyric) => lyric.staff === staff && ((lyric.t >= t0 && lyric.t < t1) || (lyric.t < t0 && lyric.extend !== undefined && lyric.extend > t0)),
      );
      const verses = Math.max(0, ...here.map((lyric) => lyric.verse));
      return Array.from({ length: verses }, (_, verseIndex) => {
        const mine = here.filter((lyric) => lyric.verse === verseIndex + 1);
        return {
          syllables: mine.filter((lyric) => lyric.t >= t0).map((lyric) => ({ anchor: anchorAt(lyric.t), text: lyric.text, hyphen: !!lyric.hyphen })),
          extenders: mine
            .filter((lyric) => lyric.extend !== undefined)
            .map((lyric) => ({
              fromAnchor: lyric.t >= t0 ? anchorAt(lyric.t) : 0,
              toAnchor: lyric.extend! < t1 ? lastAnchorBefore(lyric.extend!) : anchors.length - 1,
              opens: lyric.t >= t0,
              closes: lyric.extend! <= t1,
            })),
        };
      });
    };
    const voice = (staff: Staff): Voice => ({
      marks: score.expressions
        .filter((expression) => expression.staff === staff)
        .map((expression): VoiceMark => ({ anchor: anchorAt(expression.t), text: expression.text, kind: expression.kind }))
        .concat(
          score.arpeggios
            .filter((arpeggio) => arpeggio.staff === staff)
            .map((arpeggio) => ({ anchor: anchorAt(arpeggio.t), text: arpeggio.down ? ARPEGGIO_DOWN : ARPEGGIO_UP, kind: "arpeggio" as const })),
          score.articulations
            .filter((articulation) => articulation.staff === staff)
            .map((articulation) => ({ anchor: anchorAt(articulation.t), text: ARTICULATION_SIGNS[articulation.kind], kind: "articulation" as const })),
        )
        .filter((voiceMark) => voiceMark.anchor >= 0)
        .sort((first, second) => first.anchor - second.anchor),
      hairpins: score.hairpins
        .filter((hairpin) => hairpin.staff === staff && hairpin.start < t1 && hairpin.end > t0 && hairpin.end > hairpin.start)
        .map((hairpin) => {
          const start = Math.max(hairpin.start, t0),
            end = Math.min(hairpin.end, t1);
          return {
            kind: hairpin.kind,
            fromAnchor: anchorAt(start),
            toAnchor: lastAnchorBefore(end),
            from: (start - hairpin.start) / (hairpin.end - hairpin.start),
            to: (end - hairpin.start) / (hairpin.end - hairpin.start),
          };
        })
        .filter((span) => span.fromAnchor >= 0 && span.toAnchor >= span.fromAnchor),
      effects: score.effects
        .filter((effect) => effect.staff === staff && effect.start < t1 && effect.end > t0 && effect.end > effect.start)
        .map((effect) => ({
          kind: effect.kind,
          fromAnchor: anchorAt(Math.max(effect.start, t0)),
          toAnchor: lastAnchorBefore(Math.min(effect.end, t1)),
          opens: effect.start >= t0,
          closes: effect.end <= t1,
        }))
        .filter((span) => span.fromAnchor >= 0 && span.toAnchor >= span.fromAnchor),
      slurs: slurSpans(staff),
      lyrics: lyricLines(staff),
    });

    // pédale d'une portée : ses signes (pour le texte .prisma) et ses traits (pour la gravure)
    const pedalLine = (staff: Staff): PedalLine => {
      const pedals = score.pedals.filter((pedal) => pedal.staff === staff);
      const signs: PedalLine["signs"] = [];
      const spans: PedalLine["spans"] = [];
      for (const current of pedals) {
        const change = (tick: number) => pedals.some((pedal) => pedal !== current && (pedal.end === tick || pedal.start === tick));
        if (current.start >= t0 && current.start < t1) {
          const anchor = anchorAt(current.start);
          if (anchor >= 0) signs.push({ anchor, text: pedals.some((pedal) => pedal.end === current.start) ? PEDAL_CHANGE : PEDAL_DOWN });
        }
        // relâchée à un instant où une autre pédale s'enfonce : c'est ce changement qui l'écrit
        if (current.end >= t0 && current.end < t1 && !pedals.some((pedal) => pedal.start === current.end)) {
          const anchor = anchorAt(current.end);
          if (anchor >= 0) signs.push({ anchor, text: PEDAL_UP });
        }
        if (current.start < t1 && current.end > t0) {
          const opens = current.start >= t0,
            closes = current.end <= t1;
          spans.push({
            fromAnchor: opens ? anchorAt(current.start) : -1,
            toAnchor: current.end < t1 ? anchorAt(current.end) : -1,
            opens,
            closes,
            changeStart: opens && change(current.start),
            changeEnd: closes && change(current.end),
            ...(current.implied ? { implied: true } : {}),
          });
        }
      }
      signs.sort((first, second) => first.anchor - second.anchor);
      const texts = score.pedalTexts
        .filter((pedalText) => pedalText.staff === staff)
        .map((pedalText) => ({ anchor: anchorAt(pedalText.t), text: pedalText.text }))
        .filter((text) => text.anchor >= 0);
      return { signs, spans, texts };
    };

    return {
      bar: firstBeat.bar,
      start: t0,
      end: t1,
      columns,
      anchors,
      parts: score.parts,
      staves: Array.from({ length: staffCount(score.parts) }, (_, staff) => ({
        rows: toRows(staff),
        voice: voice(staff),
        pedal: pedalLine(staff),
        graceDigits: digits(staff),
      })),
      marks,
      section: section?.label,
      endsSection: score.markers.some((mk) => mk.barIndex > 0 && lastAnchorOfBar(mk.barIndex - 1) === anchors.length - 1),
      arpeggios,
      chords: score.chords.map((textMark) => ({ anchor: anchorTicks.indexOf(textMark.t), text: textMark.text })).filter((chord) => chord.anchor >= 0),
      width,
    };
  });
}
