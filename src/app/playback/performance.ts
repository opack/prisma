/**
 * Déroulé d'un morceau à l'écoute : les passages joués l'un après l'autre, reprises et ordre des
 * sections compris, et les notes placées sur ce déroulé.
 *
 * Deux échelles de temps, en ticks : l'instant du morceau (sa place sur la partition) et l'instant
 * joué (depuis le début de l'écoute). Une mesure reprise a un instant du morceau et deux instants joués.
 */
import { HARMONICS, TICKS_PER_BEAT, beatGrids, stringsOfStaff } from "../../core/index.ts";
import type { ArticulationKind, Note, Score } from "../../core/index.ts";
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
export type PlayedNote = {
  staff: number;
  start: number;
  end: number;
  midi: number;
  velocity: number;
  grace?: number;
  trill?: Trill;
  roll?: Roll;
  filter?: number;
};

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
  const barFrom: number[] = [],
    barTo: number[] = [];
  score.beats.forEach((beat, index) => {
    barFrom[beat.barIndex] ??= index * TICKS_PER_BEAT;
    barTo[beat.barIndex] = (index + 1) * TICKS_PER_BEAT;
  });
  const lastBar = barTo.length - 1;
  if (lastBar < 0) return [];

  const markers = [...score.markers].sort((first, second) => first.barIndex - second.barIndex);
  const sections = new Map<string, Bars>(
    markers.map((marker, index) => [marker.label, { first: marker.barIndex, last: (markers[index + 1]?.barIndex ?? lastBar + 1) - 1 }]),
  );
  const played: Bars[] = !markers.length
    ? [{ first: 0, last: lastBar }]
    : (score.order.length ? score.order : markers.map((marker) => marker.label)).map((label) => sections.get(label)!);

  const out: Passage[] = [];
  let at = 0;
  played.forEach(({ first, last }, entry) => {
    const play = (fromBar: number, toBar: number) => {
      out.push({ from: barFrom[fromBar], to: barTo[toBar], at, entry });
      at += barTo[toBar] - barFrom[fromBar];
    };
    // une reprise reste dans sa section : elle revient au dernier « ||: », ou au début de la section
    let pending = first,
      again = first;
    for (let bar = first; bar <= last; bar++) {
      const repeat = score.repeats.find((candidate) => candidate.barIndex === bar);
      if (repeat?.start) {
        if (bar > pending) play(pending, bar - 1);
        pending = again = bar;
      }
      if (repeat?.end) {
        for (let time = 0; time < (repeat.times ?? 2); time++) play(again, bar);
        pending = again = bar + 1;
      }
    }
    if (pending <= last) play(pending, last);
  });
  return out;
}

/** Niveau d'un coup de métronome : premier temps de la mesure, temps, division du temps, subdivision. */
export type ClickLevel = "downbeat" | "beat" | "division" | "subdivision";

/** Un coup du métronome, en instant joué. */
export type Click = { at: number; level: ClickLevel };

/** Ce que bat le métronome : la grille régulière du temps, les cases écrites, ou les attaques. */
export type ClickGrid = "beats" | "cells" | "attacks";

/**
 * Les coups du métronome sur le déroulé, reprises comprises. Sur la grille régulière de chaque
 * temps : le temps, sa division en 2 ou en 3 selon son découpage, puis chaque division coupée en
 * deux. Ou sur les cases écrites : un coup par case, à son niveau (« * » division, « . » et « , »
 * subdivision), ce qui fait entendre quand jouer. Ou sur les seules attaques : chaque case, temps
 * compris, où une note commence dans n'importe quelle portée (pas une case de tenue, de silence ou
 * de soufflet). Une levée commence sur un temps, pas sur un premier temps.
 */
