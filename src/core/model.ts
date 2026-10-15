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

/**
 * Partie : un groupe de lignes entre deux traits (une main au piano, une voix, une flûte),
 * repérée par son rang, de haut en bas (0 pour la première).
 */
export type Part = number;

/**
 * Instrument : une ou plusieurs parties qui se suivent (le piano en a deux). name : son nom,
 * déclaré dans le frontmatter (`parts:`) et écrit sur le trait au-dessus de sa première partie.
 */
export type Instrument = { name?: string; parts: number };

/** Instrument de chaque partie : son rang dans la liste des instruments. */
export function instrumentOf(instruments: Instrument[], part: Part): number {
  let first = 0;
  for (let i = 0; i < instruments.length; i++) {
    first += instruments[i].parts;
    if (part < first) return i;
  }
  return instruments.length - 1;
}

/** Première partie de chaque instrument. */
export const firstParts = (instruments: Instrument[]) => instruments.map((_, i) => instruments.slice(0, i).reduce((n, x) => n + x.parts, 0));

/** Nombre total de parties. */
export const partCount = (instruments: Instrument[]) => instruments.reduce((n, x) => n + x.parts, 0);

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
  part: Part;
  /** Hauteur MIDI : 60 = do central (do 4). */
  midi: number;
  /** Début et fin en ticks, fin exclue. */
  start: number;
  end: number;
  /** Trille : hauteur MIDI de la note voisine (celle du dessus), alternée pendant toute la note. */
  trill?: number;
  /** Doigté : le doigt qui joue la note (1 = pouce, 5 = auriculaire). */
  finger?: number;
};

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
 * l'aigu au grave). part : la partie dont l'accord s'égrène ; absente, toutes les parties
 * d'un seul geste, de la note la plus grave du système à la plus aiguë.
 */
export type Arpeggio = { t: number; part?: Part; down?: boolean };

/** Arpège sur une ligne @ : « / » du grave à l'aigu, « \ » de l'aigu au grave. */
export const ARPEGGIO_UP = "/";
export const ARPEGGIO_DOWN = "\\";
export const isArpeggioSign = (t: string) => t === ARPEGGIO_UP || t === ARPEGGIO_DOWN;

/**
 * Articulation : la manière d'attaquer ce que la partie joue à l'instant t (une note, ou
 * tout l'accord). staccato : détaché, plus court ; accent : plus fort que ses voisines ;
 * marcato : accent plus fort et plus sec.
 */
export type Articulation = { part: Part; t: number; kind: ArticulationKind };
export type ArticulationKind = "staccato" | "accent" | "marcato";

/** Articulations sur une ligne @ de partie : « . » staccato, « ! » accent, « !! » marcato. */
export const ARTICULATION_SIGNS: Record<ArticulationKind, string> = { staccato: ".", accent: "!", marcato: "!!" };
export const articulationOf = (t: string) => (Object.keys(ARTICULATION_SIGNS) as ArticulationKind[]).find((k) => ARTICULATION_SIGNS[k] === t);
export const isArticulationSign = (t: string) => articulationOf(t) !== undefined;

/**
 * Petite note : jouée très vite juste avant l'instant t, sans compter dans le temps.
 * slot : rang dans la suite des petites notes de cette partie à cet instant (0 en premier) ;
 * deux petites notes de même rang se jouent ensemble.
 */
export type Grace = { part: Part; midi: number; t: number; slot: number };

/** Marque d'une petite note dans une case : son numéro suivi d'une apostrophe (« 3'5 »). */
export const GRACE_MARK = "'";

export type Meta = {
  title?: string;
  /** Sous-titre, gravé sous le titre : « Op. 9 n° 2 », « Suite bergamasque, 3ᵉ mouvement »… */
  subtitle?: string;
  composer?: string;
  /** Tempo, en temps par minute : le temps de la règle de comptage (la noire pointée d'un 6/8). */
  bpm?: number;
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
export type Expression = { part: Part; t: number; text: string; kind: "dynamic" | "text" };

/** Soufflet d'une voix : crescendo (« < ») ou decrescendo (« > »), de start à end (fin exclue). */
export type Hairpin = { part: Part; kind: "<" | ">"; start: number; end: number };

/** Soufflet écrit sur une ligne @ de voix : « <---- » (crescendo) ou « >---- » (decrescendo). */
export const isHairpin = (t: string) => /^[<>][-|]*$/.test(t);

/**
 * Liaison d'expression d'une voix : les notes de start à end se jouent liées. end est
 * l'attaque de la dernière note liée (comprise).
 */
export type Slur = { part: Part; start: number; end: number };

/**
 * Liaison écrite sur une ligne @ de voix : « (-----) », de la case de la première note à
 * celle de la dernière. Coupée par un changement de système : « (----- » puis « ----) »
 * (« ------ » pour un système qu'elle traverse tout entier).
 */
export const isSlur = (t: string) => /^\([-|]*\)?$/.test(t) || /^-[-|]*\)?$/.test(t);
// plusieurs liaisons d'une partie qui continuent : leurs suites se lisent de haut en bas, dans
// l'ordre où les liaisons ont commencé

/**
 * Pédale de résonance enfoncée de start à end (fin exclue). Deux pédales qui se touchent
 * (end de l'une = start de la suivante) forment un changement de pédale. part : la partie
 * sous laquelle elle s'écrit, la dernière de son instrument. implied : pédale non écrite, déduite
 * d'un « Ped. simile » pour la gravure (jamais lue ni écrite dans le fichier).
 */
