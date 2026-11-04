/**
 * Le tempo de l'écoute : ses pas (±1 au clic, ±5 à l'appui long), toujours bornés.
 */
import { MAX_TEMPO, MIN_TEMPO } from "../options/piece.ts";

/** Le pas de l'appui long sur − et + ; un clic avance de 1. */
export const TEMPO_STEP = 5;

/** Un tempo entier, dans les bornes. */
export const clampTempo = (bpm: number) => Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(bpm)));

/** Le tempo d'un pas de plus (ou de moins), borné. */
export const stepTempo = (bpm: number, delta: number) => clampTempo(bpm + delta);
