/**
 * Instruments à cordes, écrits comme une tablature : dans une partie de guitare ou de basse,
 * chaque couloir est une corde (« 1 », la plus aiguë, en haut) et le nombre la case où appuyer
 * (« 0 », la corde à vide). La hauteur qui sonne se calcule : la corde à vide, plus le capo,
 * plus la case. L'accordage et le capo s'écrivent après l'instrument, dans `parts:` :
 * « Guitare (guitar, drop-d, capo 2) ».
 */
import { guessInstrument } from "./instruments.ts";
import type { InstrumentName } from "./instruments.ts";
import type { Grace, Note, Part } from "./model.ts";

/** Les cordes d'une partie : leur hauteur à vide (MIDI), de la corde 1 (l'aiguë) à la plus grave, et le capo. */
export type Strings = { tuning: string; open: number[]; capo: number };

/** La plus haute case écrite. */
export const MAX_FRET = 24;
/** La plus haute case où peut se poser le capo. */
export const MAX_CAPO = 12;

/** Les accordages de chaque instrument à cordes, le premier par défaut : la hauteur à vide de chaque corde, de la 1 à la plus grave. */
const TUNINGS: Partial<Record<InstrumentName, Record<string, number[]>>> = {
  guitar: {
    standard: [64, 59, 55, 50, 45, 40], // mi la ré sol si mi, du grave à l'aigu
    "drop-d": [64, 59, 55, 50, 45, 38], // la 6ᵉ corde baissée en ré
    dadgad: [62, 57, 55, 50, 45, 38],
    "open-g": [62, 59, 55, 50, 43, 38], // ré sol ré sol si ré
    "open-d": [62, 57, 54, 50, 45, 38], // ré la ré fa♯ la ré
  },
  "electric-bass": {
    standard: [43, 38, 33, 28], // mi la ré sol
    "drop-d": [43, 38, 33, 26],
  },
};

/** Un instrument dont les couloirs sont des cordes. */
export const isStringInstrument = (instrument: InstrumentName | undefined): boolean => !!instrument && !!TUNINGS[instrument];

/** Les accordages d'un instrument, par leur nom. */
export const tuningsOf = (instrument: InstrumentName): string[] => Object.keys(TUNINGS[instrument] ?? {});

/** Les cordes par défaut d'un instrument à cordes : l'accordage standard, sans capo. */
export const defaultStrings = (instrument: InstrumentName): Strings => stringsOf(instrument, "standard", 0)!;

/** Les cordes d'un instrument, d'après le nom de son accordage et le capo ; undefined pour un accordage inconnu. */
export function stringsOf(instrument: InstrumentName, tuning: string, capo: number): Strings | undefined {
  const open = TUNINGS[instrument]?.[tuning];
  return open && { tuning, open, capo };
}

/** La hauteur qui sonne sur une corde (1 : l'aiguë) à une case. */
export const soundingOf = (strings: Strings, string: number, fret: number) => strings.open[string - 1] + strings.capo + fret;

/** La case d'une hauteur sur une corde : négative si elle sonne plus bas que la corde à vide. */
export const fretOf = (strings: Strings, string: number, midi: number) => midi - strings.open[string - 1] - strings.capo;

/**
 * Une corde pour chaque note qui n'en a pas (une partie importée sans tablature) : la plus
 * aiguë qui la joue, parmi celles qu'aucune note ne fait sonner à cet instant. Une note qui
 * n'a pas de place reste sans corde. Une corde ne joue qu'une note à la fois : une note qui la
 * reprend arrête la précédente.
 */
export function assignStrings<N extends { midi: number; start: number; end: number; string?: number }>(notes: N[], strings: Strings): void {
  const busy: (N | undefined)[] = strings.open.map(() => undefined);
  for (const note of [...notes].sort((first, second) => first.start - second.start || second.midi - first.midi)) {
    if (note.string === undefined) {
      const free = (index: number) => !busy[index] || busy[index]!.end <= note.start;
      const fits = (index: number) => fretOf(strings, index + 1, note.midi) >= 0 && fretOf(strings, index + 1, note.midi) <= MAX_FRET;
      // de préférence une corde libre ; sinon celle dont la note s'arrête la première
      const candidates = strings.open.map((_, index) => index).filter(fits);
      const chosen = candidates.find(free) ?? candidates.sort((first, second) => busy[first]!.end - busy[second]!.end)[0];
      if (chosen === undefined) continue;
      note.string = chosen + 1;
    }
    const stringIndex = note.string - 1;
    const before = busy[stringIndex];
    if (before && before.end > note.start) before.end = note.start;
    busy[stringIndex] = note;
  }
}

/** L'écart le plus grand entre deux cases appuyées d'un même accord (quatre doigts, et un d'extension). */
const MAX_SPAN = 4;
/** Les placements gardés pour chaque attaque, les moins coûteux. */
const KEEP = 40;

