/**
 * Instruments de l'écoute : le piano échantillonné, et une sélection des sons General MIDI que la
 * bibliothèque smplr sait charger (« Soundfont »), ceux qu'on trouve sur une partition de
 * pianiste : claviers, cordes, vents, voix. Chaque partie du morceau a le sien : celui que la
 * partition écrit après son nom, ou que son nom fait deviner ; on peut en choisir un autre
 * (un réglage du morceau).
 */
import { guessInstrument, isInstrument } from "../core/index.ts";
import type { InstrumentName, Part } from "../core/index.ts";

export { guessInstrument, isInstrument };

/** Un instrument : son nom dans la partition, son nom en clair, et le son qui le joue. */
export type Instrument = { id: InstrumentName; label: string; sound: string };

/** « piano » : le piano échantillonné ; les autres : un son General MIDI. */
export const PIANO: InstrumentName = "piano";

export const INSTRUMENTS: Instrument[] = [
  { id: "piano", label: "Piano", sound: "piano" },
  { id: "electric-piano", label: "Piano électrique", sound: "electric_piano_1" },
  { id: "harpsichord", label: "Clavecin", sound: "harpsichord" },
  { id: "organ", label: "Orgue", sound: "church_organ" },
  { id: "accordion", label: "Accordéon", sound: "accordion" },
  { id: "guitar", label: "Guitare", sound: "acoustic_guitar_nylon" },
  { id: "electric-bass", label: "Basse électrique", sound: "electric_bass_finger" },
  { id: "harp", label: "Harpe", sound: "orchestral_harp" },
  { id: "violin", label: "Violon", sound: "violin" },
  { id: "viola", label: "Alto (violon alto)", sound: "viola" },
  { id: "cello", label: "Violoncelle", sound: "cello" },
  { id: "double-bass", label: "Contrebasse", sound: "contrabass" },
  { id: "strings", label: "Cordes (ensemble)", sound: "string_ensemble_1" },
  { id: "flute", label: "Flûte", sound: "flute" },
  { id: "oboe", label: "Hautbois", sound: "oboe" },
  { id: "clarinet", label: "Clarinette", sound: "clarinet" },
  { id: "bassoon", label: "Basson", sound: "bassoon" },
  { id: "saxophone", label: "Saxophone", sound: "alto_sax" },
  { id: "trumpet", label: "Trompette", sound: "trumpet" },
  { id: "horn", label: "Cor", sound: "french_horn" },
  { id: "trombone", label: "Trombone", sound: "trombone" },
  { id: "voice", label: "Voix (chœur)", sound: "choir_aahs" },
  { id: "marimba", label: "Marimba", sound: "marimba" },
  { id: "vibraphone", label: "Vibraphone", sound: "vibraphone" },
];

export const instrumentLabel = (id: string) => INSTRUMENTS.find((t) => t.id === id)?.label ?? id;
/** Le son General MIDI d'un instrument ; « piano » pour le piano échantillonné. */
export const soundOf = (id: string) => INSTRUMENTS.find((t) => t.id === id)?.sound ?? "piano";

/** L'instrument que la partition donne à une partie : celui écrit après son nom, sinon celui que son nom fait deviner. */
export const scoreInstrument = (part: Part): InstrumentName => part.instrument ?? guessInstrument(part.name);

/** L'instrument de chaque partie : celui choisi pour le morceau, sinon celui de la partition. */
export function instrumentsOf(parts: Part[], chosen: (string | null)[] = []): InstrumentName[] {
  return parts.map((part, i) => (isInstrument(chosen[i]) ? (chosen[i] as InstrumentName) : scoreInstrument(part)));
}

/** L'instrument de chaque portée, d'après celui de sa partie. */
export function staffInstruments(parts: Part[], instruments: string[]): string[] {
  return parts.flatMap((part, i) => Array.from({ length: part.staves }, () => instruments[i] ?? PIANO));
}
