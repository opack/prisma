/**
 * Mise en page : découpe le morceau en systèmes qui tiennent dans une largeur donnée,
 * et calcule pour chaque système ses ancres, ses lignes et le contenu de chaque case.
 *
 * Le moteur ne connaît que des « unités » de largeur : des caractères pour le texte,
 * des millimètres pour le rendu graphique. Seules les mesures changent.
 */
import { TICKS_PER_BEAT, beatStart, repeatOf } from "./model.ts";
import type { Beat, Division, Ending, Hand, Note, Score } from "./model.ts";
import { numberOf, octaveOf } from "./pitch.ts";

export type Metrics = {
  /** Largeur totale disponible pour un système. */
  width: number;
  /** Largeur de la colonne de gauche (numéro de mesure ou d'octave), séparateur compris. */
  prefix: number;
  cell: number;
  beatSep: number;
  barSep: number;
  /** Largeur ajoutée par les deux points d'un signe de reprise, de chaque côté. */
  repeatDots: number;
};

export type Column =
  | { kind: "anchor"; t: number; label: string; beatIndex: number; k: number; n: number }
  | { kind: "beatSep" }
  /**
   * Barre de mesure. endRepeat : « :|| » (la mesure précédente termine une reprise) ;
   * startRepeat : « ||: » (la mesure suivante en commence une). lead : barre de début de
   * système, présente seulement quand le système commence par « ||: ».
   */
  | { kind: "barSep"; endRepeat?: boolean; startRepeat?: boolean; lead?: boolean };

export type SystemRow = {
  hand: Hand;
  octave: number;
  /** Faux pour les lignes suivantes d'un même groupe d'octave : on n'écrit le numéro qu'une fois. */
  showOctave: boolean;
  /** Contenu de chaque ancre : "", "-", "-N" (rappel en début de système) ou "N". */
  cells: string[];
  /**
   * Pour chaque ancre, décalage vertical (en lignes) qui centre le bloc de notes dans
   * son couloir d'octave. Sert seulement au rendu graphique « notes centrées ».
   */
  center: number[];
};

/** Indication de la ligne @ placée sur une ancre (index dans anchors). */
export type Mark = {
  anchor: number;
  text: string;
  kind: "ending" | "endingClose" | "times" | "text";
};

/** Portion d'une case de reprise visible dans un système. */
export type EndingSpan = {
  ending: Ending;
  /** Première et dernière ancres couvertes. */
  fromAnchor: number;
  toAnchor: number;
  /** La case commence dans ce système (on y écrit son numéro). */
  opens: boolean;
  /** La case se termine dans ce système. */
  closes: boolean;
  /** Elle se termine sur une barre de reprise « :|| » (crochet fermé à droite). */
  closedByRepeat: boolean;
};

export type System = {
  /** Numéro de la mesure par laquelle commence le système. */
  bar: string;
  start: number;
  end: number;
  columns: Column[];
  /** Index, dans columns, de chaque ancre. */
  anchors: number[];
  right: SystemRow[];
  left: SystemRow[];
  marks: Mark[];
  endings: EndingSpan[];
  /** Largeur naturelle du système, en unités. */
  width: number;
};

const MAX_RESOLUTION = 48;