export function clicks(score: Score, route: Passage[], grid: ClickGrid = "beats"): Click[] {
  const cells = grid === "beats" ? [] : beatGrids(score);
  const attacks = grid === "attacks" ? new Set(score.notes.map((note) => note.start)) : undefined;
  const out: Click[] = [];
  for (const passage of route)
    for (let tick = passage.from; tick < passage.to; tick += TICKS_PER_BEAT) {
      const index = tick / TICKS_PER_BEAT,
        beat = score.beats[index];
      const at = passage.at + tick - passage.from;
      if (!attacks || attacks.has(tick)) out.push({ at, level: beat?.label === 1 ? "downbeat" : "beat" });
      if (grid !== "beats") {
        const { count, labels } = cells[index] ?? { count: 1, labels: [] };
        for (let cell = 1; cell < count; cell++) {
          const offset = (cell * TICKS_PER_BEAT) / count;
          if (!attacks || attacks.has(tick + offset))
            out.push({ at: at + offset, level: labels[cell] === "*" ? "division" : "subdivision" });
        }
        continue;
      }
      const division = beat?.division ?? 2;
      for (let step = 1; step < 2 * division; step++)
        out.push({ at: at + (step * TICKS_PER_BEAT) / (2 * division), level: step % 2 ? "subdivision" : "division" });
    }
  return out;
}

/**
 * Le décompte avant de jouer depuis l'instant joué `played` : une mesure entière, temps par temps
 * (le premier marqué), puis, si l'on part en cours de mesure (une levée), les temps qui l'y mènent.
 * Partir sur le temps 4 d'une mesure à 4 temps : 1 2 3 4, 1 2 3, et l'on joue.
 */
export function countIn(score: Score, route: Passage[], played: number): ClickLevel[] {
  const tick = scoreTick(route, played);
  if (tick === null) return [];
  const beat = score.beats[Math.floor(tick / TICKS_PER_BEAT)];
  if (!beat) return [];
  const barLength = (bar: number) =>
    Math.max(0, ...score.beats.filter((beat) => beat.barIndex === bar).map((candidate) => candidate.label));
  const first = score.beats.find((candidate) => candidate.barIndex === beat.barIndex)!;
  // une levée n'a pas toute sa mesure : on compte celle qui la suit
  const length = first.label > 1 ? barLength(beat.barIndex + 1) || barLength(beat.barIndex) : barLength(beat.barIndex);
  const labels = [
    ...Array.from({ length }, (_, index) => index + 1),
    ...Array.from({ length: Math.max(0, beat.label - 1) }, (_, index) => index + 1),
  ];
  return labels.map((label) => (label === 1 ? "downbeat" : "beat"));
}

/** Durée totale du déroulé, en ticks. */
export const playedLength = (route: Passage[]) =>
  route.length ? route[route.length - 1].at + route[route.length - 1].to - route[route.length - 1].from : 0;

/**
 * Les notes du déroulé, dans l'ordre où elles commencent. Une note qui déborde de son passage
 * s'arrête avec lui (après un retour en arrière, elle ne sonne plus), sauf si le passage suivant
 * continue la partition : une note liée de l'un à l'autre reste alors tenue.
 */
