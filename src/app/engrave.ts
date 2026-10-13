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
  compactCell: 4.1, // largeur d'une case en espacement compact (un « 12 » y tient encore)
  prefix: 7, // colonne des numéros d'octave
  beatSep: 0.8,
  barSep: 1.6,
  repeatDots: 1.8, // place des deux points d'une barre de reprise, de chaque côté (points centrés dedans)
  rulerH: 4.4,
  markH: 4, // une bande d'indications au-dessus du système (cases de reprise, textes)
  voiceH: 4.2, // bande des nuances et soufflets, sous les lignes d'une main
  pedalH: 4, // bande de la pédale, sous le système
  rowH: 4.5,
  handGap: 1.4, // espace de part et d'autre du trait entre les mains
  systemGap: 6.5,
  sectionGap: 5, // espace en plus avant une nouvelle section
  headerH: 17, // titre, en première page
  orderH: 6, // ordre de jeu des sections, en tête de chaque page
  maxStretch: 1.7, // étirement maximal des cases pour remplir la ligne
};

export type PlacedSystem = {
  sys: System;
  /** Facteur d'étirement des cases. */
  stretch: number;
  /** Ordonnée du haut du système, depuis le haut de la page (bandes d'indications comprises). */
  y: number;
  /** Hauteur des bandes d'indications au-dessus de la règle : cases de reprise, puis textes. */
  textBand: number;
  /** Bande de structure : débuts de section et « 3× ». */
  structBand: number;
  /** Hauteur des bandes de nuances sous chaque main (0 si la main n'en a pas). */
  voiceBand: { D: number; G: number };
  /** Hauteur de la bande de pédale sous le système (0 sans pédale). */
  pedalBand: number;
  height: number;
  /** Abscisse de chaque colonne (case ou séparateur), depuis le bord gauche de la page. */
  xs: number[];
  /** Largeur de chaque colonne. */
  ws: number[];
};

/** order : ordre de jeu des sections, gravé en tête de chaque page (vide s'il n'y a pas de section). */
export type Page = { index: number; systems: PlacedSystem[]; header: boolean; order: string[] };

const voiceH = (v: System["voices"]["D"]) => (v.marks.length || v.hairpins.length ? G.voiceH : 0);

/** Bandes au-dessus de la règle, de haut en bas : textes, puis débuts de section et « 3× ». */
export const bands = (s: System) => ({
  textBand: s.marks.some((m) => m.kind === "text") ? G.markH : 0,
  structBand: s.marks.some((m) => m.kind === "times" || m.kind === "marker") ? G.markH : 0,
  voiceBand: { D: voiceH(s.voices.D), G: voiceH(s.voices.G) },
  pedalBand: s.pedal.spans.length ? G.pedalH : 0,
});

export const systemHeight = (s: System) => {
  const b = bands(s);
  return b.textBand + b.structBand + G.rulerH + (s.right.length + s.left.length) * G.rowH + b.voiceBand.D + b.voiceBand.G + b.pedalBand + 2 * G.handGap + 1;
};

/** Largeur d'une barre de mesure, selon ses signes de reprise (identique au calcul du moteur). */
const barSepWidth = (c: Extract<System["columns"][number], { kind: "barSep" }>) =>
  c.lead ? G.repeatDots + G.beatSep : G.barSep + (c.endRepeat ? G.repeatDots : 0) + (c.startRepeat ? G.repeatDots : 0);

function place(sys: System, isLast: boolean, y: number, cellW: number): PlacedSystem {
  const cells = sys.anchors.length;
  const fixed = sys.width - cells * cellW;
  let stretch = (CONTENT_W - fixed) / (cells * cellW);
  // la dernière ligne (du morceau, ou d'une section) n'est étirée que si elle est déjà presque pleine
  if ((isLast || sys.endsSection) && stretch > 1.25) stretch = 1;
  stretch = Math.max(0.5, Math.min(stretch, G.maxStretch));
  const xs: number[] = [];
  const ws: number[] = [];
  let x = PAGE.marginX + G.prefix;
  for (const c of sys.columns) {
    const w = c.kind === "anchor" ? cellW * stretch : c.kind === "barSep" ? barSepWidth(c) : G.beatSep;
    xs.push(x);
    ws.push(w);
    x += w;
  }
  return { sys, stretch, y, height: systemHeight(sys), xs, ws, ...bands(sys) };
}

/** compact : cases plus étroites, donc plus de mesures par ligne. */
export function engrave(score: Score, compact = false): Page[] {
  const cellW = compact ? G.compactCell : G.cell;
  const systems = layout(score, {
    width: CONTENT_W,
    prefix: G.prefix,
    cell: cellW,
    beatSep: G.beatSep,
    barSep: G.barSep,
    repeatDots: G.repeatDots,
  });
  const pages: Page[] = [];
  const order = score.order;
  const orderH = order.length ? G.orderH : 0;
  let page: Page = { index: 0, systems: [], header: true, order };
  let y = PAGE.marginTop + G.headerH + orderH;
  const bottom = PAGE.h - PAGE.marginBottom;
  systems.forEach((sys, i) => {
    const h = systemHeight(sys);
    if (sys.section && page.systems.length) y += G.sectionGap;
    if (y + h > bottom && page.systems.length) {
      pages.push(page);
      page = { index: pages.length, systems: [], header: false, order };
      y = PAGE.marginTop + orderH;
    }
    page.systems.push(place(sys, i === systems.length - 1, y, cellW));
    y += h + G.systemGap;
  });
  pages.push(page);
  return pages;
}
