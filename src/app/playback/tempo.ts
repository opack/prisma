/**
 * Le tempo de l'écoute : ses pas (±5 dans la barre, ±10 % du tempo écrit dans le panneau),
 * toujours bornés, et sa part du tempo écrit, l'unité du travail (« à 70 % »).
 */
import { MAX_TEMPO, MIN_TEMPO } from "../options/piece.ts";

/** Le pas des boutons − et + de la barre. */
export const TEMPO_STEP = 5;

/** Le pas du panneau, en part du tempo écrit (pour cent). */
export const PERCENT_STEP = 10;

/** Un tempo entier, dans les bornes. */
export const clampTempo = (bpm: number) => Math.min(MAX_TEMPO, Math.max(MIN_TEMPO, Math.round(bpm)));

/** Le tempo d'un pas de plus (ou de moins), borné. */
export const stepTempo = (bpm: number, delta: number) => clampTempo(bpm + delta);

/** Le tempo d'une part du tempo écrit, arrondi et borné. */
export const tempoAt = (written: number, percent: number) => clampTempo((written * percent) / 100);

/** La part du tempo écrit que fait un tempo, en pour cent arrondi. */
export const percentOf = (bpm: number, written: number) => Math.round((bpm / written) * 100);

/**
 * Le tempo de la part suivante du tempo écrit (dir = 1) ou de la précédente (dir = -1), sur les
 * dizaines : de 100 % à 110 % ou 90 %, de 64 % à 70 % ou 60 %. Une part qui, arrondie, redonne le
 * même tempo est passée ; aux bornes, le tempo reste.
 */
export function stepPercent(bpm: number, written: number, dir: 1 | -1) {
  const exact = (bpm / written) * 100;
  let p = dir > 0 ? Math.floor(exact / PERCENT_STEP + 1e-9) * PERCENT_STEP : Math.ceil(exact / PERCENT_STEP - 1e-9) * PERCENT_STEP;
  for (let i = 0; i < 100; i++) {
    p += dir * PERCENT_STEP;
    const next = tempoAt(written, p);
    if (dir > 0 ? next > bpm : next < bpm) return next;
    if (p <= 0) break;
  }
  return bpm;
}