export function playedNotes(original: Score, route: Passage[]): PlayedNote[] {
  // les techniques des cordes, changées en notes jouables
  const { score, soft, filter } = stringTechniques(original);
  const runs: Passage[] = [];
  for (const passage of route) {
    const prev = runs[runs.length - 1];
    if (prev && prev.to === passage.from) runs[runs.length - 1] = { ...prev, to: passage.to };
    else runs.push(passage);
  }
  // articulations : la touche relâchée plus tôt (la pédale peut encore tenir le son), l'attaque plus forte
  const marks = score.notes.map((note) =>
    score.articulations
      .filter((articulation) => articulation.staff === note.staff && articulation.t === note.start)
      .map((articulation) => articulation.kind),
  );
  const released = score.notes.map((note, index) => ({
    ...note,
    end: note.start + (note.end - note.start) * Math.min(1, ...marks[index].map((articulationKind) => SHORTER[articulationKind])),
  }));
  const velocity = velocities(score).map((base, index) =>
    Math.round(
      Math.min(127, base + Math.max(0, ...marks[index].map((articulationKind) => LOUDER[articulationKind]))) *
        (soft.has(score.notes[index]) ? LEGATO : 1),
    ),
  );
  const ends = soundingEnds({ ...score, notes: released }),
    rolls = rollRanks(score);
  const out: PlayedNote[] = [];
  for (const passage of runs)
    score.notes.forEach((note, index) => {
      if (note.start >= passage.from && note.start < passage.to)
        out.push({
          staff: note.staff,
          start: passage.at + note.start - passage.from,
          end: passage.at + Math.min(ends[index], passage.to) - passage.from,
          midi: note.midi,
          velocity: velocity[index],
          ...(note.trill !== undefined
            ? { trill: { midi: note.trill, until: passage.at + Math.min(note.end, passage.to) - passage.from } }
            : {}),
          ...(rolls[index] ? { roll: rolls[index] } : {}),
          ...(filter.has(score.notes[index]) ? { filter: filter.get(score.notes[index]) } : {}),
        });
    });
  // petites notes : rangées avant leur note, la première le plus tôt ; même rang, jouées ensemble
  const level = velocityAt(score);
  const ranks = new Map<string, number>();
  for (const grace of score.graces)
    ranks.set(`${grace.staff}:${grace.t}`, Math.max(ranks.get(`${grace.staff}:${grace.t}`) ?? 0, grace.slot + 1));
  for (const passage of runs)
    for (const grace of score.graces)
      if (grace.t >= passage.from && grace.t < passage.to) {
        const time = passage.at + grace.t - passage.from;
        out.push({
          staff: grace.staff,
          start: time,
          end: time,
          midi: grace.midi,
          velocity: level(grace.staff, grace.t, false),
          grace: ranks.get(`${grace.staff}:${grace.t}`)! - grace.slot,
        });
      }
  return out.sort((first, second) => first.start - second.start || (second.grace ?? 0) - (first.grace ?? 0) || first.midi - second.midi);
}

/** L'intensité d'une note liée sans être attaquée (hammer-on, pull-off, suite d'un bend ou d'un glissé). */
const LEGATO = 0.55;
/** Le son étouffé : la note courte et sourde (fréquence de coupure, en hertz). */
/** Le glissé d'entrée : depuis trois cases, en un quart de temps au plus ; le glissé de sortie : sur cinq cases. */
const SLIDE_IN = { frets: 3, length: TICKS_PER_BEAT / 4 };
const SLIDE_OUT = { frets: 5 };
const DEAD = { length: TICKS_PER_BEAT / 8, filter: 700 };
const PALM_MUTE = { length: TICKS_PER_BEAT * 0.4, filter: 1100 };

/**
 * Les techniques des cordes, à l'écoute, changées en notes que les sons échantillonnés savent jouer :
 * une note étouffée, brève et sourde ; l'étouffé de la paume, des notes courtes et sourdes ; une
 * harmonique, à la hauteur qu'elle sonne ; un bend, la note puis la note tirée (et relâchée) sans
 * nouvelle attaque ; un glissé, les cases traversées en fin de note, jusqu'à la suivante ; deux
 * notes liées sur une corde (hammer-on, pull-off), la seconde sans attaque. Le vibrato ne s'entend
 * pas : les sons ne savent pas onduler. Rend le morceau, les notes jouées sans attaque, et le
 * filtre des notes sourdes.
 */