type Placement = { strings: number[]; cost: number; position?: number };

/** Les placements d'un accord (ses notes de l'aiguë à la grave) : une corde par note, à portée de main. */
function placements(midis: number[], strings: Strings): Placement[] {
  const out: Placement[] = [];
  const stringCount = strings.open.length;
  const used = new Array(stringCount + 1).fill(false);
  const chosen: number[] = [];
  const walk = (index: number) => {
    if (index === midis.length) {
      const frets = chosen.map((string, noteIndex) => fretOf(strings, string, midis[noteIndex]));
      const pressed = frets.filter((fret) => fret > 0);
      const lowest = Math.min(...pressed),
        highest = Math.max(...pressed);
      const span = pressed.length ? highest - lowest : 0;
      if (span > MAX_SPAN) return;
      const opens = frets.length - pressed.length;
      // l'écart des doigts, la hauteur sur le manche, et les cordes à vide, qui laissent la main libre
      const cost = span * 0.6 + (pressed.length ? (lowest + highest) / 2 : 0) * 0.12 - opens * 0.4;
      out.push({ strings: [...chosen], cost, ...(pressed.length ? { position: lowest } : {}) });
      return;
    }
    for (let string = 1; string <= stringCount; string++) {
      if (used[string]) continue;
      const fret = fretOf(strings, string, midis[index]);
      if (fret < 0 || fret > MAX_FRET) continue;
      used[string] = true;
      chosen.push(string);
      walk(index + 1);
      chosen.pop();
      used[string] = false;
    }
  };
  walk(0);
  return out.sort((first, second) => first.cost - second.cost).slice(0, KEEP);
}

/**
 * Une corde pour chaque note d'une portée, par le doigté le moins coûteux sur tout le morceau. Un
 * accord sans placement possible perd ses notes intérieures, de la plus proche du milieu à la plus
 * éloignée, jusqu'à en trouver un. Une note qui reprend une corde encore tenue arrête la précédente.
 * Rend les notes retirées et le coût du doigté.
 */
export function fingerStrings(notes: Note[], strings: Strings): { dropped: Note[]; cost: number } {
  const dropped: Note[] = [];
  const onsets = [...new Set(notes.map((note) => note.start))].sort((first, second) => first - second);
  const chords = onsets.map((start) => notes.filter((lower) => lower.start === start).sort((higher, lower) => lower.midi - higher.midi));
  const options = chords.map((chord) => {
    let list = placements(
      chord.map((note) => note.midi),
      strings,
    );
    while (!list.length && chord.length > 1) {
      // garder l'aigu et la basse : retirer la note intérieure la plus proche du milieu
      const inner = chord.length > 2 ? Math.floor(chord.length / 2) : chord.length - 1;
      dropped.push(...chord.splice(inner, 1));
      list = placements(
        chord.map((note) => note.midi),
        strings,
      );
    }
    if (!list.length) dropped.push(...chord.splice(0));
    return list;
  });
  // le chemin le moins coûteux : pour chaque attaque et chaque placement, le meilleur prédécesseur
  const best: number[][] = [];
  const from: number[][] = [];
  options.forEach((list, index) => {
    best.push(list.map(() => Infinity));
    from.push(list.map(() => -1));
    const prev = index > 0 ? options[index - 1] : [];
    // les notes de l'attaque précédente encore tenues ici : les couper coûte
    const ringing = index > 0 ? chords[index - 1].filter((note) => note.end > onsets[index]) : [];
    list.forEach((placement, placementIndex) => {
      if (!prev.length) {
        best[index][placementIndex] = placement.cost;
        return;
      }
      prev.forEach((previous, previousIndex) => {
        if (best[index - 1][previousIndex] === Infinity) return;
        const move =
          placement.position !== undefined && previous.position !== undefined ? Math.abs(placement.position - previous.position) : 0;
        const cut = ringing.filter((note) => placement.strings.includes(previous.strings[chords[index - 1].indexOf(note)])).length * 3;
        const total = best[index - 1][previousIndex] + placement.cost + move + cut;
        if (total < best[index][placementIndex]) [best[index][placementIndex], from[index][placementIndex]] = [total, previousIndex];
      });
      // une attaque sans prédécesseur jouable (l'accord d'avant a tout perdu) : un nouveau départ
      if (best[index][placementIndex] === Infinity) best[index][placementIndex] = placement.cost;
    });
  });
  // en remontant le chemin ; un nouveau départ reprend au meilleur placement de l'attaque d'avant
  let cost = 0;
  for (let index = options.length - 1, placementIndex = -1; index >= 0; index--) {
    if (placementIndex < 0) {
      placementIndex = best[index].indexOf(Math.min(...best[index]));
      if (placementIndex < 0) continue;
      cost += best[index][placementIndex];
    }
    chords[index].forEach((note, noteIndex) => (note.string = options[index][placementIndex].strings[noteIndex]));
    placementIndex = from[index][placementIndex];
  }
  assignStrings(
    notes.filter((note) => !dropped.includes(note)),
    strings,
  );
  for (const note of notes) if (note.end <= note.start && !dropped.includes(note)) dropped.push(note);
  return { dropped, cost };
}

