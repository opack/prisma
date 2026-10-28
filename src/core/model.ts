/**
 * Modèle musical commun, indépendant de toute mise en page.
 *
 * Le temps est mesuré en « ticks » à partir du début du morceau, avec une valeur
 * fixe par temps (pulsation), quelle que soit la métrique : un temps de noire en 4/4
 * et un temps de noire pointée en 6/8 valent tous deux TICKS_PER_BEAT.
 * Cette unité est divisible par 2⁶, 3² et 5 : doubles croches, triolets dans des
 * mesures composées et quintolets tombent sur des valeurs entières.
 */
import type { InstrumentName } from "./instruments.ts";
import type { Strings } from "./strings.ts";

export const TICKS_PER_BEAT = 2880;

/**
 * Portée : un groupe de lignes entre deux traits (une main au piano, une voix, une flûte),
 * repérée par son rang, de haut en bas (0 pour la première).
 */
export type Staff = number;

/**
 * Partie : une ou plusieurs portées qui se suivent (le piano en a deux). name : son nom,
 * déclaré dans le frontmatter (`parts:`) et écrit sur le trait au-dessus de sa première portée.
 * instrument : celui qui la joue à l'écoute, écrit après son nom (« Chœur (flute) ») ; absent,
 * son nom le fait deviner.
 */
/** strings : une partie d'instrument à cordes (une seule portée), ses couloirs sont ses cordes. */
export type Part = { name?: string; staves: number; instrument?: InstrumentName; strings?: Strings };

/** Partie de chaque portée : son rang dans la liste des parties. */
export function partOf(parts: Part[], staff: Staff): number {
  let first = 0;
  for (let i = 0; i < parts.length; i++) {
    first += parts[i].staves;
    if (staff < first) return i;
  }
  return parts.length - 1;
}

/** Première portée de chaque partie. */
export const firstStaves = (parts: Part[]) => parts.map((_, i) => parts.slice(0, i).reduce((n, x) => n + x.staves, 0));

/** Les cordes d'une portée, quand elle est celle d'un instrument à cordes. */
export const stringsOfStaff = (parts: Part[], staff: Staff): Strings | undefined => parts[partOf(parts, staff)]?.strings;

/** Nombre total de portées. */
export const staffCount = (parts: Part[]) => parts.reduce((n, x) => n + x.staves, 0);

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
  staff: Staff;
  /** Hauteur MIDI : 60 = do central (do 4). */
  midi: number;
  /** Début et fin en ticks, fin exclue. */
  start: number;
  end: number;
  /** Trille : hauteur MIDI de la note voisine (celle du dessus), alternée pendant toute la note. */
  trill?: number;
  /** Doigté : le doigt qui joue la note (1 = pouce, 5 = auriculaire). */
  finger?: number;
  /** Instrument à cordes : la corde qui joue la note (1 : la plus aiguë). */
  string?: number;
  /** Instrument à cordes, note étouffée (« x ») : la main ne fait que toucher la corde, un son sec sans hauteur. */
  dead?: boolean;
  /** Instrument à cordes, harmonique naturelle (« <12> ») : effleurée sur la case, elle sonne plus haut (voir HARMONICS). */
  harmonic?: boolean;
  /**
   * Instrument à cordes, glissé vers la note suivante de la corde, sans la rejouer : vers l'aigu
   * (« 7/ » puis 9) ou le grave (« 9\ » puis 7).
   */
  slide?: Direction;
  /** Instrument à cordes, glissé de sortie (« 7// », « 7\\ ») : la note s'éteint en glissant, vers rien. */
  slideOut?: Direction;
  /** Instrument à cordes, glissé d'entrée (« //7 », « \\7 ») : la note arrive en glissant, depuis rien, d'en dessous ou d'au-dessus. */
  slideIn?: Direction;
  /** Instrument à cordes, bend (« 7b9 ») : la corde tirée jusqu'à cette hauteur ; release (« 7b9r ») : puis relâchée. */
  bend?: number;
  release?: boolean;
};

/** Le sens d'un glissé : vers l'aigu, vers le grave. */
export type Direction = "up" | "down";

/** Techniques des cordes, dans une case : note étouffée, harmonique, glissé, bend et son relâché. */
export const DEAD_MARK = "x";
export const BEND_MARK = "b";
export const RELEASE_MARK = "r";
/** Le glissé, vers l'aigu ou le grave ; doublé, il vient de rien ou y va (« //7 », « 7// »). */
export const SLIDE_MARKS: Record<Direction, string> = { up: "/", down: "\\" };