function stringTechniques(score: Score) {
  const soft = new Set<Note>();
  const filter = new Map<Note, number>();
  if (!score.parts.some((part) => part.strings)) return { score, soft, filter };
  const notes: Note[] = [];
  const sameString = (first: Note, second: Note) =>
    first.staff === second.staff && first.string !== undefined && first.string === second.string;
  // la note suivante sur la même corde
  const next = (from: Note) =>
    score.notes
      .filter((second) => sameString(second, from) && second.start > from.start)
      .sort((first, second) => first.start - second.start)[0];
  // les notes liées après la première, sur une corde : jouées sans attaque
  const legato = new Set<Note>();
  for (const slur of score.slurs)
    for (const candidate of score.notes)
      if (
        candidate.string !== undefined &&
        candidate.staff === slur.staff &&
        candidate.start > slur.start &&
        candidate.start <= slur.end &&
        score.notes.some((note) => sameString(note, candidate) && note.start >= slur.start && note.start < candidate.start)
      )
        legato.add(candidate);
  const glided = new Set<Note>();
  for (const current of score.notes) {
    const strs = current.string !== undefined ? stringsOfStaff(score.parts, current.staff) : undefined;
    if (!strs) {
      notes.push(current);
      continue;
    }
    const muted = score.effects.some(
      (effect) =>
        effect.kind === "palmMute" && effect.staff === current.staff && current.start >= effect.start && current.start < effect.end,
    );
    const add = (note: Note, quiet = false) => {
      notes.push(note);
      if (quiet || legato.has(current) || glided.has(current)) soft.add(note);
      if (muted) filter.set(note, PALM_MUTE.filter);
      return note;
    };
    if (current.dead) {
      filter.set(add({ ...current, end: current.start + Math.min(current.end - current.start, DEAD.length) }), DEAD.filter);
      continue;
    }
    let base = muted ? { ...current, end: current.start + Math.min(current.end - current.start, PALM_MUTE.length) } : current;
    // le glissé d'entrée : quelques cases avant la note, attaquées puis glissées, vite ; la note arrive sans attaque
    let arrived = false;
    if (current.slideIn) {
      const len = Math.min((base.end - base.start) * 0.3, SLIDE_IN.length);
      const dir = current.slideIn === "up" ? 1 : -1;
      for (let fret = SLIDE_IN.frets; fret >= 1; fret--) {
        const at = base.start + ((SLIDE_IN.frets - fret) * len) / SLIDE_IN.frets;
        add({ ...base, midi: current.midi - fret * dir, start: at, end: at + len / SLIDE_IN.frets }, fret < SLIDE_IN.frets);
      }
      base = { ...base, start: base.start + len };
      arrived = true;
    }
    // la durée jouée (plus courte sous l'étouffé de la paume)
    const duration = base.end - base.start;
    if (current.harmonic) {
      const open = strs.open[current.string! - 1] + strs.capo;
      add({ ...base, midi: open + (HARMONICS[current.midi - open] ?? current.midi - open) });
      continue;
    }
    if (current.bend !== undefined) {
      const up = base.start + duration * 0.25,
        down = base.start + duration * 0.75;
      add({ ...base, end: up }, arrived);
      add({ ...base, start: up, midi: current.bend, end: current.release ? down : base.end }, true);
      if (current.release) add({ ...base, start: down, midi: current.midi }, true);
      continue;
    }
    // glisser, dans le dernier tiers de la note, vers la note suivante (sans la rejouer) ou vers rien
    const to = current.slide ? next(current) : undefined;
    const steps = to ? Math.min(12, Math.abs(to.midi - current.midi) - 1) : current.slideOut ? SLIDE_OUT.frets : 0;
    if (steps > 0 || to) {
      const from = base.start + duration * 0.67,
        dir = to ? Math.sign(to.midi - current.midi) : current.slideOut === "up" ? 1 : -1;
      add({ ...base, end: steps ? from : base.end }, arrived);
      for (let step = 1; step <= steps; step++)
        add(
          {
            ...base,
            midi: current.midi + step * dir,
            start: from + ((step - 1) * (base.end - from)) / steps,
            end: from + (step * (base.end - from)) / steps,
          },
          true,
        );
      if (to) glided.add(to);
      continue;
    }
    add(base, arrived);
  }
  return { score: { ...score, notes }, soft, filter };
}

/** Part de sa durée que garde une note articulée : un staccato sonne moitié moins, un marcato un peu moins. */
const SHORTER: Record<ArticulationKind, number> = { staccato: 0.5, accent: 1, marcato: 0.75, down: 1, up: 1 };
/** Ce qu'ajoute une articulation à l'intensité de la note (vélocité). */
const LOUDER: Record<ArticulationKind, number> = { staccato: 0, accent: 20, marcato: 28, down: 0, up: 0 };

/**
 * Arpèges : pour chaque note, sa place dans l'accord égrené (rien hors arpège). Du grave à l'aigu, ou de l'aigu au grave ; sans portée, tout le système d'un geste.
 */
