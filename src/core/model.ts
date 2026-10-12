/**
 * Modèle musical commun, indépendant de toute mise en page.
 *
 * Le temps est mesuré en « ticks » à partir du début du morceau, avec une valeur
 * fixe par temps (pulsation), quelle que soit la métrique : un temps de noire en 4/4
 * et un temps de noire pointée en 6/8 valent tous deux TICKS_PER_BEAT.
 * Cette unité est divisible par 2⁶, 3² et 5 : doubles croches, triolets dans des
 * mesures composées et quintolets tombent sur des valeurs entières.
 */
export const TICKS_PER_BEAT = 2880;

export type Hand = "D" | "G";

/** Découpage de premier niveau d'un temps : en 2 (binaire) ou en 3 (ternaire). */
export type Division = 2 | 3;

export type Beat = {
  /** Numéro de la mesure, tel qu'affiché (« 12 », « 0 » pour une anacrouse…). */
  bar: string;
  /** Rang de la mesure dans le morceau (0, 1, 2…), distinct même si les numéros se répètent. */
  barIndex: number;
  /** Numéro du temps dans la mesure, à partir de 1. Une anacrouse commence à un numéro > 1. */
  label: number;
  /** Découpage par défaut de ce temps. */
  division: Division;
};

export type Note = {
  hand: Hand;
  /** Hauteur MIDI : 60 = do central (do 4). */
  midi: number;
  /** Début et fin en ticks, fin exclue. */
  start: number;
  end: number;
};

export type Meta = {
  title?: string;
  composer?: string;
  tempo?: string;
  source?: string;
  /** Largeur d'une case dans le texte .ymn (3 par défaut). */
  cell?: number;
  /** Autres clés du frontmatter, conservées telles quelles. */
  [key: string]: string | number | undefined;
};

/** Barre de reprise portée par une mesure (repérée par son rang dans le morceau). */
export type Repeat = {
  barIndex: number;
  /** « ||: » : un passage répété commence au début de cette mesure. */
  start?: boolean;
  /** « :|| » : le passage répété se termine à la fin de cette mesure. */
  end?: boolean;
  /** Nombre de passages, pour une fin de reprise (2 par défaut). */
  times?: number;
};

/**
 * Case de reprise (« 1. », « 2. », « 1.2. »…), de la mesure firstBar à lastBar incluses.
 * open : la case n'a pas de fin explicite (ni « ] » ni « :|| ») ; comme sur une partition,
 * son crochet n'est tracé qu'au-dessus de sa première mesure.
 */
export type Ending = { numbers: number[]; firstBar: number; lastBar: number; open?: boolean };

/** Indication de texte pour tout le système, placée sur une ancre (« rit. », « D.C. »…). */
export type TextMark = { t: number; text: string };

/** Nuances reconnues : écrites en gras italique, comme sur une partition. */
export const DYNAMICS = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "sf", "sfz", "sfp", "fp", "fz", "rfz"];

/**
 * Indication propre à une voix, placée sur une ancre : une nuance (« p », « mf »…) ou un
 * texte (« cresc. », « dolce »…).
 */
export type Expression = { hand: Hand; t: number; text: string; kind: "dynamic" | "text" };

/** Soufflet d'une voix : crescendo (« < ») ou decrescendo (« > »), de start à end (fin exclue). */
export type Hairpin = { hand: Hand; kind: "<" | ">"; start: number; end: number };

/** Soufflet écrit sur une ligne @ de voix : « <---- » (crescendo) ou « >---- » (decrescendo). */
export const isHairpin = (t: string) => /^[<>][-|]*$/.test(t);

export type Score = {
  meta: Meta;
  /** Temps du morceau, dans l'ordre. Le temps i couvre [i·TICKS_PER_BEAT, (i+1)·TICKS_PER_BEAT[. */
  beats: Beat[];
  notes: Note[];
  repeats: Repeat[];
  endings: Ending[];
  texts: TextMark[];
  expressions: Expression[];
  hairpins: Hairpin[];
};

/** Reprise portée par une mesure, s'il y en a une. */
export const repeatOf = (score: Score, barIndex: number) => score.repeats.find((r) => r.barIndex === barIndex);

export const beatStart = (i: number) => i * TICKS_PER_BEAT;

/** Trie les notes de façon stable : par début, main droite d'abord, de l'aigu au grave. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => a.start - b.start || (a.hand === b.hand ? 0 : a.hand === "D" ? -1 : 1) || b.midi - a.midi || a.end - b.end,
  );
}
