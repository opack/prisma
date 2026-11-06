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
  const lower = name.toLowerCase();
  if (/\bpiano\b/.test(lower) && !/[ée]lec|rhodes|wurli/.test(lower)) return "piano";
  return GUESSES.find(([re]) => re.test(lower))?.[1] ?? "piano";
}

/**
 * L'instrument d'un programme General MIDI (de 1 à 128, comme dans MusicXML), parmi ceux de la
 * liste ; un programme sans équivalent proche (percussions, effets) n'en donne pas.
 */
export function instrumentOfProgram(program: number): InstrumentName | undefined {
  const zeroBased = program - 1;
  if (zeroBased === 4 || zeroBased === 5) return "electric-piano";
  if (zeroBased === 6) return "harpsichord";
  if (zeroBased < 8) return "piano";
  if (zeroBased === 11) return "vibraphone";
  if (zeroBased === 12 || zeroBased === 13) return "marimba";
  if (zeroBased === 21 || zeroBased === 23) return "accordion";
  if (zeroBased >= 16 && zeroBased < 24) return "organ";
  if (zeroBased >= 24 && zeroBased < 32) return "guitar";
  if (zeroBased === 32) return "double-bass";
  if (zeroBased >= 33 && zeroBased < 40) return "electric-bass";
  if (zeroBased === 40) return "violin";
  if (zeroBased === 41) return "viola";
  if (zeroBased === 42) return "cello";
  if (zeroBased === 43) return "double-bass";
  if (zeroBased === 46) return "harp";
  if (zeroBased >= 44 && zeroBased < 52) return "strings";
  if (zeroBased >= 52 && zeroBased < 55) return "voice";
  if (zeroBased === 56 || zeroBased === 59) return "trumpet";
  if (zeroBased === 57) return "trombone";
  if (zeroBased === 60) return "horn";
  if (zeroBased >= 64 && zeroBased < 68) return "saxophone";
  if (zeroBased === 68 || zeroBased === 69) return "oboe";
  if (zeroBased === 70) return "bassoon";
  if (zeroBased === 71) return "clarinet";
  if (zeroBased >= 72 && zeroBased < 80) return "flute";
  return undefined;
}

/** Les entrées de `parts:`, séparées par des virgules, sauf entre parenthèses (« Guitare (guitar, capo 2), Chant »). */
export function splitParts(list: string): string[] {
  const out: string[] = [];
  let depth = 0,
    from = 0;
  for (let index = 0; index < list.length; index++) {
    if (list[index] === "(") depth++;
    else if (list[index] === ")") depth = Math.max(0, depth - 1);
    else if (list[index] === "," && depth === 0) {
      out.push(list.slice(from, index));
      from = index + 1;
    }
  }
  out.push(list.slice(from));
  return out;
}

/**
 * Une entrée de `parts:` : le nom de la partie, et entre parenthèses ce qui la précise, séparé
 * par des virgules : son instrument, et pour un instrument à cordes son accordage et son capo
 * (« Chœur de droite (flute) », « Guitare (guitar, drop-d, capo 2) »).
 */
export function splitPartEntry(entry: string): { name: string; extras: string[] } {
  const match = entry.match(/^(.*?)\s*\(\s*([^()]*?)\s*\)\s*$/);
  if (!match) return { name: entry.trim(), extras: [] };
  return {
    name: match[1].trim(),
    extras: match[2]
      .split(",")
      .map((word) => word.trim().toLowerCase().replace(/\s+/g, " "))
      .filter(Boolean),
  };
}
