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
    const before = current?.place,
      after = next?.place;
    if (
      before === after ||
      (before &&
        after &&
        before.t === after.t &&
        before.staff === after.staff &&
        before.octave === after.octave &&
        before.content === after.content)
    )
      return;
    current = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => void listeners.delete(listener);
  },
};
