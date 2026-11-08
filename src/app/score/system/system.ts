/**
 * Les calculs d'un système gravé, partagés par ses composants : sa place sur la page, ses bords,
 * les couloirs coupés par le blanc entre deux sections, les bandes alternées, les articulations.
 */
import { METRICS, PAGE, isPickSign } from "../engrave.ts";
import type { PlacedSystem } from "../engrave.ts";
import { spacedWidths } from "../geometry.ts";
import type { SystemRow } from "../../../core/index.ts";

/**
 * Le système placé sur la page : la disposition verticale, calculée depuis le haut du système,
 * passe en ordonnées de la page (sauf y, le haut du système, et les hauteurs de bandes).
 */
export function onPage(placed: PlacedSystem): PlacedSystem {
  const systemY = placed.y;
  return {
    ...placed,
    rulerTop: systemY + placed.rulerTop,
    staves: placed.staves.map((staffPlace) => ({
      ...staffPlace,
      separator: staffPlace.separator === undefined ? undefined : systemY + staffPlace.separator,
      techTop: systemY + staffPlace.techTop,
      rowsTop: systemY + staffPlace.rowsTop,
      slurTop: systemY + staffPlace.slurTop,
      lyricTop: systemY + staffPlace.lyricTop,
      voiceTop: systemY + staffPlace.voiceTop,
      pedalTop: systemY + staffPlace.pedalTop,
      bottom: systemY + staffPlace.bottom,
    })),
    parts: placed.parts.map((part) => ({ ...part, top: systemY + part.top, bottom: systemY + part.bottom })),
  };
}

/** Le bord gauche des couloirs (après les onglets d'octave) et le bord droit de la dernière colonne. */
export function edges(placed: PlacedSystem) {
  const { xs, ws } = placed;
  return { left: PAGE.marginX + METRICS.prefix, right: xs[xs.length - 1] + ws[ws.length - 1] };
}

/** L'abscisse du début d'une case (son rang parmi les cases), et celle de sa fin. */
export const anchorX = (placed: PlacedSystem, anchor: number) => placed.xs[placed.sys.anchors[anchor]];
export const anchorEnd = (placed: PlacedSystem, anchor: number) =>
  placed.xs[placed.sys.anchors[anchor]] + placed.ws[placed.sys.anchors[anchor]];

/** Les morceaux d'un trait de from à to, coupé par le blanc entre deux sections à la suite. */
export function laneSpans(placed: PlacedSystem, from: number, to: number): [number, number][] {
  const spans: [number, number][] = [];
  let start = from;
  placed.sys.columns.forEach((column, index) => {
    if (column.kind !== "barSep" || !column.spaced) return;
    const [gapStart, gapEnd] = spacedWidths(column, placed.xs[index], placed.ws[index]).gap;
    spans.push([start, gapStart]);
    start = gapEnd;
  });
  spans.push([start, to]);
  return spans;
}

/** Le haut d'une ligne de notes d'une portée (le système placé sur la page). */
export const rowTop = (placed: PlacedSystem, staff: number, index: number) => placed.staves[staff].rowsTop + index * placed.rowH;

/** Les bandes alternées par groupe d'octave (ou par corde) : true pour les groupes de rang impair. */
export function alternating(rows: SystemRow[]): boolean[] {
  let group = -1;
  return rows.map((row) => {
    if (row.showOctave || row.string !== undefined) group++;
    return group % 2 === 1;
  });
}

/** Une note attaquée dans la case (pas une tenue). */
export const attacks = (row: SystemRow, anchor: number) => !!row.cells[anchor] && !row.cells[anchor].startsWith("-");

/**
 * Les articulations d'une ligne de notes, case par case : portées par la note la plus aiguë
 * attaquée dans la case (une fois pour l'accord). Le sens du médiator se dessine à part.
 */
export function articulationsOf(placed: PlacedSystem, staff: number, index: number): Map<number, string[]> {
  const systemStaff = placed.sys.staves[staff];
  const articulations = new Map<number, string[]>();
  for (const voiceMark of systemStaff.voice.marks) {
    if (voiceMark.kind !== "articulation" || isPickSign(voiceMark.text)) continue;
    const top = systemStaff.rows.findIndex((row) => attacks(row, voiceMark.anchor));
    if (top === index) articulations.set(voiceMark.anchor, [...(articulations.get(voiceMark.anchor) ?? []), voiceMark.text]);
  }
  return articulations;
}
