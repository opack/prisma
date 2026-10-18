/**
 * Instruments, pour l'écoute : chaque partie en a un, écrit après son nom dans `parts:`
 * (« Chœur de droite (flute) »), ou deviné d'après son nom (« Flûte », « Violin », « Chant »…),
 * le piano à défaut. Les noms d'instruments sont en anglais, comme les clés du frontmatter.
 */

export const INSTRUMENTS = [
  "piano",
  "electric-piano",
  "harpsichord",
  "organ",
  "accordion",
  "guitar",
  "electric-bass",
  "harp",
  "violin",
  "viola",
  "cello",
  "double-bass",
  "strings",
  "flute",
  "oboe",
  "clarinet",
  "bassoon",
  "saxophone",
  "trumpet",
  "horn",
  "trombone",
  "voice",
  "marimba",
  "vibraphone",
] as const;
export type InstrumentName = (typeof INSTRUMENTS)[number];

export const isInstrument = (x: unknown): x is InstrumentName => typeof x === "string" && (INSTRUMENTS as readonly string[]).includes(x);

/**
 * L'instrument que fait deviner le nom d'une partie, en français ou en anglais ; le piano à
 * défaut. Du plus précis au plus général, les voix en dernier : « Alto », « Basse » seuls sont
 * pris pour des voix, plus fréquentes que les cordes sous ces noms sur une partition de chant.
 */
const GUESSES: [RegExp, InstrumentName][] = [
  [/piano.*([ée]lec|rhodes|wurli)|rhodes|wurlitzer|e-?piano/, "electric-piano"],
  [/clavecin|harpsichord|cembalo/, "harpsichord"],
  [/orgue|organ/, "organ"],
  [/accord[ée]on|bandon[ée]on/, "accordion"],
  [/(basse|bass)\s*([ée]lectrique|electric|guitar)|electric bass|guitare basse/, "electric-bass"],
  [/contrebasse|double\s*bass|contrabass|upright bass/, "double-bass"],
  [/violoncelle|cello/, "cello"],
  [/violon alto|viola\b/, "viola"],
  [/violon|violin|fiddle/, "violin"],
  [/cordes|strings/, "strings"],
  [/guitare|guitar/, "guitar"],
  [/harpe|harp/, "harp"],
  [/fl[ûu]te|flute|piccolo/, "flute"],
  [/hautbois|oboe|cor anglais|english horn/, "oboe"],
  [/clarinette|clarinet/, "clarinet"],
  [/basson|bassoon|fagott/, "bassoon"],
  [/sax/, "saxophone"],
  [/trompette|trumpet|cornet/, "trumpet"],
  [/trombone/, "trombone"],
  [/\bcor\b|horn/, "horn"],
  [/marimba|xylophone/, "marimba"],
  [/vibraphone/, "vibraphone"],
  [/chant|voix|voice|vocal|choeur|chœur|choir|chorus|soprano|mezzo|contralto|alto|t[ée]nor|baryton|baritone|basse|\bbass\b/, "voice"],
];

export function guessInstrument(name?: string): InstrumentName {
  if (!name) return "piano";
  const n = name.toLowerCase();
  if (/\bpiano\b/.test(n) && !/[ée]lec|rhodes|wurli/.test(n)) return "piano";
  return GUESSES.find(([re]) => re.test(n))?.[1] ?? "piano";
}

/**
 * L'instrument d'un programme General MIDI (de 1 à 128, comme dans MusicXML), parmi ceux de la
 * liste ; un programme sans équivalent proche (percussions, effets) n'en donne pas.
 */
export function instrumentOfProgram(program: number): InstrumentName | undefined {
  const p = program - 1;
  if (p === 4 || p === 5) return "electric-piano";
  if (p === 6) return "harpsichord";
  if (p < 8) return "piano";
  if (p === 11) return "vibraphone";
  if (p === 12 || p === 13) return "marimba";
  if (p === 21 || p === 23) return "accordion";
  if (p >= 16 && p < 24) return "organ";
  if (p >= 24 && p < 32) return "guitar";
  if (p === 32) return "double-bass";
  if (p >= 33 && p < 40) return "electric-bass";
  if (p === 40) return "violin";
  if (p === 41) return "viola";
  if (p === 42) return "cello";
  if (p === 43) return "double-bass";
  if (p === 46) return "harp";
  if (p >= 44 && p < 52) return "strings";
  if (p >= 52 && p < 55) return "voice";
  if (p === 56 || p === 59) return "trumpet";
  if (p === 57) return "trombone";
  if (p === 60) return "horn";
  if (p >= 64 && p < 68) return "saxophone";
  if (p === 68 || p === 69) return "oboe";
  if (p === 70) return "bassoon";
  if (p === 71) return "clarinet";
  if (p >= 72 && p < 80) return "flute";
  return undefined;
}

/**
 * Une entrée de `parts:` : le nom de la partie, et son instrument entre parenthèses s'il est
 * écrit (« Chœur de droite (flute) »).
 */
export function splitPartEntry(entry: string): { name: string; instrument?: string } {
  const m = entry.match(/^(.*?)\s*\(\s*([^()]*?)\s*\)\s*$/);
  return m ? { name: m[1].trim(), instrument: m[2].toLowerCase() } : { name: entry.trim() };
}
