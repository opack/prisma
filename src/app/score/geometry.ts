/**
 * La géométrie de la page gravée : les tracés et les mesures que dessine PageView, sans React ni
 * navigateur. Les longueurs sont en millimètres de la page, comme la mise en page (engrave.ts).
 */
import { METRICS } from "./engrave.ts";
import type { PlacedSystem } from "./engrave.ts";

/** Une barre du système : une colonne de séparation, de temps ou de mesure. */
export type BarColumn = Extract<PlacedSystem["sys"]["columns"][number], { kind: "barSep" }>;

/** La période et l'amplitude des ondulations : une trille, un arpège. */
const WAVE_PERIOD = 1.3;
const WAVE_AMPLITUDE = 0.35;

/** Trait ondulé horizontal (trille) de x1 à x2, centré sur y : le tracé SVG. */
export function trillPath(x1: number, x2: number, y: number): string {
  let path = `M ${x1} ${y}`;
  for (let x = x1, index = 0; x < x2 - 0.01; x += WAVE_PERIOD / 2, index++) {
    const nextX = Math.min(x + WAVE_PERIOD / 2, x2);
    path += ` Q ${(x + nextX) / 2} ${y + (index % 2 ? WAVE_AMPLITUDE : -WAVE_AMPLITUDE) * 2} ${nextX} ${y}`;
  }
  return path;
}

/** Vaguelette verticale (arpège) de y1 à y2, centrée sur x ; down : flèche vers le bas. */
export function arpeggioPath(x: number, y1: number, y2: number, down: boolean): string {
  let path = `M ${x} ${y1}`;
  for (let y = y1, index = 0; y < y2 - 0.01; y += WAVE_PERIOD / 2, index++) {
    const nextY = Math.min(y + WAVE_PERIOD / 2, y2);
    path += ` Q ${x + (index % 2 ? WAVE_AMPLITUDE : -WAVE_AMPLITUDE) * 2} ${(y + nextY) / 2} ${x} ${nextY}`;
  }
  if (down) path += ` M ${x - 0.7} ${y2 - 0.9} L ${x} ${y2} L ${x + 0.7} ${y2 - 0.9}`;
  return path;
}

/**
 * Barre entre deux sections à la suite : la fin de la section (double barre, ou « :|| »), un
 * blanc, puis le début de la suivante, ouverte comme une ligne (trait, ou « ||: »). Les largeurs
 * de la fermeture et de l'ouverture, et le blanc entre elles (de gauche à droite).
 */
export function spacedWidths(column: BarColumn, x: number, width: number) {
  const close = METRICS.barSep + (column.endRepeat ? METRICS.repeatDots : 0);
  const open = column.startRepeat ? METRICS.repeatDots + METRICS.beatSep : 0;
  return { close, open, gap: [x + close, x + width - open] as [number, number] };
}

/** Largeur estimée d'une indication gravée : une nuance (gras italique), ou un texte. */
export const markWidth = (text: string, kind: string) => [...text].length * (kind === "dynamic" ? 2.1 : 1.35) + 0.9;

/** La case d'un système qui sonne à cet instant : la dernière qui commence avant lui (son rang parmi les cases). */
export function anchorAt(placed: PlacedSystem, tick: number): number {
  const { sys } = placed;
  let anchor = 0;
  sys.anchors.forEach((column, index) => {
    if ((sys.columns[column] as { t: number }).t <= tick) anchor = index;
  });
  return anchor;
}

/** La colonne jouée d'un système à cet instant du morceau. */
export const columnAt = (placed: PlacedSystem, tick: number): number => placed.sys.anchors[anchorAt(placed, tick)];

/** La colonne d'une case sous l'abscisse x, ou la plus proche quand x tombe entre deux. */
export function nearestColumn(placed: PlacedSystem, x: number): number {
  let best = placed.sys.anchors[0],
    bestDistance = Infinity;
  for (const column of placed.sys.anchors) {
    const left = placed.xs[column],
      right = left + placed.ws[column];
    const distance = x < left ? left - x : x > right ? x - right : 0;
    if (distance < bestDistance) {
      best = column;
      bestDistance = distance;
    }
  }
  return best;
}

/** Les mesures d'un système : les colonnes de leurs cases, de gauche à droite. */
export function barsIn(placed: PlacedSystem): number[][] {
  const bars: number[][] = [[]];
  placed.sys.columns.forEach((column, index) => {
    if (column.kind === "barSep") {
      if (bars[bars.length - 1].length) bars.push([]);
    } else if (column.kind === "anchor") bars[bars.length - 1].push(index);
  });
  return bars.filter((bar) => bar.length);
}

/** Hauteur d'un système sur la page, de sa règle au bas de sa dernière portée : celle du curseur. */
export function systemBand(placed: PlacedSystem) {
  const last = placed.staves[placed.staves.length - 1];
  return { top: placed.y + placed.rulerTop, bottom: placed.y + last.voiceTop + last.voiceBand };
}