/** Une case de corde qui porte une technique, lue : ce qu'elle écrit, et ce qu'elle joue. */
export type StringCell = {
  /** Ce que la partition grave du chiffre : la case, « x », « <12> ». */
  label: string;
  fret: number;
  dead: boolean;
  harmonic: boolean;
  slide?: Direction;
  slideOut?: Direction;
  slideIn?: Direction;
  /** La case dont le bend prend le son. */
  bend?: number;
  release: boolean;
  finger?: number;
};

const STRING_CELL = /^(?:(x)|<(\d{1,2})>|(\/\/|\\\\)?(\d{1,2})(\/\/|\\\\|\/|\\|b(\d{1,2})(r)?)?)(?:_(\d))?$/;
const direction = (s: string): Direction => (s[0] === "/" ? "up" : "down");

/**
 * Lit une case de corde qui porte une technique (« x », « <12> », « 7/ », « 7\\ », « //7 »,
 * « 7b9r », suivie ou non d'un doigt). Undefined pour une autre case, une case simple comprise.
 */
export function stringCell(c: string): StringCell | undefined {
  const m = c.match(STRING_CELL);
  if (!m) return undefined;
  const [, dead, harmonic, into, fret, after, bend, release, finger] = m;
  if (fret !== undefined && !into && !after) return undefined;
  const out = after?.length === 2 && after[0] === after[1];
  return {
    label: dead ? DEAD_MARK : harmonic ? `<${harmonic}>` : fret,
    fret: Number(harmonic ?? fret ?? 0),
    dead: !!dead,
    harmonic: !!harmonic,
    ...(into ? { slideIn: direction(into) } : {}),
    ...(after && !bend && !out ? { slide: direction(after) } : {}),
    ...(after && out ? { slideOut: direction(after) } : {}),
    ...(bend !== undefined ? { bend: Number(bend) } : {}),
    release: !!release,
    ...(finger ? { finger: Number(finger) } : {}),
  };
}

/** Le texte d'un glissé dans une case : avant la case, il vient de rien ; après, il va vers la note suivante, ou, doublé, vers rien. */
export const slideText = (d: Direction, double: boolean) => SLIDE_MARKS[d].repeat(double ? 2 : 1);

/**
 * Harmoniques naturelles : la case effleurée, et ce dont la note monte au-dessus de la corde à
 * vide (en demi-tons) : l'octave au milieu de la corde, la quinte au-dessus au tiers…
 */
export const HARMONICS: Record<number, number> = { 12: 12, 7: 19, 19: 19, 5: 24, 24: 24, 4: 28, 9: 28, 16: 28, 3: 31 };

/** L'écart le plus grand d'un bend : deux tons (quatre cases). */
export const MAX_BEND = 4;

/** Doigté dans une case : la note, « _ », puis le doigt (« 5_3 ») ; gravé en indice. */
export const FINGER_MARK = "_";

/** Trille dans une case : la note, « ~ », puis sa voisine (« 5~7 »). */
export const TRILL_MARK = "~";

/** Voisine d'une trille notée par son numéro : la plus proche qui le porte, au-dessus ou au-dessous. */
export function trillAux(midi: number, number: number): number {
  const up = ((number - 1 - (midi % 12) + 12) % 12) || 12;
  return up <= 6 ? midi + up : midi + up - 12;
}

/**
 * Arpège : l'accord qui commence à l'instant t s'égrène, du grave à l'aigu (down : de
 * l'aigu au grave). part : la portée dont l'accord s'égrène ; absente, toutes les portées
 * d'un seul geste, de la note la plus grave du système à la plus aiguë.
 */
export type Arpeggio = { t: number; staff?: Staff; down?: boolean };

/** Arpège sur une ligne @ : « / » du grave à l'aigu, « \ » de l'aigu au grave. */
export const ARPEGGIO_UP = "/";
export const ARPEGGIO_DOWN = "\\";
export const isArpeggioSign = (t: string) => t === ARPEGGIO_UP || t === ARPEGGIO_DOWN;

/**
 * Articulation : la manière d'attaquer ce que la portée joue à l'instant t (une note, ou
 * tout l'accord). staccato : détaché, plus court ; accent : plus fort que ses voisines ;
 * marcato : accent plus fort et plus sec.
 */
