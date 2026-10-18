/**
 * Un clic sur la partition : le signe désigné (instant, portée, octave, contenu de la case), pour
 * qui veut le suivre ailleurs que dans l'écoute, comme l'éditeur qui y place son curseur.
 */
import type { ScorePlace } from "../core/locate.ts";

const listeners = new Set<(at: ScorePlace) => void>();

export const pick = {
  emit: (at: ScorePlace) => listeners.forEach((l) => l(at)),
  subscribe(l: (at: ScorePlace) => void) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};