function rollRanks(score: Score): (Roll | undefined)[] {
  const ranks: (Roll | undefined)[] = score.notes.map(() => undefined);
  for (const arpeggio of score.arpeggios) {
    const chord = score.notes
      .map((note, index) => ({ note, index }))
      .filter(({ note }) => note.start === arpeggio.t && (arpeggio.staff === undefined || note.staff === arpeggio.staff));
    chord.sort((lower, higher) => (arpeggio.down ? higher.note.midi - lower.note.midi : lower.note.midi - higher.note.midi));
    chord.forEach(({ index }, rank) => (ranks[index] = { rank, count: chord.length }));
  }
  return ranks;
}

/**
 * Point d'orgue : à l'instant joué `at`, ce qui commence là (note, accord ou silence, jusqu'à la
 * prochaine attaque) se tient deux fois plus longtemps, d'au plus deux temps de plus. `length` :
 * la durée ainsi doublée, en ticks joués.
 */
export type Hold = { at: number; length: number };

export function holds(score: Score, route: Passage[]): Hold[] {
  const attacks = [...new Set(score.notes.map((note) => note.start))].sort((first, second) => first - second);
  const out: Hold[] = [];
  for (const passage of route)
    for (const tick of score.fermatas) {
      if (tick < passage.from || tick >= passage.to) continue;
      const next = attacks.find((attack) => attack > tick) ?? tick + TICKS_PER_BEAT;
      out.push({ at: passage.at + tick - passage.from, length: Math.min(Math.min(next, passage.to) - tick, 2 * TICKS_PER_BEAT) });
    }
  return out.sort((first, second) => first.at - second.at);
}

/** L'instant d'horloge (en ticks, points d'orgue compris) d'un instant joué. */
export function stretched(hs: Hold[], played: number): number {
  let out = played;
  for (const hold of hs) if (played > hold.at) out += Math.min(played - hold.at, hold.length);
  return out;
}

/** L'instant joué d'un instant d'horloge : pendant un point d'orgue, le temps joué avance deux fois moins vite. */
export function unstretched(hs: Hold[], clock: number): number {
  let shift = 0;
  for (const hold of hs) {
    const start = hold.at + shift; // le point d'orgue sur l'horloge
    if (clock <= start) break;
    if (clock < start + 2 * hold.length) return hold.at + (clock - start) / 2;
    shift += hold.length;
  }
  return clock - shift;
}

/** Le passage joué à un instant joué. */
const passageAt = (route: Passage[], played: number) =>
  route.find((passage) => played >= passage.at && played < passage.at + passage.to - passage.from);

/** L'instant du morceau qui correspond à un instant joué : celui qu'on surligne. */
export function scoreTick(route: Passage[], played: number): number | null {
  const passage = passageAt(route, played);
  return passage ? passage.from + played - passage.at : null;
}

/**
 * L'instant du morceau joué juste après until (la fin d'un système), depuis un instant joué : la
 * suite, ou le retour d'une reprise, ou la section suivante de l'ordre de jeu. null en fin de morceau.
 */
export function nextTick(route: Passage[], played: number, until: number): number | null {
  const passage = passageAt(route, played);
  return passage ? scoreTick(route, passage.at + Math.min(until, passage.to) - passage.from) : null;
}

/**
 * L'instant du morceau joué ensuite hors de [from, to) (un système), depuis un instant joué qui y
 * tombe : la suite, le retour d'une reprise vers un autre système, la section suivante ; une reprise
 * ou une section rejouée sans quitter le système est passée. null si l'on n'en sort plus.
 */
export function nextElsewhere(route: Passage[], played: number, from: number, to: number): number | null {
  const index = route.findIndex((passage) => played >= passage.at && played < passage.at + passage.to - passage.from);
  if (index < 0) return null;
  for (const [offset, passage] of route.slice(index).entries()) {
    // le passage en cours, depuis l'instant joué ; les suivants, depuis leur début
    const start = offset === 0 ? passage.from + played - passage.at : passage.from;
    if (start < from || start >= to) return start;
    if (passage.to > to) return to;
  }
  return null;
}

