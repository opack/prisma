/**
 * Déroulé d'un morceau à l'écoute : les passages joués l'un après l'autre, reprises et ordre des
 * sections compris, et les notes placées sur ce déroulé.
 *
 * Deux échelles de temps, en ticks : l'instant du morceau (sa place sur la partition) et l'instant
 * joué (depuis le début de l'écoute). Une mesure reprise a un instant du morceau et deux instants joués.
 */
import { TICKS_PER_BEAT } from "../core/index.ts";
import type { ArticulationKind, Score } from "../core/index.ts";
import { velocities, velocityAt } from "./dynamics.ts";
import { soundingEnds } from "./pedal.ts";

/**
 * Un passage joué d'une traite : les instants du morceau [from, to[, joués à partir de l'instant
 * `at`. entry : rang de sa section dans l'ordre de jeu (0 sans sections).
 */
export type Passage = { from: number; to: number; at: number; entry: number };

/**
 * Une note sur le déroulé : son attaque et sa fin en instants joués, son intensité (vélocité MIDI).
 * grace : petite note, jouée `grace` crans avant l'instant `start` de sa note principale (start et
 * end sont alors cet instant) ; la durée d'un cran se décide au tempo de l'écoute.
 */
export type PlayedNote = { start: number; end: number; midi: number; velocity: number; grace?: number; trill?: Trill; roll?: Roll };

/** Note d'un arpège : son rang dans l'accord égrené (0 : sur le temps) et le nombre de notes de l'accord. */
export type Roll = { rank: number; count: number };

/** Trille d'une note : sa voisine, alternée jusqu'à la fin écrite de la note (en instant joué) ; la pédale ne la prolonge pas. */
export type Trill = { midi: number; until: number };

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
  // articulations : la touche relâchée plus tôt (la pédale peut encore tenir le son), l'attaque plus forte
  const marks = score.notes.map((n) => score.articulations.filter((a) => a.part === n.part && a.t === n.start).map((a) => a.kind));
  const released = score.notes.map((n, i) => ({ ...n, end: n.start + (n.end - n.start) * Math.min(1, ...marks[i].map((k) => SHORTER[k])) }));
  const velocity = velocities(score).map((v, i) => Math.min(127, v + Math.max(0, ...marks[i].map((k) => LOUDER[k]))));
  const ends = soundingEnds({ ...score, notes: released }), rolls = rollRanks(score);
  const out: PlayedNote[] = [];
  for (const p of runs)
    score.notes.forEach((n, i) => {
      if (n.start >= p.from && n.start < p.to) out.push({
          start: p.at + n.start - p.from,
          end: p.at + Math.min(ends[i], p.to) - p.from,
          midi: n.midi,
          velocity: velocity[i],
          ...(n.trill !== undefined ? { trill: { midi: n.trill, until: p.at + Math.min(n.end, p.to) - p.from } } : {}),
          ...(rolls[i] ? { roll: rolls[i] } : {}),
        });
    });
  // petites notes : rangées avant leur note, la première le plus tôt ; même rang, jouées ensemble
  const level = velocityAt(score);
  const ranks = new Map<string, number>();
  for (const g of score.graces) ranks.set(`${g.part}:${g.t}`, Math.max(ranks.get(`${g.part}:${g.t}`) ?? 0, g.slot + 1));
  for (const p of runs)
    for (const g of score.graces)
      if (g.t >= p.from && g.t < p.to) {
        const t = p.at + g.t - p.from;
        out.push({ start: t, end: t, midi: g.midi, velocity: level(g.part, g.t, false), grace: ranks.get(`${g.part}:${g.t}`)! - g.slot });
      }
  return out.sort((a, b) => a.start - b.start || (b.grace ?? 0) - (a.grace ?? 0) || a.midi - b.midi);
}

/** Part de sa durée que garde une note articulée : un staccato sonne moitié moins, un marcato un peu moins. */
const SHORTER: Record<ArticulationKind, number> = { staccato: 0.5, accent: 1, marcato: 0.75 };
/** Ce qu'ajoute une articulation à l'intensité de la note (vélocité). */
const LOUDER: Record<ArticulationKind, number> = { staccato: 0, accent: 20, marcato: 28 };

/**
 * Arpèges : pour chaque note, sa place dans l'accord égrené (rien hors arpège). Du grave à l'aigu, ou de l'aigu au grave ; sans partie, tout le système d'un geste.
 */
function rollRanks(score: Score): (Roll | undefined)[] {
  const ranks: (Roll | undefined)[] = score.notes.map(() => undefined);
  for (const a of score.arpeggios) {
    const chord = score.notes.map((n, i) => ({ n, i })).filter(({ n }) => n.start === a.t && (a.part === undefined || n.part === a.part));
    chord.sort((x, y) => (a.down ? y.n.midi - x.n.midi : x.n.midi - y.n.midi));
    chord.forEach(({ i }, k) => (ranks[i] = { rank: k, count: chord.length }));
  }
  return ranks;
}

/**
 * Point d'orgue : à l'instant joué `at`, ce qui commence là (note, accord ou silence, jusqu'à la
 * prochaine attaque) se tient deux fois plus longtemps, d'au plus deux temps de plus. `length` :
 * la durée ainsi doublée, en ticks joués.
 */
export type Hold = { at: number; length: number };

export function holds(score: Score, ps: Passage[]): Hold[] {
  const attacks = [...new Set(score.notes.map((n) => n.start))].sort((a, b) => a - b);
  const out: Hold[] = [];
  for (const p of ps)
    for (const t of score.fermatas) {
      if (t < p.from || t >= p.to) continue;
      const next = attacks.find((x) => x > t) ?? t + TICKS_PER_BEAT;
      out.push({ at: p.at + t - p.from, length: Math.min(Math.min(next, p.to) - t, 2 * TICKS_PER_BEAT) });
    }
  return out.sort((a, b) => a.at - b.at);
}

/** L'instant d'horloge (en ticks, points d'orgue compris) d'un instant joué. */
export function stretched(hs: Hold[], played: number): number {
  let out = played;
  for (const h of hs) if (played > h.at) out += Math.min(played - h.at, h.length);
  return out;
}

/** L'instant joué d'un instant d'horloge : pendant un point d'orgue, le temps joué avance deux fois moins vite. */
export function unstretched(hs: Hold[], clock: number): number {
  let shift = 0;
  for (const h of hs) {
    const start = h.at + shift; // le point d'orgue sur l'horloge
    if (clock <= start) break;
    if (clock < start + 2 * h.length) return h.at + (clock - start) / 2;
    shift += h.length;
  }
  return clock - shift;
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

/** Vrai si l'instant joué tombe dans la première mesure de sa section. */
export function inFirstBar(score: Score, ps: Passage[], played: number): boolean {
  const p = passageAt(ps, played);
  const first = p && ps.find((x) => x.entry === p.entry);
  if (!first) return false;
  const bar = score.beats[Math.floor(first.from / TICKS_PER_BEAT)]?.barIndex;
  let end = first.from;
  while (score.beats[end / TICKS_PER_BEAT]?.barIndex === bar) end += TICKS_PER_BEAT;
  return played - first.at < end - first.from;
}

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
