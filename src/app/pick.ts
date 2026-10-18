/**
 * Un clic sur la partition : le signe désigné (instant, portée, octave, contenu de la case), pour
 * qui veut le suivre ailleurs que dans l'écoute, comme l'éditeur qui y place son curseur. Un
 * double-clic demande la retouche de la case.
 */
import type { ScorePlace } from "../core/locate.ts";

/** Où le clic a eu lieu à l'écran, pour y ouvrir un choix. */
export type ScreenPoint = { x: number; y: number };
/** Un clic simple, ou un double-clic (la retouche). */
export type PickKind = "click" | "edit";

type Listener = (at: ScorePlace, where: ScreenPoint, kind: PickKind) => void;
const listeners = new Set<Listener>();

export const pick = {
  emit: (at: ScorePlace, where: ScreenPoint, kind: PickKind) => listeners.forEach((l) => l(at, where, kind)),
  subscribe(l: Listener) {
    listeners.add(l);
    return () => void listeners.delete(l);
  },
};
