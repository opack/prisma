/**
 * Le tempo de l'écoute : ses pas (±5 dans la barre, ±1 dans le panneau), toujours bornés, et sa
 * part du tempo écrit, l'unité du travail (« à 70 % »).
 */
import { MAX_TEMPO, MIN_TEMPO } from "../options/piece.ts";

/** Le pas des boutons − et + de la barre. */
export const TEMPO_STEP = 5;

/** Les parts du tempo écrit que propose le panneau, en pour cent. */
export const TEMPO_PERCENTS = [50, 60, 70, 80, 90, 100];

/** Un tempo entier, dans les bornes. */
export const clampTempo = (bpm: number) => Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(bpm)));

/** Le tempo d'un pas de plus (ou de moins), borné. */
export const stepTempo = (bpm: number, delta: number) => clampTempo(bpm + delta);

/** Le tempo d'une part du tempo écrit, arrondi et borné. */
export const tempoAt = (written: number, percent: number) => clampTempo((written * percent) / 100);

/** La part du tempo écrit que fait un tempo, en pour cent arrondi. */
export const percentOf = (bpm: number, written: number) => Math.round((bpm / written) * 100);

/** Les bornes du curseur du panneau : du quart au double du tempo écrit, dans les bornes du tempo. */
export const sliderRange = (written: number) => ({ min: clampTempo(written / 4), max: clampTempo(written * 2) });
