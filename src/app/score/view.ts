/** La vue de la partition, ses crans de zoom, ses ajustements et la largeur de l'éditeur (sans Vue : useView s'en sert). */

export const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
export type Fit = "height" | "width" | "focus";
export const FITS: Fit[] = ["height", "width", "focus"];
/** La largeur de l'éditeur, en part de la largeur de l'écran : par défaut, et ses bornes. */
export const EDITOR_WIDTH = 0.42;
export const clampWidth = (width: number) => Math.round(Math.min(0.8, Math.max(0.2, width)) * 1000) / 1000;

export type View = { zoom: number; fit: Fit; editorWidth: number; progress: boolean };