export type Articulation = { staff: Staff; t: number; kind: ArticulationKind };
export type ArticulationKind = "staccato" | "accent" | "marcato" | "down" | "up";

/**
 * Articulations sur une ligne @ de portée : « . » staccato, « ! » accent, « !! » marcato ; pour
 * un instrument à cordes, le sens du médiator : « d » vers le bas, « u » vers le haut.
 */
export const ARTICULATION_SIGNS: Record<ArticulationKind, string> = { staccato: ".", accent: "!", marcato: "!!", down: "d", up: "u" };
/** Le sens du médiator (ou de l'archet), propre aux instruments à cordes. */
export const isPick = (k: ArticulationKind) => k === "down" || k === "up";
export const articulationOf = (t: string) => (Object.keys(ARTICULATION_SIGNS) as ArticulationKind[]).find((k) => ARTICULATION_SIGNS[k] === t);
export const isArticulationSign = (t: string) => articulationOf(t) !== undefined;

/**
 * Petite note : jouée très vite juste avant l'instant t, sans compter dans le temps.
 * slot : rang dans la suite des petites notes de cette portée à cet instant (0 en premier) ;
 * deux petites notes de même rang se jouent ensemble.
 */
export type Grace = { staff: Staff; midi: number; t: number; slot: number; string?: number };

/** Marque d'une petite note dans une case : son numéro suivi d'une apostrophe (« 3'5 »). */
export const GRACE_MARK = "'";

export type Meta = {
  title?: string;
  /** Sous-titre, gravé sous le titre : « Op. 9 n° 2 », « Suite bergamasque, 3ᵉ mouvement »… */
  subtitle?: string;
  composer?: string;
  /** Tempo, en temps par minute : le temps de la règle de comptage (la noire pointée d'un 6/8). */
  bpm?: number;
  /** Tonalité, pour information, telle qu'écrite : « 8 », « 5:m », « G », « Em » (voir key.ts). */
  key?: string;
  source?: string;
  /** Notes sur le morceau, pour soi ou pour qui le reçoit : gardées dans le fichier, jamais gravées. */
  notes?: string;
  /** Largeur d'une case dans le texte .prisma (3 par défaut). */
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

/** Indication de texte pour tout le système, placée sur une ancre (« rit. », « D.C. »…). */
export type TextMark = { t: number; text: string };

/** Nuances reconnues : écrites en gras italique, comme sur une partition. */
export const DYNAMICS = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff", "sf", "sfz", "sfp", "fp", "fz", "rfz"];

/** Nuance, éventuellement entre parenthèses (nuance ajoutée par l'éditeur : « (mp) »). */
export const isDynamic = (t: string) => DYNAMICS.includes(t.replace(/^\((.+)\)$/, "$1"));

/** Nuances écrites en toutes lettres dans un texte, et leur signe. */
const DYNAMIC_WORDS: Record<string, string> = { pianississimo: "ppp", pianissimo: "pp", mezzopiano: "mp", piano: "p", mezzoforte: "mf", forte: "f", fortissimo: "ff", fortississimo: "fff" };

/** La nuance qu'un texte écrit en toutes lettres (« sempre pianissimo » : pp), s'il y en a une. */
export function dynamicInWords(text: string): string | undefined {
  const word = /\b(pianississimo|pianissimo|mezzo[ -]?piano|piano|mezzo[ -]?forte|fortississimo|fortissimo|forte)\b/i.exec(text)?.[1];
  return word && DYNAMIC_WORDS[word.toLowerCase().replace(/[ -]/, "")];
}

/**
 * Indication propre à une voix, placée sur une ancre : une nuance (« p », « mf »…) ou un
 * texte (« cresc. », « dolce »…).
 */
export type Expression = { staff: Staff; t: number; text: string; kind: "dynamic" | "text" };

/** Soufflet d'une voix : crescendo (« < ») ou decrescendo (« > »), de start à end (fin exclue). */
export type Hairpin = { staff: Staff; kind: "<" | ">"; start: number; end: number };

/** Soufflet écrit sur une ligne @ de voix : « <---- » (crescendo) ou « >---- » (decrescendo). */
export const isHairpin = (t: string) => /^[<>][-|]*$/.test(t);

/**
 * Jeu d'un instrument à cordes qui dure, sur une voix, de start à end (fin exclue) : l'étouffé
 * de la paume (« P.M.--- ») ou le vibrato (« ~~~~ »).
 */
export type Effect = { staff: Staff; kind: EffectKind; start: number; end: number };
export type EffectKind = "palmMute" | "vibrato";
/** Le signe d'un jeu qui dure, sur une ligne @ de voix, et sa suite (des traits, ou des vagues). */
export const EFFECT_SIGNS: Record<EffectKind, string> = { palmMute: "P.M.", vibrato: "~" };
export const effectOf = (t: string): EffectKind | undefined => (/^P\.M\.[-|]*$/.test(t) ? "palmMute" : /^~+\|?$/.test(t) ? "vibrato" : undefined);
export const isEffect = (t: string) => effectOf(t) !== undefined;

/**
 * Liaison d'expression d'une voix : les notes de start à end se jouent liées. end est
 * l'attaque de la dernière note liée (comprise).
 */
export type Slur = { staff: Staff; start: number; end: number };

/**
 * Liaison écrite sur une ligne @ de voix : « (-----) », de la case de la première note à
 * celle de la dernière. Coupée par un changement de système : « (----- » puis « ----) »
 * (« ------ » pour un système qu'elle traverse tout entier).
 */
export const isSlur = (t: string) => /^\([-|]*\)?$/.test(t) || /^-[-|]*\)?$/.test(t);
// plusieurs liaisons d'une portée qui continuent : leurs suites se lisent de haut en bas, dans
// l'ordre où les liaisons ont commencé

