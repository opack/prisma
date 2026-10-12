/**
 * Correspondance entre hauteur MIDI et notation : numéro 1..12 (1 = do) et octave
 * scientifique (do central = octave 4).
 */
export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;
export const numberOf = (midi: number) => (midi % 12) + 1;
export const midiOf = (octave: number, number: number) => (octave + 1) * 12 + (number - 1);
