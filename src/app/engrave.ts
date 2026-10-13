/**
 * Gravure : place les systèmes calculés par le moteur de mise en page sur des pages A4.
 * Toutes les dimensions sont en millimètres.
 */
import { FINGER_MARK, TRILL_MARK, graceDigits, layout, noteText } from "../core/index.ts";
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
  subtitleH: 5, // place en plus pour un sous-titre
  orderH: 6, // ordre de jeu des sections, en tête de chaque page
  maxStretch: 1.7, // étirement maximal des cases pour remplir la ligne
  graceDigit: 1.25, // largeur d'un chiffre de petite note
  graceGap: 0.75, // espace après chaque rang de petites notes
  arpeggioW: 1.5, // place de la vaguelette d'un arpège, devant l'accord
  noteDigit: 1.85, // largeur d'un chiffre de note
  slurLevel: 1.3, // hauteur d'un étage de liaisons
};

/** Bande des liaisons d'une main, juste sous ses lignes : un étage par niveau d'imbrication. */
const slurH = (v: System["voices"]["D"]) => (v.slurs.length ? 1 + (Math.max(...v.slurs.map((s) => s.level)) + 1) * G.slurLevel : 0);

/**
 * Doigté gravé : un chiffre blanc sur une pastille sombre, en bas à droite de la note. Le
 * négatif reste lisible en petit, s'imprime en noir et blanc, et ne ressemble à aucune note.
 * r : demi-largeur de la pastille.
 */
export const FINGER = { r: 1.2, gap: 0.3 };

/** Morceaux d'une attaque : la note, la voisine d'une trille, le doigt. */
export function noteParts(c: string) {
  const [body, finger] = c.split(FINGER_MARK);
  const [main, aux] = body.split(TRILL_MARK);
  return { main, aux, finger };
}

/**
 * Largeur ajoutée à une case par une note annotée trop longue pour elle : la note, sa
 * voisine de trille en petit, son doigt, puis un peu de trait ondulé pour une trille.
 */
function noteW(c: string, cellW: number) {
  const { main, aux, finger } = noteParts(c);
  if (aux === undefined && finger === undefined) return 0;
  const w = 0.5 + main.length * G.noteDigit + (aux ? 0.35 + aux.length * G.graceDigit : 0) + (finger ? FINGER.gap + 2 * FINGER.r : 0) + (aux ? 1 : 0.3);
  return Math.max(0, w - cellW);
}
/** Place ajoutée par les notes annotées d'une case, sur la ligne qui en demande le plus. */
export const noteExtra = (sys: System, a: number, cellW: number) => Math.max(0, ...[...sys.right, ...sys.left].map((r) => noteW(r.cells[a], cellW)));

/** Hauteur de l'en-tête de la première page : titre, sous-titre éventuel, compositeur. */
export const headerHeight = (meta: Score["meta"]) => G.headerH + (meta.subtitle ? G.subtitleH : 0);

/** Largeur des rangs de petites notes d'une main, dans une case. */
export const graceSlotW = (d: number) => d * G.graceDigit + G.graceGap;
const graceW = (digits: number[]) => digits.reduce((w, d) => w + graceSlotW(d), 0);
/** Place ajoutée en tête d'une case par ses petites notes (la main qui en a le plus). */
export const graceExtra = (sys: System, a: number) => Math.max(graceW(sys.graceDigits.D[a]), graceW(sys.graceDigits.G[a]));
/** Place ajoutée en tête d'une case : ses petites notes, puis la vaguelette d'un arpège. */
export const leadExtra = (sys: System, a: number) => graceExtra(sys, a) + (sys.arpeggios.some((x) => x.anchor === a) ? G.arpeggioW : 0);

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
  /** Hauteur des bandes de liaisons sous chaque main (0 si la main n'en a pas). */
  slurBand: { D: number; G: number };
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

// l'arpège se dessine devant l'accord, pas dans la bande des nuances
const voiceH = (v: System["voices"]["D"]) => (v.marks.some((m) => m.kind !== "arpeggio") || v.hairpins.length ? G.voiceH : 0);

/** Bandes au-dessus de la règle, de haut en bas : textes, puis débuts de section, points d'orgue et « 3× ». */
export const bands = (s: System) => ({
  textBand: s.marks.some((m) => m.kind === "text") ? G.markH : 0,
  structBand: s.marks.some((m) => m.kind === "times" || m.kind === "marker" || m.kind === "fermata") ? G.markH : 0,
  voiceBand: { D: voiceH(s.voices.D), G: voiceH(s.voices.G) },
  slurBand: { D: slurH(s.voices.D), G: slurH(s.voices.G) },
  pedalBand: s.pedal.spans.length || s.pedal.texts.length ? G.pedalH : 0,
});

export const systemHeight = (s: System) => {
  const b = bands(s);
  return b.textBand + b.structBand + G.rulerH + (s.right.length + s.left.length) * G.rowH + b.voiceBand.D + b.voiceBand.G + b.slurBand.D + b.slurBand.G + b.pedalBand + 2 * G.handGap + 1;
};

/** Largeur d'une barre de mesure, selon ses signes de reprise (identique au calcul du moteur). */
const barSepWidth = (c: Extract<System["columns"][number], { kind: "barSep" }>) =>
  c.lead ? G.repeatDots + G.beatSep : G.barSep + (c.endRepeat ? G.repeatDots : 0) + (c.startRepeat ? G.repeatDots : 0);

function place(sys: System, isLast: boolean, y: number, cellW: number): PlacedSystem {
  const anchorOf = (ci: number) => sys.anchors.indexOf(ci);
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
    // les petites notes s'ajoutent en tête de case, sans étirement
    const a = anchorOf(xs.length);
    const w = c.kind === "anchor" ? cellW * stretch + leadExtra(sys, a) + noteExtra(sys, a, cellW) : c.kind === "barSep" ? barSepWidth(c) : G.beatSep;
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
    cellAt: (t) =>
      cellW +
      Math.max(graceW(graceDigits(score.graces, "D", t)), graceW(graceDigits(score.graces, "G", t))) +
      (score.arpeggios.some((x) => x.t === t) ? G.arpeggioW : 0) +
      Math.max(0, ...score.notes.filter((n) => n.start === t).map((n) => noteW(noteText(n), cellW))),
    beatSep: G.beatSep,
    barSep: G.barSep,
    repeatDots: G.repeatDots,
  });
  const pages: Page[] = [];
  const order = score.order;
  const orderH = order.length ? G.orderH : 0;
  let page: Page = { index: 0, systems: [], header: true, order };
  let y = PAGE.marginTop + headerHeight(score.meta) + orderH;
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
