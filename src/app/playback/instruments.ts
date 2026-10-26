/**
 * Instruments de l'écoute : le piano échantillonné, et une sélection des sons General MIDI que la
 * bibliothèque smplr sait charger (« Soundfont »), ceux qu'on trouve sur une partition de
 * pianiste : claviers, cordes, vents, voix. Chaque partie du morceau a le sien : celui que la
 * partition écrit après son nom, ou que son nom fait deviner ; on peut en choisir un autre
 * (un réglage du morceau).
 */
import { guessInstrument, isInstrument } from "../../core/index.ts";
import type { InstrumentName, Part } from "../../core/index.ts";

export { guessInstrument, isInstrument };

/**
 * Un instrument : son nom dans la partition, son nom en clair, le son qui le joue, et ce qu'il
 * faut ajouter à ce son (en décibels) pour qu'il sonne aussi fort que le piano : les sons General
 * MIDI sont enregistrés bien plus bas que le piano échantillonné, et inégaux entre eux.
 */
export type Instrument = { id: InstrumentName; label: string; sound: string; boost?: number };

/** « piano » : le piano échantillonné ; les autres : un son General MIDI. */
export const PIANO: InstrumentName = "piano";

// boost : mesuré sur trois notes de son registre, à intensité égale, l'énergie moyenne de la
// première seconde comparée à celle du piano
export const INSTRUMENTS: Instrument[] = [
  { id: "piano", label: "Piano", sound: "piano" },
  { id: "electric-piano", label: "Piano électrique", sound: "electric_piano_1", boost: -3.7 },
  { id: "harpsichord", label: "Clavecin", sound: "harpsichord", boost: 2.3 },
  { id: "organ", label: "Orgue", sound: "church_organ", boost: -4.7 },
  { id: "accordion", label: "Accordéon", sound: "accordion", boost: 4.9 },
  { id: "guitar", label: "Guitare", sound: "acoustic_guitar_nylon", boost: 3.6 },
  { id: "electric-bass", label: "Basse électrique", sound: "electric_bass_finger", boost: -7.7 },
  { id: "harp", label: "Harpe", sound: "orchestral_harp", boost: 4.5 },
  { id: "violin", label: "Violon", sound: "violin", boost: 3.1 },
  { id: "viola", label: "Alto (violon alto)", sound: "viola", boost: 2.3 },
  { id: "cello", label: "Violoncelle", sound: "cello", boost: 1.3 },
  { id: "double-bass", label: "Contrebasse", sound: "contrabass", boost: -5 },
  { id: "strings", label: "Cordes (ensemble)", sound: "string_ensemble_1", boost: -4.4 },
  { id: "flute", label: "Flûte", sound: "flute", boost: -2.3 },
  { id: "oboe", label: "Hautbois", sound: "oboe", boost: 2.4 },
  { id: "clarinet", label: "Clarinette", sound: "clarinet", boost: -3 },
  { id: "bassoon", label: "Basson", sound: "bassoon", boost: 2.7 },
  { id: "saxophone", label: "Saxophone", sound: "alto_sax", boost: -2.7 },
  { id: "trumpet", label: "Trompette", sound: "trumpet", boost: 2.5 },
  { id: "horn", label: "Cor", sound: "french_horn", boost: 0.8 },
  { id: "trombone", label: "Trombone", sound: "trombone", boost: 4 },
  { id: "voice", label: "Voix (chœur)", sound: "choir_aahs", boost: 2 },
  { id: "marimba", label: "Marimba", sound: "marimba", boost: -0.9 },
  { id: "vibraphone", label: "Vibraphone", sound: "vibraphone", boost: 5.5 },
];

export const instrumentLabel = (id: string) => INSTRUMENTS.find((t) => t.id === id)?.label ?? id;
/** Le son General MIDI d'un instrument ; « piano » pour le piano échantillonné. */
export const soundOf = (id: string) => INSTRUMENTS.find((t) => t.id === id)?.sound ?? "piano";
/** Ce qu'il faut ajouter au son d'un instrument (en décibels) pour qu'il sonne comme le piano. */
export const boostOf = (id: string) => INSTRUMENTS.find((t) => t.id === id)?.boost ?? 0;

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