/** Plus petit nombre d'ancres qui place tous les événements du temps sur une ancre. */
function resolution(offsets: number[]): number {
  for (let n = 1; n <= MAX_RESOLUTION; n++) {
    if (TICKS_PER_BEAT % n) continue;
    const step = TICKS_PER_BEAT / n;
    if (offsets.every((o) => o % step === 0)) return n;
  }
  return MAX_RESOLUTION;
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

/** Nom d'une ancre : chiffre du temps, « : » premier découpage, « . » second, rien au-delà. */
export function anchorLabel(k: number, n: number, base: Division, beatLabel: number): string {
  if (k === 0) return String(beatLabel);
  if ((k * base) % n === 0) return ":";
  if ((k * base * 2) % n === 0) return ".";
  return "";
}

type BeatGrid = { n: number; labels: string[] };

function beatGrids(score: Score): BeatGrid[] {
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
  return score.beats.map((b, i) => {
    const n = resolution(offsets[i]);
    const base = baseDivision(n, b.division, attacks[i]);
    return { n, labels: Array.from({ length: n }, (_, k) => anchorLabel(k, n, base, b.label)) };
  });
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
  const barEndW = (barIndex: number) => {
    const r = repeatOf(score, barIndex);
    const next = repeatOf(score, barIndex + 1);
    return m.barSep + (r?.end ? m.repeatDots : 0) + (next?.start ? m.repeatDots : 0);
  };
  const beatW = (i: number, last: boolean) =>
    grids[i].n * m.cell + (last ? barEndW(score.beats[i].barIndex) : m.beatSep);
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
  for (const bar of bars) {
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
type Lane = { hand: Hand; octave: number; notes: Note[] };

/**
 * Bloc : suite de notes d'un même couloir qui se chevauchent (directement ou de proche
 * en proche). Deux blocs ne sonnent jamais en même temps, ils peuvent donc être rangés
 * indépendamment l'un de l'autre.
 */
type Block = { start: number; end: number; size: number };

/** Couloir d'octave d'une main : ses lignes et ses blocs. */
type Group = { hand: Hand; octave: number; lanes: Lane[]; blocks: Block[] };

/**
 * Répartit les notes d'un système en couloirs (une main, une octave), puis en lignes
 * (jamais deux notes à la fois sur une ligne).
 *
 * Dans chaque bloc, les notes sont rangées de haut en bas, la plus aiguë en premier :
 * une note seule est toujours sur la ligne du haut, quel que soit le reste du couloir.
 */
function groups(notes: Note[], t0: number): Group[] {
  const byKey = new Map<string, Note[]>();
  for (const n of notes) {
    const key = n.hand + octaveOf(n.midi);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key)!.push(n);
  }
  const out: Group[] = [];
  for (const list of byKey.values()) {
    const s = (n: Note) => Math.max(n.start, t0);
    const sorted = [...list].sort((a, b) => s(a) - s(b) || b.midi - a.midi);
    const g: Group = { hand: sorted[0].hand, octave: octaveOf(sorted[0].midi), lanes: [], blocks: [] };
    let local: Note[][] = [];
    let block: Block | undefined;
    const flush = () => {
      if (!block) return;
      block.size = local.length;
      g.blocks.push(block);
      local.forEach((notes, i) => {
        if (!g.lanes[i]) g.lanes[i] = { hand: g.hand, octave: g.octave, notes: [] };
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

function cell(lane: Lane, t: number, t0: number): string {
  const attack = lane.notes.find((n) => n.start === t);
  if (attack) return String(numberOf(attack.midi));
  const held = lane.notes.find((n) => n.start < t && n.end > t);
  if (!held) return "";
  return t === t0 ? "-" + numberOf(held.midi) : "-";
}

export const endingLabel = (e: Ending) => "[" + e.numbers.map((n) => n + ".").join("");

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
        columns.push({ kind: "anchor", t: beatStart(bi) + (k * T) / g.n, label: g.labels[k], beatIndex: bi, k, n: g.n });
        width += m.cell;
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
      columns.push(col);
      width += m.barSep + (endRepeat ? m.repeatDots : 0) + (startRepeat ? m.repeatDots : 0);
    });

    const inSystem = score.notes.filter((n) => n.start < t1 && n.end > t0);
    const toRows = (hand: Hand): SystemRow[] =>
      groups(inSystem.filter((n) => n.hand === hand), t0).flatMap((g) =>
        g.lanes.map((lane, i) => ({
          hand,
          octave: g.octave,
          showOctave: i === 0,
          cells: anchors.map((ci) => cell(lane, (columns[ci] as { t: number }).t, t0)),
          // décalage pour centrer chaque bloc dans son couloir (rendu graphique, option)
          center: anchors.map((ci) => {
            const t = (columns[ci] as { t: number }).t;
            const b = g.blocks.find((x) => x.start <= t && t < x.end);
            return b ? (g.lanes.length - b.size) / 2 : 0;
          }),
        })),
      );

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
    const endings: EndingSpan[] = [];
    for (const e of score.endings) {
      const bars = [...barAnchors.keys()].filter((b) => b >= e.firstBar && b <= e.lastBar);
      if (!bars.length) continue;
      const fromBar = bars[0], toBar = bars[bars.length - 1];
      const list = barAnchors.get(toBar)!;
      const opens = firstAnchorOfBar(e.firstBar) !== undefined;
      const closes = toBar === e.lastBar && lastAnchorOfBar(e.lastBar) !== undefined;
      const closedByRepeat = closes && !!repeatOf(score, e.lastBar)?.end;
      endings.push({ ending: e, fromAnchor: barAnchors.get(fromBar)![0], toAnchor: list[list.length - 1], opens, closes, closedByRepeat });
      if (opens) marks.push({ anchor: firstAnchorOfBar(e.firstBar)!, text: endingLabel(e), kind: "ending" });
      if (closes && !closedByRepeat) marks.push({ anchor: lastAnchorOfBar(e.lastBar)!, text: "]", kind: "endingClose" });
    }
    for (const r of score.repeats) {
      if (!r.end || !r.times || r.times === 2) continue;
      const a = lastAnchorOfBar(r.barIndex);
      if (a !== undefined) marks.push({ anchor: a, text: `${r.times}×`, kind: "times" });
    }
    for (const tm of score.texts) {
      const a = anchors.findIndex((ci) => (columns[ci] as { t: number }).t === tm.t);
      if (a >= 0) marks.push({ anchor: a, text: tm.text, kind: "text" });
    }
    marks.sort((x, y) => x.anchor - y.anchor);

    return {
      bar: firstBeat.bar,
      start: t0,
      end: t1,
      columns,
      anchors,
      right: toRows("D"),
      left: toRows("G"),
      marks,
      endings,
      width,
    };
  });
}