/**
 * Pédale de résonance enfoncée de start à end (fin exclue). Deux pédales qui se touchent
 * (end de l'une = start de la suivante) forment un changement de pédale. part : la portée
 * sous laquelle elle s'écrit, la dernière de sa partie. implied : pédale non écrite, déduite
 * d'un « Ped. simile » pour la gravure (jamais lue ni écrite dans le fichier).
 */
export type Pedal = { staff: Staff; start: number; end: number; implied?: boolean };

/** Consigne de pédale (« Ped. simile »…), sur la ligne de pédale d'une portée. */
export type PedalText = TextMark & { staff: Staff };

/** Signes de pédale d'une ligne @ sous la dernière portée d'une partie : enfoncer, relâcher, changer. */
export const PEDAL_DOWN = "Ped.";
export const PEDAL_UP = "*";
export const PEDAL_CHANGE = "*Ped.";
export const isPedalSign = (t: string) => t === PEDAL_DOWN || t === PEDAL_UP || t === PEDAL_CHANGE;
/** Consigne de pédale (« Ped. simile », « Ped. sempre ») : un texte, écrit sur la ligne de pédale. */
export const isPedalText = (t: string) => /^Ped\.\s+\S/.test(t);

/**
 * Début de section (« [A] », comme l'étiquette gravée : la lettre dans un cadre) : une lettre posée au début d'une mesure. La section va
 * jusqu'au début de la suivante. L'ordre de jeu (Score.order) enchaîne les sections :
 * il remplace cases, D.C., D.S., segno, coda et Fine.
 */
export type Marker = { label: string; barIndex: number };

/** Point d'orgue, sur la ligne @ du haut : « ^ », l'arc du signe 𝄐. */
export const FERMATA = "^";

/** Signe d'un début de section, sur la ligne @ du haut. */
export const MARKER_SIGN = /^\[([A-Z])\]$/;
export const isStructureSign = (t: string) => MARKER_SIGN.test(t);

/** Signe toujours lu à part sur une ligne @ : soufflet, signe de pédale, début de section. */
export const isSign = (t: string) => isHairpin(t) || isEffect(t) || isSlur(t) || isPedalSign(t) || isStructureSign(t) || t === FERMATA || isArpeggioSign(t) || isArticulationSign(t);

/**
 * Deux mots d'une ligne @ séparés par une seule espace forment un seul texte (« a tempo »,
 * « più f », « Ped. simile »), sauf si le second est un signe, ou si le premier est un
 * soufflet ou un début de section.
 */
export const joinsText = (prev: string, next: string) =>
  !isSign(next) && !isHairpin(prev) && !isEffect(prev) && !isSlur(prev) && !isStructureSign(prev) && prev !== FERMATA && !isArpeggioSign(prev) && !isArticulationSign(prev);

/**
 * Syllabe de paroles, chantée sur la note de sa portée qui commence à t. verse : couplet (1, 2…).
 * hyphen : le mot continue sur la syllabe suivante (« lu- ne »). extend : le mot se prolonge
 * sur plusieurs notes (mélisme), jusqu'à cet instant (fin exclue).
 */
