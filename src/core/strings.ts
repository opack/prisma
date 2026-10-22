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
export const isStringInstrument = (i: InstrumentName | undefined): boolean => !!i && !!TUNINGS[i];

/** Les accordages d'un instrument, par leur nom. */
export const tuningsOf = (i: InstrumentName): string[] => Object.keys(TUNINGS[i] ?? {});

/** Les cordes par défaut d'un instrument à cordes : l'accordage standard, sans capo. */
export const defaultStrings = (i: InstrumentName): Strings => stringsOf(i, "standard", 0)!;

/** Les cordes d'un instrument, d'après le nom de son accordage et le capo ; undefined pour un accordage inconnu. */
export function stringsOf(i: InstrumentName, tuning: string, capo: number): Strings | undefined {
  const open = TUNINGS[i]?.[tuning];
  return open && { tuning, open, capo };
}

/** La hauteur qui sonne sur une corde (1 : l'aiguë) à une case. */
export const soundingOf = (s: Strings, string: number, fret: number) => s.open[string - 1] + s.capo + fret;

/** La case d'une hauteur sur une corde : négative si elle sonne plus bas que la corde à vide. */
export const fretOf = (s: Strings, string: number, midi: number) => midi - s.open[string - 1] - s.capo;

/**
 * Une corde pour chaque note qui n'en a pas (une partie importée sans tablature) : la plus
 * aiguë qui la joue, parmi celles qu'aucune note ne fait sonner à cet instant. Une note qui
 * n'a pas de place reste sans corde. Une corde ne joue qu'une note à la fois : une note qui la
 * reprend arrête la précédente.
 */
export function assignStrings<N extends { midi: number; start: number; end: number; string?: number }>(notes: N[], s: Strings): void {
  const busy: (N | undefined)[] = s.open.map(() => undefined);
  for (const n of [...notes].sort((a, b) => a.start - b.start || b.midi - a.midi)) {
    if (n.string === undefined) {
      const free = (k: number) => !busy[k] || busy[k]!.end <= n.start;
      const fits = (k: number) => fretOf(s, k + 1, n.midi) >= 0 && fretOf(s, k + 1, n.midi) <= MAX_FRET;
      // de préférence une corde libre ; sinon celle dont la note s'arrête la première
      const candidates = s.open.map((_, k) => k).filter(fits);
      const k = candidates.find(free) ?? candidates.sort((a, b) => busy[a]!.end - busy[b]!.end)[0];
      if (k === undefined) continue;
      n.string = k + 1;
    }
    const k = n.string - 1;
    const before = busy[k];
    if (before && before.end > n.start) before.end = n.start;
    busy[k] = n;
  }
}

/** L'écart le plus grand entre deux cases appuyées d'un même accord (quatre doigts, et un d'extension). */
const MAX_SPAN = 4;
/** Les placements gardés pour chaque attaque, les moins coûteux. */
const KEEP = 40;

type Placement = { strings: number[]; cost: number; position?: number };

/** Les placements d'un accord (ses notes de l'aiguë à la grave) : une corde par note, à portée de main. */
function placements(midis: number[], strs: Strings): Placement[] {
  const out: Placement[] = [];
  const n = strs.open.length;
  const used = new Array(n + 1).fill(false);
  const chosen: number[] = [];
  const walk = (i: number) => {
    if (i === midis.length) {
      const frets = chosen.map((s, k) => fretOf(strs, s, midis[k]));
      const pressed = frets.filter((f) => f > 0);
      const lo = Math.min(...pressed), hi = Math.max(...pressed);
      const span = pressed.length ? hi - lo : 0;
      if (span > MAX_SPAN) return;
      const opens = frets.length - pressed.length;
      // l'écart des doigts, la hauteur sur le manche, et les cordes à vide, qui laissent la main libre
      const cost = span * 0.6 + (pressed.length ? (lo + hi) / 2 : 0) * 0.12 - opens * 0.4;
      out.push({ strings: [...chosen], cost, ...(pressed.length ? { position: lo } : {}) });
      return;
    }
    for (let s = 1; s <= n; s++) {
      if (used[s]) continue;
      const f = fretOf(strs, s, midis[i]);
      if (f < 0 || f > MAX_FRET) continue;
      used[s] = true;
      chosen.push(s);
      walk(i + 1);
      chosen.pop();
      used[s] = false;
    }
  };
  walk(0);
  return out.sort((a, b) => a.cost - b.cost).slice(0, KEEP);
}

/**
 * Une corde pour chaque note d'une portée, par le doigté le moins coûteux sur tout le morceau. Un
 * accord sans placement possible perd ses notes intérieures, de la plus proche du milieu à la plus
 * éloignée, jusqu'à en trouver un. Une note qui reprend une corde encore tenue arrête la précédente.
 * Rend les notes retirées et le coût du doigté.
 */
