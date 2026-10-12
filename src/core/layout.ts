/**
 * Mise en page : découpe le morceau en systèmes qui tiennent dans une largeur donnée,
 * et calcule pour chaque système ses ancres, ses lignes et le contenu de chaque case.
 *
 * Le moteur ne connaît que des « unités » de largeur : des caractères pour le texte,
 * des millimètres pour le rendu graphique. Seules les mesures changent.
 */
import { TICKS_PER_BEAT, beatStart } from "./model.ts";
import type { Beat, Division, Hand, Note, Score } from "./model.ts";
import { numberOf, octaveOf } from "./pitch.ts";

export type Metrics = {
  /** Largeur totale disponible pour un système. */
  width: number;
  /** Largeur de la colonne de gauche (numéro de mesure ou d'octave), séparateur compris. */
  prefix: number;
  cell: number;
  beatSep: number;
  barSep: number;
};

export type Column =
  | { kind: "anchor"; t: number; label: string; beatIndex: number; k: number; n: number }
  | { kind: "beatSep" }
  | { kind: "barSep" };

export type SystemRow = {
  hand: Hand;
  octave: number;
  /** Faux pour les lignes suivantes d'un même groupe d'octave : on n'écrit le numéro qu'une fois. */
  showOctave: boolean;
  /** Contenu de chaque ancre : "", "-", "-N" (rappel en début de système) ou "N". */
  cells: string[];
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
  const beatW = (i: number, last: boolean) => grids[i].n * m.cell + (last ? m.barSep : m.beatSep);
  const barW = (bar: number[]) => bar.reduce((s, i, j) => s + beatW(i, j === bar.length - 1), 0);

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
    if (used + w <= avail) {
      cur.push(...bar);
      used += w;
      continue;
    }
    if (w <= avail) {
      flush();
      cur.push(...bar);
      used = w;
      continue;
    }
    // mesure plus large qu'un système : on la coupe sur un temps
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

type Lane = { hand: Hand; octave: number; notes: Note[] };

/** Répartit les notes d'un système en lignes : une main, une octave, jamais deux notes à la fois. */
function lanes(notes: Note[], t0: number): Lane[] {
  const sorted = [...notes].sort((a, b) => Math.max(a.start, t0) - Math.max(b.start, t0) || b.midi - a.midi);
  const out: Lane[] = [];
  for (const n of sorted) {
    const octave = octaveOf(n.midi);
    const s = Math.max(n.start, t0);
    let lane = out.find((l) => l.hand === n.hand && l.octave === octave && l.notes.every((m) => m.end <= s));
    if (!lane) {
      lane = { hand: n.hand, octave, notes: [] };
      out.push(lane);
    }
    lane.notes.push(n);
  }
  const avg = (l: Lane) => l.notes.reduce((s, n) => s + n.midi, 0) / l.notes.length;
  return out.sort((a, b) => b.octave - a.octave || avg(b) - avg(a));
}

function cell(lane: Lane, t: number, t0: number): string {
  const attack = lane.notes.find((n) => n.start === t);
  if (attack) return String(numberOf(attack.midi));
  const held = lane.notes.find((n) => n.start < t && n.end > t);
  if (!held) return "";
  return t === t0 ? "-" + numberOf(held.midi) : "-";
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
    beatIdx.forEach((bi, j) => {
      const g = grids[bi];
      for (let k = 0; k < g.n; k++) {
        anchors.push(columns.length);
        columns.push({ kind: "anchor", t: beatStart(bi) + (k * T) / g.n, label: g.labels[k], beatIndex: bi, k, n: g.n });
        width += m.cell;
      }
      const next = beatIdx[j + 1] ?? bi + 1;
      const barEnd = score.beats[next]?.barIndex !== score.beats[bi].barIndex;
      columns.push({ kind: barEnd ? "barSep" : "beatSep" });
      width += barEnd ? m.barSep : m.beatSep;
    });
    const inSystem = score.notes.filter((n) => n.start < t1 && n.end > t0);
    const toRows = (hand: Hand): SystemRow[] =>
      lanes(inSystem.filter((n) => n.hand === hand), t0).map((lane, i, all) => ({
        hand,
        octave: lane.octave,
        showOctave: i === 0 || all[i - 1].octave !== lane.octave,
        cells: anchors.map((ci) => cell(lane, (columns[ci] as { t: number }).t, t0)),
      }));
    return {
      bar: score.beats[beatIdx[0]].bar,
      start: t0,
      end: t1,
      columns,
      anchors,
      right: toRows("D"),
      left: toRows("G"),
      width,
    };
  });
}
