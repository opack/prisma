/**
 * Le signe du texte sous le curseur de l'éditeur, montré sur la partition : sa place (voir
 * textPlace), et s'il faut l'amener à l'écran (le curseur a bougé, l'écoute ne mène pas).
 */
import type { ScorePlace } from "../../core/locate.ts";

export type TextMark = { place: ScorePlace; reveal: boolean } | null;

let current: TextMark = null;
const listeners = new Set<() => void>();

export const textMark = {
  get: () => current,
  set(next: TextMark) {
    const a = current?.place, b = next?.place;
    if (a === b || (a && b && a.t === b.t && a.staff === b.staff && a.octave === b.octave && a.content === b.content)) return;
    current = next;
    listeners.forEach((l) => l());
  },
  subscribe(l: () => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};
