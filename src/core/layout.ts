/**
 * Mise en page : découpe le morceau en systèmes qui tiennent dans une largeur donnée,
 * et calcule pour chaque système ses ancres, ses lignes et le contenu de chaque case.
 *
 * Le moteur ne connaît que des « unités » de largeur : des caractères pour le texte,
 * des millimètres pour le rendu graphique. Seules les mesures changent.
 */
import { ARPEGGIO_DOWN, ARPEGGIO_UP, ARTICULATION_SIGNS, BEND_MARK, DEAD_MARK, FINGER_MARK, RELEASE_MARK, slideText, staffCount, stringsOfStaff, PEDAL_CHANGE, PEDAL_DOWN, PEDAL_UP, TICKS_PER_BEAT, TRILL_MARK, beatStart, graceDigits, repeatOf } from "./model.ts";
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
};

export type Align = "replayed" | "pitch";

export type Column =
  | { kind: "anchor"; t: number; label: string; beatIndex: number; k: number; n: number }
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
export const markColumn = (sys: { anchors: number[] }, m: Mark) => (m.anchor !== undefined ? sys.anchors[m.anchor] : m.column!);

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
  spans: { fromAnchor: number; toAnchor: number; opens: boolean; closes: boolean; changeStart: boolean; changeEnd: boolean; implied?: boolean }[];
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
  for (let n = 1; ; n++) {
    if (TICKS_PER_BEAT % n) continue;
    const step = TICKS_PER_BEAT / n;
    if (offsets.every((o) => o % step === 0)) return n;
  }
}

/** Découpage effectif d'un temps, pour nommer ses ancres. */
function baseDivision(n: number, def: Division, attacks: number[]): Division {
  if (n % 6 === 0) {
    // découpages binaire et ternaire possibles : on regarde où tombent les attaques
    const third = TICKS_PER_BEAT / 3, half = TICKS_PER_BEAT / 2;
    const onThirds = attacks.some((o) => o > 0 && o % third === 0 && o % half !== 0);
    const onHalf = attacks.includes(half);
    if (onThirds && !onHalf) return 3;
    if (onHalf && !onThirds) return 2;
    return def;
  }
  if (n % 3 === 0) return 3;
  if (n % 2 === 0) return 2;
  return def;
}

/** Nom d'une ancre : chiffre du temps, « * » premier découpage, « . » second, « , » au-delà. */
export function anchorLabel(k: number, n: number, base: Division, beatLabel: number): string {
  if (k === 0) return String(beatLabel);
  if ((k * base) % n === 0) return "*";
  if ((k * base * 2) % n === 0) return ".";
  return ",";
}

/** Les cases d'un temps : leur nombre, et le nom de chacune (chiffre du temps, « * », « . », « , »). */
export type BeatGrid = { n: number; labels: string[] };

/** Les cases écrites de chaque temps, telles que les montrent le texte et la gravure. */
export function beatGrids(score: Score): BeatGrid[] {
  const T = TICKS_PER_BEAT;
  const offsets: number[][] = score.beats.map(() => []);
  const attacks: number[][] = score.beats.map(() => []);
  const add = (t: number, isAttack: boolean) => {
    const i = Math.floor(t / T);
    if (i < 0 || i >= score.beats.length) return;
    const o = t - i * T;
    if (o) offsets[i].push(o);
    if (isAttack) attacks[i].push(o);
  };
  for (const n of score.notes) {
    add(n.start, true);
    add(n.end, false);
  }
  for (const m of score.texts) add(m.t, false);
  for (const t of score.fermatas) add(t, false);
  for (const g of score.graces) add(g.t, false);
  for (const x of score.arpeggios) add(x.t, false);
  for (const x of score.articulations) add(x.t, false);
  for (const c of score.chords) add(c.t, false);
  for (const l of score.lyrics) {
    add(l.t, false);
    if (l.extend !== undefined) add(l.extend, false);
  }
  for (const s of score.slurs) {
    add(s.start, false);
    add(s.end, false);
  }
  for (const e of score.expressions) add(e.t, false);
  for (const h of [...score.hairpins, ...score.effects]) {
    add(h.start, false);
    add(h.end, false);
  }
  for (const p of score.pedals) {
    add(p.start, false);
    add(p.end, false);
  }
  return score.beats.map((b, i) => {
    const n = resolution(offsets[i]);
    const base = baseDivision(n, b.division, attacks[i]);
    return { n, labels: Array.from({ length: n }, (_, k) => anchorLabel(k, n, base, b.label)) };
  });
}

