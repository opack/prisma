/**
 * Correspondance entre hauteur MIDI et notation : numéro 1..12 (1 = do) et octave
 * scientifique (do central = octave 4).
 */
export const octaveOf = (midi: number) => Math.floor(midi / 12) - 1;
export const numberOf = (midi: number) => (midi % 12) + 1;
export const midiOf = (octave: number, number: number) => (octave + 1) * 12 + (number - 1);

/**
 * Dans le format .prisma, l'octave est comptée depuis celle du do central :
 * « 0 » pour l'octave qui commence au do central, « +1 » au-dessus, « -1 » en dessous.
 * Le rendu graphique les affiche avec des flèches (↑1, ↓1).
 * Cette référence ne dépend d'aucune convention nationale (do3 en France, C4 ailleurs).
 */
export const CENTRAL_OCTAVE = 4;
export const octaveLabel = (octave: number) => {
  const rel = octave - CENTRAL_OCTAVE;
  return rel === 0 ? "0" : rel > 0 ? `+${rel}` : `-${-rel}`;
};

/** Écart à l'octave du do central (0, +1, -2…), pour le rendu graphique. */
export const octaveOffset = (octave: number) => octave - CENTRAL_OCTAVE;

/**
 * Lit un numéro d'octave relatif au do central : « 0 », « +1 », « -2 ».
 */
export function parseOctaveLabel(label: string): number | undefined {
  if (label === "0") return CENTRAL_OCTAVE;
  if (/^[+-][1-9]$/.test(label)) return CENTRAL_OCTAVE + Number(label);
  return undefined;
}
