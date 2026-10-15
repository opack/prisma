/**
 * Déroulé d'un morceau à l'écoute : les passages joués l'un après l'autre, reprises et ordre des
 * sections compris, et les notes placées sur ce déroulé.
 *
 * Deux échelles de temps, en ticks : l'instant du morceau (sa place sur la partition) et l'instant
 * joué (depuis le début de l'écoute). Une mesure reprise a un instant du morceau et deux instants joués.
 */
import { TICKS_PER_BEAT } from "../core/index.ts";
import type { Score } from "../core/index.ts";
import { velocities } from "./dynamics.ts";
import { soundingEnds } from "./pedal.ts";

/**
 * Un passage joué d'une traite : les instants du morceau [from, to[, joués à partir de l'instant
 * `at`. entry : rang de sa section dans l'ordre de jeu (0 sans sections).
 */
export type Passage = { from: number; to: number; at: number; entry: number };

/** Une note sur le déroulé : son attaque et sa fin en instants joués, son intensité (vélocité MIDI). */
export type PlayedNote = { start: number; end: number; midi: number; velocity: number };

/** Les mesures [first, last] d'une section, ou du morceau entier. */
type Bars = { first: number; last: number };

/**
 * Les passages joués, dans l'ordre : chaque section de l'ordre de jeu, ses reprises déroulées.
 * Un passage par tour : une section sans reprise en fait un, une reprise jouée deux fois en fait deux.
 */
export function passages(score: Score): Passage[] {
  // instants du morceau où commence et finit chaque mesure
  const barFrom: number[] = [], barTo: number[] = [];
  score.beats.forEach((b, i) => {
    barFrom[b.barIndex] ??= i * TICKS_PER_BEAT;
    barTo[b.barIndex] = (i + 1) * TICKS_PER_BEAT;
  });
  const lastBar = barTo.length - 1;
  if (lastBar < 0) return [];

  const markers = [...score.markers].sort((a, b) => a.barIndex - b.barIndex);
  const sections = new Map<string, Bars>(markers.map((m, i) => [m.label, { first: m.barIndex, last: (markers[i + 1]?.barIndex ?? lastBar + 1) - 1 }]));
  const played: Bars[] = !markers.length
    ? [{ first: 0, last: lastBar }]
    : (score.order.length ? score.order : markers.map((m) => m.label)).map((label) => sections.get(label)!);

  const out: Passage[] = [];
  let at = 0;
  played.forEach(({ first, last }, entry) => {
    const play = (a: number, b: number) => {
      out.push({ from: barFrom[a], to: barTo[b], at, entry });
      at += barTo[b] - barFrom[a];
    };
    // une reprise reste dans sa section : elle revient au dernier « ||: », ou au début de la section
    let pending = first, again = first;
    for (let bar = first; bar <= last; bar++) {
      const r = score.repeats.find((x) => x.barIndex === bar);
      if (r?.start) {
        if (bar > pending) play(pending, bar - 1);
        pending = again = bar;
      }
      if (r?.end) {
        for (let k = 0; k < (r.times ?? 2); k++) play(again, bar);
        pending = again = bar + 1;
      }
    }
    if (pending <= last) play(pending, last);
  });
  return out;
}

/** Durée totale du déroulé, en ticks. */
export const playedLength = (ps: Passage[]) => (ps.length ? ps[ps.length - 1].at + ps[ps.length - 1].to - ps[ps.length - 1].from : 0);

/**
 * Les notes du déroulé, dans l'ordre où elles commencent. Une note qui déborde de son passage
 * s'arrête avec lui (après un retour en arrière, elle ne sonne plus), sauf si le passage suivant
 * continue la partition : une note liée de l'un à l'autre reste alors tenue.
 */
export function playedNotes(score: Score, ps: Passage[]): PlayedNote[] {
  const runs: Passage[] = [];
  for (const p of ps) {
    const prev = runs[runs.length - 1];
    if (prev && prev.to === p.from) runs[runs.length - 1] = { ...prev, to: p.to };
    else runs.push(p);
  }
  const velocity = velocities(score), ends = soundingEnds(score);
  const out: PlayedNote[] = [];
  for (const p of runs)
    score.notes.forEach((n, i) => {
      if (n.start >= p.from && n.start < p.to) out.push({ start: p.at + n.start - p.from, end: p.at + Math.min(ends[i], p.to) - p.from, midi: n.midi, velocity: velocity[i] });
    });
  return out.sort((a, b) => a.start - b.start || a.midi - b.midi);
}

/** Le passage joué à un instant joué. */
const passageAt = (ps: Passage[], played: number) => ps.find((x) => played >= x.at && played < x.at + x.to - x.from);

/** L'instant du morceau qui correspond à un instant joué : celui qu'on surligne. */
export function scoreTick(ps: Passage[], played: number): number | null {
  const p = passageAt(ps, played);
  return p ? p.from + played - p.at : null;
}

/** Le rang, dans l'ordre de jeu, de la section jouée à cet instant. */
export const entryAt = (ps: Passage[], played: number) => passageAt(ps, played)?.entry ?? null;

/** L'instant joué où commence la section de rang `entry` dans l'ordre de jeu. */
export const entryStart = (ps: Passage[], entry: number) => ps.find((x) => x.entry === entry)?.at ?? null;

/**
 * L'instant joué d'un instant du morceau, quand on clique dessus depuis l'instant joué `current`.
 * Une mesure reprise se joue plusieurs fois : on reste dans le passage en cours s'il la contient ;
 * sinon on prend son passage le plus récent déjà joué (revenir en arrière pour réentendre ce qui
 * précède), sinon le premier à venir.
 */
export function playedTick(ps: Passage[], tick: number, current = 0): number | null {
  const all = ps.filter((x) => tick >= x.from && tick < x.to).map((x) => x.at + tick - x.from);
  if (!all.length) return null;
  const here = passageAt(ps, current);
  if (here && tick >= here.from && tick < here.to) return here.at + tick - here.from;
  const before = all.filter((p) => p < current);
  return before.length ? before[before.length - 1] : all[0];
}