/** Largeur des cases d'un temps. */
function cellsWidth(beat: number, n: number, m: Metrics): number {
  if (!m.cellAt) return n * m.cell;
  let w = 0;
  for (let k = 0; k < n; k++) w += m.cellAt(beatStart(beat) + (k * TICKS_PER_BEAT) / n);
  return w;
}

/** Regroupe les temps par mesure (rang dans le morceau). */
function barsOf(beats: Beat[]): number[][] {
  const bars: number[][] = [];
  beats.forEach((b, i) => {
    const last = bars[bars.length - 1];
    if (last && beats[last[0]].barIndex === b.barIndex) last.push(i);
    else bars.push([i]);
  });
  return bars;
}

/** Répartit les temps en systèmes (listes d'index de temps), sans couper une mesure si possible. */
function breakSystems(score: Score, grids: BeatGrid[], m: Metrics): number[][] {
  const bars = barsOf(score.beats);
  const avail = m.width - m.prefix;
  const sectionStarts = new Set(score.markers.map((mk) => mk.barIndex));
  const barEndW = (barIndex: number) => {
    const r = repeatOf(score, barIndex);
    const next = repeatOf(score, barIndex + 1);
    return m.barSep + (r?.end ? m.repeatDots : 0) + (next?.start ? m.repeatDots : 0) + (sectionStarts.has(barIndex + 1) ? (m.sectionSep ?? 0) : 0);
  };
  const beatW = (i: number, last: boolean) =>
    cellsWidth(i, grids[i].n, m) + (last ? barEndW(score.beats[i].barIndex) : m.beatSep);
  const barW = (bar: number[]) => bar.reduce((s, i, j) => s + beatW(i, j === bar.length - 1), 0);
  // une reprise en début de système ajoute « |: » après la barre de gauche
  const leadW = (bar: number[]) => (repeatOf(score, score.beats[bar[0]].barIndex)?.start ? m.repeatDots + m.beatSep : 0);

  const systems: number[][] = [];
  let cur: number[] = [];
  let used = 0;
  const flush = () => {
    if (cur.length) systems.push(cur);
    cur = [];
    used = 0;
  };
  // par défaut, chaque section commence un nouveau système, comme les couplets d'une chanson
  for (const bar of bars) {
    if (m.sectionSep === undefined && sectionStarts.has(score.beats[bar[0]].barIndex)) flush();
    const w = barW(bar);
    if (cur.length && used + w <= avail) {
      cur.push(...bar);
      used += w;
      continue;
    }
    const lw = leadW(bar);
    if (w + lw <= avail) {
      flush();
      cur.push(...bar);
      used = w + lw;
      continue;
    }
    // mesure plus large qu'un système : on la coupe sur un temps
    flush();
    used = lw;
    bar.forEach((i, j) => {
      const bw = beatW(i, j === bar.length - 1);
      if (used + bw > avail && cur.length) flush();
      cur.push(i);
      used += bw;
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
function groups(notes: Note[], t0: number, align?: Align, barOf?: (t: number) => number, strs?: Strings): Group[] {
  if (strs) {
    // une ligne par corde, de l'aiguë à la plus grave
    const used = [...new Set(notes.map((n) => n.string!))].sort((a, b) => a - b);
    return used.map((string) => {
      const list = notes.filter((n) => n.string === string).sort((a, b) => a.start - b.start);
      return { staff: list[0].staff, octave: CENTRAL_OCTAVE, string, lanes: [{ staff: list[0].staff, octave: CENTRAL_OCTAVE, string, notes: list }], blocks: [] };
    });
  }
  const byKey = new Map<string, Note[]>();
  for (const n of notes) {
    const key = n.staff + ":" + octaveOf(n.midi);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(n);
  }
  const out: Group[] = [];
  for (const list of byKey.values()) {
    const s = (n: Note) => Math.max(n.start, t0);
    const sorted = [...list].sort((a, b) => s(a) - s(b) || b.midi - a.midi);
    const g: Group = { staff: sorted[0].staff, octave: octaveOf(sorted[0].midi), lanes: [], blocks: [] };
    if (align) {
      g.lanes = alignedLanes(list, t0, g.staff, g.octave, align === "pitch" ? barOf : undefined);
      out.push(g);
      continue;
    }
    let local: Note[][] = [];
    let block: Block | undefined;
    const flush = () => {
      if (!block) return;
      block.size = local.length;
      g.blocks.push(block);
      local.forEach((notes, i) => {
        if (!g.lanes[i]) g.lanes[i] = { staff: g.staff, octave: g.octave, notes: [] };
        g.lanes[i].notes.push(...notes);
      });
    };
    for (const n of sorted) {
      if (!block || s(n) >= block.end) {
        flush();
        block = { start: s(n), end: n.end, size: 0 };
        local = [];
      }
      block.end = Math.max(block.end, n.end);
      const lane = local.find((l) => l.every((m) => m.end <= s(n)));
      if (lane) lane.push(n);
      else local.push([n]);
    }
    flush();
    out.push(g);
  }
  return out.sort((a, b) => b.octave - a.octave);
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
  const s = (n: Note) => Math.max(n.start, t0);
  const chains: { midi: number; notes: Note[] }[] = [];
  const last = new Map<number, { midi: number; notes: Note[] }>();
  for (const n of [...list].sort((a, b) => s(a) - s(b) || b.midi - a.midi)) {
    const c = last.get(n.midi);
    const prev = c?.notes[c.notes.length - 1];
    if (c && prev && s(n) >= prev.end && s(n) - prev.end <= ALIGN_GAP) c.notes.push(n);
    else {
      const chain = { midi: n.midi, notes: [n] };
      chains.push(chain);
      last.set(n.midi, chain);
    }
  }
  // les mesures où sonne une note : de celle de son attaque à celle où elle s'arrête
  const bars = (x: Note) => [barOf!(s(x)), barOf!(Math.max(s(x), x.end - 1))];
  const overlap = barOf
    ? (a: Note[], b: Note[]) => a.some((x) => b.some((y) => bars(x)[0] <= bars(y)[1] && bars(y)[0] <= bars(x)[1]))
    : (a: Note[], b: Note[]) => a.some((x) => b.some((y) => s(x) < y.end && s(y) < x.end));
  // de l'aigu au grave : toutes les chaînes à ranger au-dessus d'une chaîne sont déjà placées
  const sorted = [...chains].sort((a, b) => b.midi - a.midi);
  const lane = new Map<(typeof chains)[number], number>();
  for (const c of sorted) {
    let k = 0;
    for (const above of sorted) {
      if (above.midi <= c.midi) break;
      if (overlap(above.notes, c.notes)) k = Math.max(k, lane.get(above)! + 1);
    }
    lane.set(c, k);
  }
  const lanes: Lane[] = [];
  for (const c of sorted) {
    const k = lane.get(c)!;
    for (let i = lanes.length; i <= k; i++) lanes.push({ staff, octave, notes: [] });
    lanes[k].notes.push(...c.notes);
  }
  for (const l of lanes) l.notes.sort((a, b) => a.start - b.start);
  return lanes;
}

/**
 * Le nombre d'une hauteur sur sa ligne : son numéro dans l'octave, ou sur une corde (strs
 * donné), sa case.
 */
const numberOn = (midi: number, strs?: Strings, string?: number) => (strs && string !== undefined ? fretOf(strs, string, midi) : numberOf(midi));

/**
 * Texte d'une attaque : le numéro, puis la voisine d'une trille (« 5~7 ») et le doigt (« 5_3 ») ;
 * avec les parties (parts), la case d'une note jouée sur une corde.
 */
export const noteText = (n: Note, parts?: Part[]) => {
  const strs = parts && n.string !== undefined ? stringsOfStaff(parts, n.staff) : undefined;
  const k = (midi: number) => numberOn(midi, strs, n.string);
  const finger = n.finger ? FINGER_MARK + n.finger : "";
  // les techniques des cordes : étouffée, harmonique, glissé, bend
  if (n.dead) return DEAD_MARK + finger;
  if (n.harmonic) return `<${k(n.midi)}>` + finger;
  // le glissé d'entrée avant la case ; après elle, le glissé vers la note suivante, ou vers rien
  const into = n.slideIn ? slideText(n.slideIn, true) : "";
  if (n.slide || n.slideOut) return into + k(n.midi) + (n.slide ? slideText(n.slide, false) : slideText(n.slideOut!, true)) + finger;
  if (n.bend !== undefined) return into + k(n.midi) + BEND_MARK + k(n.bend) + (n.release ? RELEASE_MARK : "") + finger;
  if (into) return into + k(n.midi) + finger;
  return String(k(n.midi)) + (n.trill !== undefined ? TRILL_MARK + k(n.trill) : "") + finger;
};

function cell(lane: Lane, t: number, t0: number, parts: Part[]): string {
  const attack = lane.notes.find((n) => n.start === t);
  if (attack) return noteText(attack, parts);
  // sur une corde, la dernière note attaquée est celle qui sonne
  const held = lane.notes.filter((n) => n.start < t && n.end > t).at(-1);
  if (!held) return "";
  return t === t0 ? "-" + numberOn(held.midi, stringsOfStaff(parts, held.staff), held.string) : "-";
}

export function layout(score: Score, m: Metrics): System[] {
  const grids = beatGrids(score);
  const T = TICKS_PER_BEAT;
  return breakSystems(score, grids, m).map((beatIdx) => {
    const t0 = beatStart(beatIdx[0]);
    const t1 = beatStart(beatIdx[beatIdx.length - 1] + 1);
    const columns: Column[] = [];
    const anchors: number[] = [];
    let width = m.prefix;
    const firstBeat = score.beats[beatIdx[0]];
    const startsBar = beatIdx[0] === 0 || score.beats[beatIdx[0] - 1].barIndex !== firstBeat.barIndex;
    if (startsBar && repeatOf(score, firstBeat.barIndex)?.start) {
      columns.push({ kind: "barSep", lead: true, startRepeat: true });
      width += m.repeatDots + m.beatSep;
    }
    beatIdx.forEach((bi, j) => {
      const g = grids[bi];
      for (let k = 0; k < g.n; k++) {
        anchors.push(columns.length);
        const t = beatStart(bi) + (k * T) / g.n;
        columns.push({ kind: "anchor", t, label: g.labels[k], beatIndex: bi, k, n: g.n });
        width += m.cellAt ? m.cellAt(t) : m.cell;
      }
      const barIndex = score.beats[bi].barIndex;
      const barEnd = score.beats[bi + 1]?.barIndex !== barIndex;
      if (!barEnd) {
        columns.push({ kind: "beatSep" });
        width += m.beatSep;
        return;
      }
      const lastOfSystem = j === beatIdx.length - 1;
      const endRepeat = !!repeatOf(score, barIndex)?.end;
      // « ||: » de la mesure suivante : en fin de système, il passe au début du système suivant
      const startRepeat = !lastOfSystem && !!repeatOf(score, barIndex + 1)?.start;
      const col: Column = { kind: "barSep" };
      if (endRepeat) col.endRepeat = true;
      if (startRepeat) col.startRepeat = true;
      if (bi === score.beats.length - 1) col.final = true;
      // fin de section : double barre
      else if (!endRepeat && !startRepeat && score.markers.some((mk) => mk.barIndex === barIndex + 1)) col.section = true;
      // une section qui suit sur la même ligne : un blanc la sépare de la précédente
      const spaced = m.sectionSep !== undefined && !lastOfSystem && score.markers.some((mk) => mk.barIndex === barIndex + 1);
      if (spaced) col.spaced = true;
      columns.push(col);
      width += m.barSep + (endRepeat ? m.repeatDots : 0) + (startRepeat ? m.repeatDots : 0) + (spaced ? m.sectionSep! : 0);
    });

    const inSystem = score.notes.filter((n) => n.start < t1 && n.end > t0);
    const anchorT = anchors.map((ci) => (columns[ci] as { t: number }).t);
    const digits = (staff: Staff) => anchorT.map((t) => graceDigits(score.graces, staff, t, score.parts));
    const barOf = (t: number) => score.beats[Math.min(score.beats.length - 1, Math.floor(t / T))].barIndex;
    const toRows = (staff: Staff): SystemRow[] => {
      const strs = stringsOfStaff(score.parts, staff);
      const gs = groups(inSystem.filter((n) => n.staff === staff), t0, m.align, barOf, strs);
      // toutes les cordes, à la gravure : une tablature se lit sur une grille fixe
      if (strs && m.allStrings) {
        for (let string = 1; string <= strs.open.length; string++) {
          if (!gs.some((g) => g.string === string)) gs.push({ staff, octave: CENTRAL_OCTAVE, string, lanes: [{ staff, octave: CENTRAL_OCTAVE, string, notes: [] }], blocks: [] });
        }
        gs.sort((a, b) => a.string! - b.string!);
      }
      // petites notes : sur la première ligne libre de leur couloir d'octave (créé au besoin)
      const graces = score.graces.filter((g) => g.staff === staff && g.t >= t0 && g.t < t1);
      const slotsAt = digits(staff);
      const placed = new Map<Lane, string[][]>();
      for (const g of graces) {
        const octave = strs ? CENTRAL_OCTAVE : octaveOf(g.midi);
        // sur une corde : la ligne de sa corde
        let group = strs ? gs.find((x) => x.string === g.string) : gs.find((x) => x.octave === octave);
        if (!group) {
          group = strs ? { staff, octave, string: g.string, lanes: [{ staff, octave, string: g.string, notes: [] }], blocks: [] } : { staff, octave, lanes: [], blocks: [] };
          gs.push(group);
          gs.sort((x, y) => (strs ? x.string! - y.string! : y.octave - x.octave));
        }
        const a = anchorT.indexOf(g.t);
        let lane = group.lanes.find((l) => !placed.get(l)?.[a]?.[g.slot]);
        if (!lane && strs) continue; // une corde ne joue qu'une petite note à la fois
        if (!lane) {
          lane = { staff, octave, notes: [] };
          group.lanes.push(lane);
        }
        if (!placed.has(lane)) placed.set(lane, anchorT.map(() => []));
        const cellGraces = placed.get(lane)![a];
        while (cellGraces.length < slotsAt[a].length) cellGraces.push("");
        cellGraces[g.slot] = String(numberOn(g.midi, strs, g.string));
      }
      return gs.flatMap((g) =>
        g.lanes.map((lane, i) => ({
          staff,
          octave: g.octave,
          ...(g.string !== undefined ? { string: g.string } : {}),
          showOctave: i === 0,
          cells: anchorT.map((t) => cell(lane, t, t0, score.parts)),
          trill: anchorT.map((t) => lane.notes.some((n) => n.trill !== undefined && n.start <= t && n.end > t)),
          graces: placed.get(lane) ?? anchorT.map(() => []),
          // décalage pour centrer chaque bloc dans son couloir (rendu graphique, option)
          center: anchors.map((ci) => {
            const t = (columns[ci] as { t: number }).t;
            const b = g.blocks.find((x) => x.start <= t && t < x.end);
            return b ? (g.lanes.length - b.size) / 2 : 0;
          }),
        })),
      );
    };

    // ancres de chaque mesure du système
    const barAnchors = new Map<number, number[]>();
    anchors.forEach((ci, a) => {
      const bi = (columns[ci] as { beatIndex: number }).beatIndex;
      const bar = score.beats[bi].barIndex;
      if (!barAnchors.has(bar)) barAnchors.set(bar, []);
      barAnchors.get(bar)!.push(a);
    });
    const firstAnchorOfBar = (bar: number) => {
      const list = barAnchors.get(bar);
      if (!list) return undefined;
      // seulement si la mesure commence bien dans ce système
      const ci = anchors[list[0]];
      const col = columns[ci] as { k: number; beatIndex: number };
      const b = score.beats[col.beatIndex];
      const prev = score.beats[col.beatIndex - 1];
      return col.k === 0 && (!prev || prev.barIndex !== b.barIndex) ? list[0] : undefined;
    };
    const lastAnchorOfBar = (bar: number) => {
      const list = barAnchors.get(bar);
      if (!list) return undefined;
      const a = list[list.length - 1];
      const bi = (columns[anchors[a]] as { beatIndex: number }).beatIndex;
      return score.beats[bi + 1]?.barIndex !== bar ? a : undefined; // la mesure se termine dans ce système
    };

    const marks: Mark[] = [];
    for (const r of score.repeats) {
      if (!r.end || !r.times || r.times === 2) continue;
      const a = lastAnchorOfBar(r.barIndex);
      if (a !== undefined) marks.push({ anchor: a, text: `${r.times}×`, kind: "times" });
    }
    // début de section : sa lettre en tête du système, ou contre la barre qui l'ouvre en cours de ligne
    const section = score.markers.find((mk) => firstAnchorOfBar(mk.barIndex) === 0);
    if (section) marks.push({ column: -1, text: `[${section.label}]`, kind: "marker", label: section.label });
    for (const mk of score.markers) {
      const a = firstAnchorOfBar(mk.barIndex);
      if (a === undefined || a === 0) continue;
      let column = anchors[a] - 1;
      while (column > 0 && columns[column].kind !== "barSep") column--;
      marks.push({ column, text: `[${mk.label}]`, kind: "marker", label: mk.label });
    }
    for (const t of score.fermatas) {
      const a = anchors.findIndex((ci) => (columns[ci] as { t: number }).t === t);
      if (a >= 0) marks.push({ anchor: a, text: "^", kind: "fermata" });
    }
    const arpeggios: System["arpeggios"] = [];
    for (const x of score.arpeggios) {
      const a = anchorT.indexOf(x.t);
      if (a < 0) continue;
      arpeggios.push({ anchor: a, ...(x.staff !== undefined ? { staff: x.staff } : {}), down: !!x.down });
      if (x.staff === undefined) marks.push({ anchor: a, text: x.down ? ARPEGGIO_DOWN : ARPEGGIO_UP, kind: "arpeggio" });
    }
    for (const tm of score.texts) {
      const a = anchors.findIndex((ci) => (columns[ci] as { t: number }).t === tm.t);
      if (a >= 0) marks.push({ anchor: a, text: tm.text, kind: "text" });
    }
    marks.sort((x, y) => markColumn({ anchors }, x) - markColumn({ anchors }, y));

    const anchorAt = (t: number) => anchors.findIndex((ci) => (columns[ci] as { t: number }).t === t);
    const lastAnchorBefore = (t: number) => {
      let a = -1;
      anchors.forEach((ci, i) => {
        if ((columns[ci] as { t: number }).t < t) a = i;
      });
      return a;
    };
    // liaisons : les plus courtes d'abord, chacune au premier étage où elle ne touche aucune autre
    const slurSpans = (staff: Staff): SlurSpan[] => {
      const spans = score.slurs
        .filter((s) => s.staff === staff && s.start < t1 && s.end >= t0)
        .map((s) => ({
          fromAnchor: anchorAt(Math.max(s.start, t0)),
          toAnchor: s.end < t1 ? anchorAt(s.end) : anchors.length - 1,
          opens: s.start >= t0,
          closes: s.end < t1,
          level: 0,
        }))
        .filter((s) => s.fromAnchor >= 0 && s.toAnchor >= s.fromAnchor);
      const placed: SlurSpan[] = [];
      for (const s of [...spans].sort((a, b) => a.toAnchor - a.fromAnchor - (b.toAnchor - b.fromAnchor))) {
        // deux liaisons qui se touchent seulement (l'une finit sur la note où l'autre commence) restent au même étage
        while (placed.some((p) => p.level === s.level && p.fromAnchor < s.toAnchor && s.fromAnchor < p.toAnchor)) s.level++;
        placed.push(s);
      }
      return spans;
    };
    // paroles : autant de lignes que le plus haut couplet présent dans le système
    const lyricLines = (staff: Staff): LyricLine[] => {
      const here = score.lyrics.filter(
        (l) => l.staff === staff && ((l.t >= t0 && l.t < t1) || (l.t < t0 && l.extend !== undefined && l.extend > t0)),
      );
      const verses = Math.max(0, ...here.map((l) => l.verse));
      return Array.from({ length: verses }, (_, v) => {
        const mine = here.filter((l) => l.verse === v + 1);
        return {
          syllables: mine.filter((l) => l.t >= t0).map((l) => ({ anchor: anchorAt(l.t), text: l.text, hyphen: !!l.hyphen })),
          extenders: mine
            .filter((l) => l.extend !== undefined)
            .map((l) => ({
              fromAnchor: l.t >= t0 ? anchorAt(l.t) : 0,
              toAnchor: l.extend! < t1 ? lastAnchorBefore(l.extend!) : anchors.length - 1,
              opens: l.t >= t0,
              closes: l.extend! <= t1,
            })),
        };
      });
    };
    const voice = (staff: Staff): Voice => ({
      marks: score.expressions
        .filter((e) => e.staff === staff)
        .map((e): VoiceMark => ({ anchor: anchorAt(e.t), text: e.text, kind: e.kind }))
        .concat(
          score.arpeggios
            .filter((x) => x.staff === staff)
            .map((x) => ({ anchor: anchorAt(x.t), text: x.down ? ARPEGGIO_DOWN : ARPEGGIO_UP, kind: "arpeggio" as const })),
          score.articulations
            .filter((x) => x.staff === staff)
            .map((x) => ({ anchor: anchorAt(x.t), text: ARTICULATION_SIGNS[x.kind], kind: "articulation" as const })),
        )
        .filter((m) => m.anchor >= 0)
        .sort((x, y) => x.anchor - y.anchor),
      hairpins: score.hairpins
        .filter((h) => h.staff === staff && h.start < t1 && h.end > t0 && h.end > h.start)
        .map((h) => {
          const s = Math.max(h.start, t0), e = Math.min(h.end, t1);
          return {
            kind: h.kind,
            fromAnchor: anchorAt(s),
            toAnchor: lastAnchorBefore(e),
            from: (s - h.start) / (h.end - h.start),
            to: (e - h.start) / (h.end - h.start),
          };
        })
        .filter((h) => h.fromAnchor >= 0 && h.toAnchor >= h.fromAnchor),
      effects: score.effects
        .filter((e) => e.staff === staff && e.start < t1 && e.end > t0 && e.end > e.start)
        .map((e) => ({ kind: e.kind, fromAnchor: anchorAt(Math.max(e.start, t0)), toAnchor: lastAnchorBefore(Math.min(e.end, t1)), opens: e.start >= t0, closes: e.end <= t1 }))
        .filter((e) => e.fromAnchor >= 0 && e.toAnchor >= e.fromAnchor),
      slurs: slurSpans(staff),
      lyrics: lyricLines(staff),
    });

    // pédale d'une portée : ses signes (pour le texte .prisma) et ses traits (pour la gravure)
    const pedalLine = (staff: Staff): PedalLine => {
      const pedals = score.pedals.filter((p) => p.staff === staff);
      const signs: PedalLine["signs"] = [];
      const spans: PedalLine["spans"] = [];
      for (const p of pedals) {
        const change = (t: number) => pedals.some((q) => q !== p && (q.end === t || q.start === t));
        if (p.start >= t0 && p.start < t1) {
          const a = anchorAt(p.start);
          if (a >= 0) signs.push({ anchor: a, text: pedals.some((q) => q.end === p.start) ? PEDAL_CHANGE : PEDAL_DOWN });
        }
        // relâchée à un instant où une autre pédale s'enfonce : c'est ce changement qui l'écrit
        if (p.end >= t0 && p.end < t1 && !pedals.some((q) => q.start === p.end)) {
          const a = anchorAt(p.end);
          if (a >= 0) signs.push({ anchor: a, text: PEDAL_UP });
        }
        if (p.start < t1 && p.end > t0) {
          const opens = p.start >= t0, closes = p.end <= t1;
          spans.push({
            fromAnchor: opens ? anchorAt(p.start) : -1,
            toAnchor: p.end < t1 ? anchorAt(p.end) : -1,
            opens,
            closes,
            changeStart: opens && change(p.start),
            changeEnd: closes && change(p.end),
            ...(p.implied ? { implied: true } : {}),
          });
        }
      }
      signs.sort((a, b) => a.anchor - b.anchor);
      const texts = score.pedalTexts.filter((p) => p.staff === staff).map((p) => ({ anchor: anchorAt(p.t), text: p.text })).filter((p) => p.anchor >= 0);
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
      chords: score.chords.map((c) => ({ anchor: anchorT.indexOf(c.t), text: c.text })).filter((c) => c.anchor >= 0),
      width,
    };
  });
}