export type Lyric = { staff: Staff; verse: number; t: number; text: string; hyphen?: boolean; extend?: number };

/** Ligne des paroles d'un couplet, sous les lignes d'une portée : « @l », puis chaque syllabe sur sa case. */
export const LYRIC_LINE = "@l";
/** Fin de syllabe : le mot continue sur la syllabe suivante (« lu- »). */
export const HYPHEN = "-";
/** Prolongation d'une syllabe sur les notes suivantes (« ne ---- »), comme une tenue. */
export const isExtender = (t: string) => /^-[-|]*$/.test(t);

export type Score = {
  meta: Meta;
  /** Parties, de haut en bas ; leurs portées se suivent dans cet ordre. */
  parts: Part[];
  /** Temps du morceau, dans l'ordre. Le temps i couvre [i·TICKS_PER_BEAT, (i+1)·TICKS_PER_BEAT[. */
  beats: Beat[];
  notes: Note[];
  /** Petites notes, rangées par instant, portée, rang, de l'aigu au grave. */
  graces: Grace[];
  repeats: Repeat[];
  texts: TextMark[];
  expressions: Expression[];
  hairpins: Hairpin[];
  /** Jeux des cordes qui durent : étouffé de la paume, vibrato. */
  effects: Effect[];
  slurs: Slur[];
  pedals: Pedal[];
  /** Consignes de pédale (« Ped. simile »…), sur la ligne de pédale. */
  pedalTexts: PedalText[];
  markers: Marker[];
  /** Accords d'accompagnement (ligne `@c`), tels qu'écrits : nom anglais ou notes Prisma. */
  chords: TextMark[];
  /** Paroles, par instant, portée et couplet. */
  lyrics: Lyric[];
  /** Arpèges, par instant. */
  arpeggios: Arpeggio[];
  /** Articulations, par instant et portée. */
  articulations: Articulation[];
  /** Points d'orgue : instants où l'on tient la note, l'accord ou le silence plus longtemps. */
  fermatas: number[];
  /** Ordre de jeu des sections, par leur lettre ; vide : le morceau se joue d'un bout à l'autre. */
  order: string[];
};

/** Reprise portée par une mesure, s'il y en a une. */
export const repeatOf = (score: Score, barIndex: number) => score.repeats.find((r) => r.barIndex === barIndex);

export const beatStart = (i: number) => i * TICKS_PER_BEAT;

/** Trie les notes de façon stable : par début, portée du haut d'abord, de l'aigu au grave. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => a.start - b.start || a.staff - b.staff || b.midi - a.midi || a.end - b.end,
  );
}

/** Trie les petites notes : par instant, portée du haut d'abord, par rang, de l'aigu au grave. */
const ARTICULATION_ORDER: ArticulationKind[] = ["staccato", "accent", "marcato", "down", "up"];
/** Trie les articulations : par instant, portée, puis staccato, accent, marcato. */
export function sortArticulations(xs: Articulation[]): Articulation[] {
  return [...xs].sort((a, b) => a.t - b.t || a.staff - b.staff || ARTICULATION_ORDER.indexOf(a.kind) - ARTICULATION_ORDER.indexOf(b.kind));
}

/** Trie les paroles : par instant, portée du haut d'abord, par couplet. */
export function sortLyrics(lyrics: Lyric[]): Lyric[] {
  return [...lyrics].sort((a, b) => a.t - b.t || a.staff - b.staff || a.verse - b.verse);
}

export function sortGraces(graces: Grace[]): Grace[] {
  return [...graces].sort(
    (a, b) => a.t - b.t || a.staff - b.staff || a.slot - b.slot || b.midi - a.midi,
  );
}

/**
 * Rangs des petites notes d'une portée à un instant : pour chaque rang, le nombre de
 * chiffres le plus grand (1 ou 2), qui fixe sa largeur. Vide s'il n'y en a pas.
 */
export function graceDigits(graces: Grace[], staff: Staff, t: number, parts?: Part[]): number[] {
  const out: number[] = [];
  const strs = parts && stringsOfStaff(parts, staff);
  for (const g of graces) {
    if (g.staff !== staff || g.t !== t) continue;
    // sur une corde, le nombre est la case
    const k = strs && g.string !== undefined ? g.midi - strs.open[g.string - 1] - strs.capo : (g.midi % 12) + 1;
    out[g.slot] = Math.max(out[g.slot] ?? 1, String(k).length);
  }
  return Array.from(out, (d) => d ?? 1);
}