export type Pedal = { part: Part; start: number; end: number; implied?: boolean };

/** Consigne de pédale (« Ped. simile »…), sur la ligne de pédale d'une partie. */
export type PedalText = TextMark & { part: Part };

/** Signes de pédale d'une ligne @ sous la dernière partie d'un instrument : enfoncer, relâcher, changer. */
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
export const isSign = (t: string) => isHairpin(t) || isSlur(t) || isPedalSign(t) || isStructureSign(t) || t === FERMATA || isArpeggioSign(t) || isArticulationSign(t);

/**
 * Deux mots d'une ligne @ séparés par une seule espace forment un seul texte (« a tempo »,
 * « più f », « Ped. simile »), sauf si le second est un signe, ou si le premier est un
 * soufflet ou un début de section.
 */
export const joinsText = (prev: string, next: string) =>
  !isSign(next) && !isHairpin(prev) && !isSlur(prev) && !isStructureSign(prev) && prev !== FERMATA && !isArpeggioSign(prev) && !isArticulationSign(prev);

/**
 * Syllabe de paroles, chantée sur la note de sa partie qui commence à t. verse : couplet (1, 2…).
 * hyphen : le mot continue sur la syllabe suivante (« lu- ne »). extend : le mot se prolonge
 * sur plusieurs notes (mélisme), jusqu'à cet instant (fin exclue).
 */
export type Lyric = { part: Part; verse: number; t: number; text: string; hyphen?: boolean; extend?: number };

/** Ligne des paroles d'un couplet, sous les lignes d'une partie : « @l », puis chaque syllabe sur sa case. */
export const LYRIC_LINE = "@l";
/** Fin de syllabe : le mot continue sur la syllabe suivante (« lu- »). */
export const HYPHEN = "-";
/** Prolongation d'une syllabe sur les notes suivantes (« ne ---- »), comme une tenue. */
export const isExtender = (t: string) => /^-[-|]*$/.test(t);

export type Score = {
  meta: Meta;
  /** Instruments, de haut en bas ; leurs parties se suivent dans cet ordre. */
  instruments: Instrument[];
  /** Temps du morceau, dans l'ordre. Le temps i couvre [i·TICKS_PER_BEAT, (i+1)·TICKS_PER_BEAT[. */
  beats: Beat[];
  notes: Note[];
  /** Petites notes, rangées par instant, partie, rang, de l'aigu au grave. */
  graces: Grace[];
  repeats: Repeat[];
  texts: TextMark[];
  expressions: Expression[];
  hairpins: Hairpin[];
  slurs: Slur[];
  pedals: Pedal[];
  /** Consignes de pédale (« Ped. simile »…), sur la ligne de pédale. */
  pedalTexts: PedalText[];
  markers: Marker[];
  /** Accords d'accompagnement (ligne `@c`), tels qu'écrits : nom anglais ou notes ymn. */
  chords: TextMark[];
  /** Paroles, par instant, partie et couplet. */
  lyrics: Lyric[];
  /** Arpèges, par instant. */
  arpeggios: Arpeggio[];
  /** Articulations, par instant et partie. */
  articulations: Articulation[];
  /** Points d'orgue : instants où l'on tient la note, l'accord ou le silence plus longtemps. */
  fermatas: number[];
  /** Ordre de jeu des sections, par leur lettre ; vide : le morceau se joue d'un bout à l'autre. */
  order: string[];
};

/** Reprise portée par une mesure, s'il y en a une. */
export const repeatOf = (score: Score, barIndex: number) => score.repeats.find((r) => r.barIndex === barIndex);

export const beatStart = (i: number) => i * TICKS_PER_BEAT;

/** Trie les notes de façon stable : par début, partie du haut d'abord, de l'aigu au grave. */
export function sortNotes(notes: Note[]): Note[] {
  return [...notes].sort(
    (a, b) => a.start - b.start || a.part - b.part || b.midi - a.midi || a.end - b.end,
  );
}

/** Trie les petites notes : par instant, partie du haut d'abord, par rang, de l'aigu au grave. */
const ARTICULATION_ORDER: ArticulationKind[] = ["staccato", "accent", "marcato"];
/** Trie les articulations : par instant, partie, puis staccato, accent, marcato. */
export function sortArticulations(xs: Articulation[]): Articulation[] {
  return [...xs].sort((a, b) => a.t - b.t || a.part - b.part || ARTICULATION_ORDER.indexOf(a.kind) - ARTICULATION_ORDER.indexOf(b.kind));
}

/** Trie les paroles : par instant, partie du haut d'abord, par couplet. */
export function sortLyrics(lyrics: Lyric[]): Lyric[] {
  return [...lyrics].sort((a, b) => a.t - b.t || a.part - b.part || a.verse - b.verse);
}

export function sortGraces(graces: Grace[]): Grace[] {
  return [...graces].sort(
    (a, b) => a.t - b.t || a.part - b.part || a.slot - b.slot || b.midi - a.midi,
  );
}

/**
 * Rangs des petites notes d'une partie à un instant : pour chaque rang, le nombre de
 * chiffres le plus grand (1 ou 2), qui fixe sa largeur. Vide s'il n'y en a pas.
 */
export function graceDigits(graces: Grace[], part: Part, t: number): number[] {
  const out: number[] = [];
  for (const g of graces) {
    if (g.part !== part || g.t !== t) continue;
    out[g.slot] = Math.max(out[g.slot] ?? 1, String((g.midi % 12) + 1).length);
  }
  return Array.from(out, (d) => d ?? 1);
}
