/**
 * Gravure : place les systèmes calculés par le moteur de mise en page sur des pages A4.
 * Toutes les dimensions sont en millimètres.
 */
import { layout } from "../core/index.ts";
import type { Score, System } from "../core/index.ts";

export const PAGE = { w: 210, h: 297, marginX: 15, marginTop: 14, marginBottom: 16 };
export const CONTENT_W = PAGE.w - 2 * PAGE.marginX;

export const G = {
  cell: 5.2, // largeur naturelle d'une case
  prefix: 7, // colonne des numéros d'octave
  beatSep: 0.8,
  barSep: 1.6,
  repeatDots: 1.8, // place des deux points d'une barre de reprise, de chaque côté (points centrés dedans)
  rulerH: 4.4,
  markH: 4, // une bande d'indications au-dessus du système (cases de reprise, textes)
  rowH: 4.5,
  handGap: 1.4, // espace de part et d'autre du trait entre les mains
  systemGap: 6.5,
  headerH: 17, // titre, en première page
  maxStretch: 1.7, // étirement maximal des cases pour remplir la ligne
};

export type PlacedSystem = {
  sys: System;
  /** Facteur d'étirement des cases. */
  stretch: number;
  /** Ordonnée du haut du système, depuis le haut de la page (bandes d'indications comprises). */
  y: number;
  /** Hauteur des bandes d'indications au-dessus de la règle : cases de reprise, puis textes. */
  endingBand: number;
  textBand: number;
  height: number;
  /** Abscisse de chaque colonne (case ou séparateur), depuis le bord gauche de la page. */
  xs: number[];
  /** Largeur de chaque colonne. */
  ws: number[];
};

export type Page = { index: number; systems: PlacedSystem[]; header: boolean };

/** Bandes au-dessus de la règle : une pour les cases et les « 3× », une pour les textes. */
export const bands = (s: System) => ({
  endingBand: s.endings.length || s.marks.some((m) => m.kind === "times") ? G.markH : 0,
  textBand: s.marks.some((m) => m.kind === "text") ? G.markH : 0,
});

export const systemHeight = (s: System) => {
  const b = bands(s);
  return b.endingBand + b.textBand + G.rulerH + (s.right.length + s.left.length) * G.rowH + 2 * G.handGap + 1;
};

/** Largeur d'une barre de mesure, selon ses signes de reprise (identique au calcul du moteur). */
const barSepWidth = (c: Extract<System["columns"][number], { kind: "barSep" }>) =>
  c.lead ? G.repeatDots + G.beatSep : G.barSep + (c.endRepeat ? G.repeatDots : 0) + (c.startRepeat ? G.repeatDots : 0);

function place(sys: System, isLast: boolean, y: number): PlacedSystem {
  const cells = sys.anchors.length;
  const fixed = sys.width - cells * G.cell;
  let stretch = (CONTENT_W - fixed) / (cells * G.cell);
  // la dernière ligne n'est étirée que si elle est déjà presque pleine
  if (isLast && stretch > 1.25) stretch = 1;
  stretch = Math.max(0.5, Math.min(stretch, G.maxStretch));
  const xs: number[] = [];
  const ws: number[] = [];
  let x = PAGE.marginX + G.prefix;
  for (const c of sys.columns) {
    const w = c.kind === "anchor" ? G.cell * stretch : c.kind === "barSep" ? barSepWidth(c) : G.beatSep;
    xs.push(x);
    ws.push(w);
    x += w;
  }
  return { sys, stretch, y, height: systemHeight(sys), xs, ws, ...bands(sys) };
}

export function engrave(score: Score): Page[] {
  const systems = layout(score, {
    width: CONTENT_W,
    prefix: G.prefix,
    cell: G.cell,
    beatSep: G.beatSep,
    barSep: G.barSep,
    repeatDots: G.repeatDots,
  });
  const pages: Page[] = [];
  let page: Page = { index: 0, systems: [], header: true };
  let y = PAGE.marginTop + G.headerH;
  const bottom = PAGE.h - PAGE.marginBottom;
  systems.forEach((sys, i) => {
    const h = systemHeight(sys);
    if (y + h > bottom && page.systems.length) {
      pages.push(page);
      page = { index: pages.length, systems: [], header: false };
      y = PAGE.marginTop;
    }
    page.systems.push(place(sys, i === systems.length - 1, y));
    y += h + G.systemGap;
  });
  pages.push(page);
  return pages;
}