export function fingerStrings(notes: Note[], strs: Strings): { dropped: Note[]; cost: number } {
  const dropped: Note[] = [];
  const onsets = [...new Set(notes.map((n) => n.start))].sort((a, b) => a - b);
  const chords = onsets.map((t) => notes.filter((n) => n.start === t).sort((a, b) => b.midi - a.midi));
  const options = chords.map((chord) => {
    let list = placements(chord.map((n) => n.midi), strs);
    while (!list.length && chord.length > 1) {
      // garder l'aigu et la basse : retirer la note intérieure la plus proche du milieu
      const inner = chord.length > 2 ? Math.floor(chord.length / 2) : chord.length - 1;
      dropped.push(...chord.splice(inner, 1));
      list = placements(chord.map((n) => n.midi), strs);
    }
    if (!list.length) dropped.push(...chord.splice(0));
    return list;
  });
  // le chemin le moins coûteux : pour chaque attaque et chaque placement, le meilleur prédécesseur
  const best: number[][] = [];
  const from: number[][] = [];
  options.forEach((list, i) => {
    best.push(list.map(() => Infinity));
    from.push(list.map(() => -1));
    const prev = i > 0 ? options[i - 1] : [];
    // les notes de l'attaque précédente encore tenues ici : les couper coûte
    const ringing = i > 0 ? chords[i - 1].filter((n) => n.end > onsets[i]) : [];
    list.forEach((c, k) => {
      if (!prev.length) {
        best[i][k] = c.cost;
        return;
      }
      prev.forEach((p, j) => {
        if (best[i - 1][j] === Infinity) return;
        const move = c.position !== undefined && p.position !== undefined ? Math.abs(c.position - p.position) : 0;
        const cut = ringing.filter((n) => c.strings.includes(p.strings[chords[i - 1].indexOf(n)])).length * 3;
        const total = best[i - 1][j] + c.cost + move + cut;
        if (total < best[i][k]) [best[i][k], from[i][k]] = [total, j];
      });
      // une attaque sans prédécesseur jouable (l'accord d'avant a tout perdu) : un nouveau départ
      if (best[i][k] === Infinity) best[i][k] = c.cost;
    });
  });
  // en remontant le chemin ; un nouveau départ reprend au meilleur placement de l'attaque d'avant
  let cost = 0;
  for (let i = options.length - 1, k = -1; i >= 0; i--) {
    if (k < 0) {
      k = best[i].indexOf(Math.min(...best[i]));
      if (k < 0) continue;
      cost += best[i][k];
    }
    chords[i].forEach((n, j) => (n.string = options[i][k].strings[j]));
    k = from[i][k];
  }
  assignStrings(notes.filter((n) => !dropped.includes(n)), strs);
  for (const n of notes) if (n.end <= n.start && !dropped.includes(n)) dropped.push(n);
  return { dropped, cost };
}

/**
 * L'instrument et l'accordage qui ont ces cordes à vide (de la 1, l'aiguë, à la plus grave),
 * parmi ceux que connaît Prisma ; undefined pour un autre accordage.
 */
export function tuningOf(open: number[], capo: number): { instrument: InstrumentName; strings: Strings } | undefined {
  for (const [instrument, tunings] of Object.entries(TUNINGS) as [InstrumentName, Record<string, number[]>][]) {
    for (const [tuning, notes] of Object.entries(tunings)) {
      if (notes.length === open.length && notes.every((m, k) => m === open[k])) return { instrument, strings: { tuning, open: notes, capo } };
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
    const strs = part.strings ?? defaultStrings(instrument);
    const plays = (k: number, midi: number) => k >= 1 && k <= strs.open.length && fretOf(strs, k, midi) >= 0 && fretOf(strs, k, midi) <= MAX_FRET;
    const mine = notes.filter((n) => n.staff === staff);
    if (!tab && !mine.every((n) => strs.open.some((_, k) => plays(k + 1, n.midi)))) continue;
    const trial = mine.map((n) => ({ ...n, ...(n.string !== undefined && !plays(n.string, n.midi) ? { string: undefined } : {}) }));
    // sans tablature, le doigté le moins coûteux ; une note qu'il ne place pas garde les couloirs d'octave
    if (tab) assignStrings(trial, strs);
    else if (fingerStrings(trial, strs).dropped.length) continue;
    if (!tab && trial.some((n) => n.string === undefined)) continue;
    part.strings = strs;
    trial.forEach((t, i) => {
      Object.assign(mine[i], { string: t.string, end: t.end });
      if (t.string === undefined || mine[i].end <= mine[i].start) dropped.add(mine[i]);
    });
    // une petite note : sur sa corde, sinon sur celle de sa note, sinon sur la plus aiguë qui la joue
    for (const g of graces.filter((x) => x.staff === staff)) {
      if (g.string !== undefined && plays(g.string, g.midi)) continue;
      const main = mine.find((n) => n.start === g.t && !dropped.has(n) && plays(n.string!, g.midi));
      const k = main?.string ?? strs.open.findIndex((_, k) => plays(k + 1, g.midi)) + 1;
      if (k > 0) g.string = k;
      else delete g.string;
    }
  }
  return notes.filter((n) => !dropped.has(n));
}