/**
 * L'instrument et l'accordage qui ont ces cordes à vide (de la 1, l'aiguë, à la plus grave),
 * parmi ceux que connaît Prisma ; undefined pour un autre accordage.
 */
export function tuningOf(open: number[], capo: number): { instrument: InstrumentName; strings: Strings } | undefined {
  for (const [instrument, tunings] of Object.entries(TUNINGS) as [InstrumentName, Record<string, number[]>][]) {
    for (const [tuning, notes] of Object.entries(tunings)) {
      if (notes.length === open.length && notes.every((midi, index) => midi === open[index]))
        return { instrument, strings: { tuning, open: notes, capo } };
    }
  }
  return undefined;
}

/**
 * Les cordes des parties d'instrument à cordes d'un morceau importé, d'une seule portée. Une
 * partie lue d'une tablature a déjà ses cordes, et ses notes la leur ; les autres reçoivent
 * l'accordage standard. Une note sans corde (ou dont la corde ne la joue pas) prend la plus aiguë
 * qui la joue et que rien d'autre ne fait sonner ; sans tablature, une partie dont une note ne
 * trouve pas de corde (trop grave pour l'instrument) garde ses couloirs d'octave. Rend les notes,
 * sans celles qui n'ont pas de corde dans une tablature, ni celles qu'une autre note a
 * entièrement recouvertes sur leur corde.
 */
export function stringParts(parts: Part[], notes: Note[], graces: Grace[]): Note[] {
  let first = 0;
  const dropped = new Set<Note>();
  for (const part of parts) {
    const staff = first;
    first += part.staves;
    const instrument = part.instrument ?? guessInstrument(part.name);
    const tab = !!part.strings;
    if (!tab && (!isStringInstrument(instrument) || part.staves !== 1)) continue;
    const strings = part.strings ?? defaultStrings(instrument);
    const plays = (string: number, midi: number) =>
      string >= 1 && string <= strings.open.length && fretOf(strings, string, midi) >= 0 && fretOf(strings, string, midi) <= MAX_FRET;
    const mine = notes.filter((note) => note.staff === staff);
    if (!tab && !mine.every((note) => strings.open.some((_, index) => plays(index + 1, note.midi)))) continue;
    const trial = mine.map((note) => ({
      ...note,
      ...(note.string !== undefined && !plays(note.string, note.midi) ? { string: undefined } : {}),
    }));
    // sans tablature, le doigté le moins coûteux ; une note qu'il ne place pas garde les couloirs d'octave
    if (tab) assignStrings(trial, strings);
    else if (fingerStrings(trial, strings).dropped.length) continue;
    if (!tab && trial.some((note) => note.string === undefined)) continue;
    part.strings = strings;
    trial.forEach((settled, index) => {
      Object.assign(mine[index], { string: settled.string, end: settled.end });
      if (settled.string === undefined || mine[index].end <= mine[index].start) dropped.add(mine[index]);
    });
    // une petite note : sur sa corde, sinon sur celle de sa note, sinon sur la plus aiguë qui la joue
    for (const grace of graces.filter((candidate) => candidate.staff === staff)) {
      if (grace.string !== undefined && plays(grace.string, grace.midi)) continue;
      const main = mine.find((note) => note.start === grace.t && !dropped.has(note) && plays(note.string!, grace.midi));
      const string = main?.string ?? strings.open.findIndex((_, index) => plays(index + 1, grace.midi)) + 1;
      if (string > 0) grace.string = string;
      else delete grace.string;
    }
  }
  return settleSlides(notes.filter((note) => !dropped.has(note)));
}

/**
 * Les glissés d'un morceau importé ou converti, rendus justes. Un glissé vers la note suivante
 * prend le sens de la note qui suit sur la corde, si elle vient sans silence ; sinon, il devient un
 * glissé de sortie. Hors des cordes, une note ne glisse pas.
 */
export function settleSlides(notes: Note[]): Note[] {
  return notes.map((note) => {
    const { slide, slideIn, slideOut, ...rest } = note;
    if (note.string === undefined) return slide || slideIn || slideOut ? rest : note;
    if (!slide) return note;
    const next = notes
      .filter((other) => other.staff === note.staff && other.string === note.string && other.start > note.start)
      .sort((first, second) => first.start - second.start)[0];
    if (next && next.start === note.end && next.midi !== note.midi)
      return { ...rest, ...(slideIn ? { slideIn } : {}), slide: next.midi > note.midi ? "up" : "down" };
    return { ...rest, ...(slideIn ? { slideIn } : {}), slideOut: slide };
  });
}
