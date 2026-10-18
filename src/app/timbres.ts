/**
 * Timbres de l'écoute : le piano échantillonné, et une sélection des sons General MIDI que la
 * bibliothèque smplr sait charger (« Soundfont »), ceux qu'on trouve sur une partition de
 * pianiste : claviers, cordes, vents, voix. Chaque instrument du morceau a le sien, deviné d'après
 * son nom, que l'on peut changer (un réglage du morceau).
 */
import type { Instrument } from "../core/index.ts";

export type Timbre = { id: string; label: string };

/** « piano » : le piano échantillonné ; les autres : le nom du son General MIDI. */
export const PIANO = "piano";

export const TIMBRES: Timbre[] = [
  { id: PIANO, label: "Piano" },
  { id: "electric_piano_1", label: "Piano électrique" },
  { id: "harpsichord", label: "Clavecin" },
  { id: "church_organ", label: "Orgue" },
  { id: "accordion", label: "Accordéon" },
  { id: "acoustic_guitar_nylon", label: "Guitare" },
  { id: "electric_bass_finger", label: "Basse électrique" },
  { id: "orchestral_harp", label: "Harpe" },
  { id: "violin", label: "Violon" },
  { id: "viola", label: "Alto (violon alto)" },
  { id: "cello", label: "Violoncelle" },
  { id: "contrabass", label: "Contrebasse" },
  { id: "string_ensemble_1", label: "Cordes (ensemble)" },
  { id: "flute", label: "Flûte" },
  { id: "oboe", label: "Hautbois" },
  { id: "clarinet", label: "Clarinette" },
  { id: "bassoon", label: "Basson" },
  { id: "alto_sax", label: "Saxophone" },
  { id: "trumpet", label: "Trompette" },
  { id: "french_horn", label: "Cor" },
  { id: "trombone", label: "Trombone" },
  { id: "choir_aahs", label: "Voix (chœur)" },
  { id: "marimba", label: "Marimba" },
  { id: "vibraphone", label: "Vibraphone" },
];

export const isTimbre = (id: unknown): id is string => typeof id === "string" && TIMBRES.some((t) => t.id === id);
export const timbreLabel = (id: string) => TIMBRES.find((t) => t.id === id)?.label ?? id;

/**
 * Le timbre d'un instrument d'après son nom, en français ou en anglais ; le piano à défaut. Les
 * voix d'abord (« Alto », « Basse » sont aussi des voix : un nom seul, sans autre indice, est
 * pris pour une voix), puis les instruments, du plus précis au plus général.
 */
const GUESSES: [RegExp, string][] = [
  [/piano.*([ée]lec|rhodes|wurli)|rhodes|wurlitzer|e-?piano/, "electric_piano_1"],
  [/clavecin|harpsichord|cembalo/, "harpsichord"],
  [/orgue|organ/, "church_organ"],
  [/accord[ée]on|bandon[ée]on/, "accordion"],
  [/(basse|bass)\s*([ée]lectrique|electric|guitar)|electric bass|guitare basse/, "electric_bass_finger"],
  [/contrebasse|double\s*bass|contrabass|upright bass/, "contrabass"],
  [/violoncelle|cello/, "cello"],
  [/violon alto|viola\b/, "viola"],
  [/violon|violin|fiddle/, "violin"],
  [/cordes|strings/, "string_ensemble_1"],
  [/guitare|guitar/, "acoustic_guitar_nylon"],
  [/harpe|harp/, "orchestral_harp"],
  [/fl[ûu]te|flute|piccolo/, "flute"],
  [/hautbois|oboe|cor anglais|english horn/, "oboe"],
  [/clarinette|clarinet/, "clarinet"],
  [/basson|bassoon|fagott/, "bassoon"],
  [/sax/, "alto_sax"],
  [/trompette|trumpet|cornet/, "trumpet"],
  [/trombone/, "trombone"],
  [/\bcor\b|horn/, "french_horn"],
  [/marimba|xylophone/, "marimba"],
  [/vibraphone/, "vibraphone"],
  [/chant|voix|voice|vocal|choeur|chœur|choir|chorus|soprano|mezzo|contralto|alto|t[ée]nor|baryton|baritone|basse|\bbass\b/, "choir_aahs"],
];

export function guessTimbre(name?: string): string {
  if (!name) return PIANO;
  const n = name.toLowerCase();
  if (/\bpiano\b/.test(n) && !/[ée]lec|rhodes|wurli/.test(n)) return PIANO;
  return GUESSES.find(([re]) => re.test(n))?.[1] ?? PIANO;
}

/** Le timbre de chaque instrument : celui choisi pour le morceau, sinon celui de son nom. */
export function timbresOf(instruments: Instrument[], chosen: (string | null)[] = []): string[] {
  return instruments.map((ins, i) => (isTimbre(chosen[i]) ? chosen[i]! : guessTimbre(ins.name)));
}

/** Le timbre de chaque partie, d'après celui de son instrument. */
export function partTimbres(instruments: Instrument[], timbres: string[]): string[] {
  return instruments.flatMap((ins, i) => Array.from({ length: ins.parts }, () => timbres[i] ?? PIANO));
}