/** Le rang, dans l'ordre de jeu, de la section jouée à cet instant. */
export const entryAt = (route: Passage[], played: number) => passageAt(route, played)?.entry ?? null;

/** Vrai si l'instant joué tombe dans la première mesure de sa section. */
export function inFirstBar(score: Score, route: Passage[], played: number): boolean {
  const passage = passageAt(route, played);
  const first = passage && route.find((candidate) => candidate.entry === passage.entry);
  if (!first) return false;
  const bar = score.beats[Math.floor(first.from / TICKS_PER_BEAT)]?.barIndex;
  let end = first.from;
  while (score.beats[end / TICKS_PER_BEAT]?.barIndex === bar) end += TICKS_PER_BEAT;
  return played - first.at < end - first.from;
}

/** Une mesure dans l'ordre où elle se joue : l'instant joué où elle commence, où elle finit, et le rang de sa section dans l'ordre de jeu. */
export type PlayedBar = { at: number; end: number; entry: number };

/** Les mesures du morceau, dans l'ordre où elles se jouent : une mesure reprise y est deux fois. */
export function playedBars(score: Score, route: Passage[]): PlayedBar[] {
  // les instants du morceau où commence une mesure
  const starts = new Set(
    score.beats.flatMap((beat, index) =>
      index === 0 || score.beats[index - 1].barIndex !== beat.barIndex ? [index * TICKS_PER_BEAT] : [],
    ),
  );
  const at: { at: number; entry: number }[] = [];
  for (const passage of route)
    for (let tick = passage.from; tick < passage.to; tick += TICKS_PER_BEAT)
      if (starts.has(tick)) at.push({ at: passage.at + tick - passage.from, entry: passage.entry });
  const length = playedLength(route);
  return at.map((start, index) => ({ ...start, end: at[index + 1]?.at ?? length }));
}

/** Une section dans l'ordre de jeu, en mesures jouées : sa lettre (vide sans sections), sa première mesure, leur nombre. */
export type PlayedSection = { entry: number; label: string; first: number; count: number };

/** Les sections dans l'ordre où elles se jouent, chacune avec ses mesures. */
export function playedSections(score: Score, bars: PlayedBar[]): PlayedSection[] {
  const labels = score.order.length
    ? score.order
    : [...score.markers].sort((first, second) => first.barIndex - second.barIndex).map((marker) => marker.label);
  const out: PlayedSection[] = [];
  bars.forEach((playedBar, index) => {
    const last = out[out.length - 1];
    if (last?.entry === playedBar.entry) last.count++;
    else out.push({ entry: playedBar.entry, label: labels[playedBar.entry] ?? "", first: index, count: 1 });
  });
  return out;
}

/** Le rang de la mesure jouée à un instant joué (la dernière, au-delà). */
export function barAt(bars: PlayedBar[], played: number): number {
  let index = 0;
  while (index + 1 < bars.length && bars[index + 1].at <= played) index++;
  return index;
}

/** L'instant joué où commence la section de rang `entry` dans l'ordre de jeu. */
export const entryStart = (route: Passage[], entry: number) => route.find((passage) => passage.entry === entry)?.at ?? null;

/**
 * L'instant joué d'un instant du morceau, quand on clique dessus depuis l'instant joué `current`.
 * Une mesure reprise se joue plusieurs fois : on reste dans le passage en cours s'il la contient ;
 * sinon on prend son passage le plus récent déjà joué (revenir en arrière pour réentendre ce qui
 * précède), sinon le premier à venir.
 */
export function playedTick(route: Passage[], tick: number, current = 0): number | null {
  const all = route.filter((passage) => tick >= passage.from && tick < passage.to).map((passage) => passage.at + tick - passage.from);
  if (!all.length) return null;
  const here = passageAt(route, current);
  if (here && tick >= here.from && tick < here.to) return here.at + tick - here.from;
  const before = all.filter((moment) => moment < current);
  return before.length ? before[before.length - 1] : all[0];
}
