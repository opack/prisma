/**
 * Gravure : place les systèmes calculés par le moteur de mise en page sur des pages A4.
 * Toutes les dimensions sont en millimètres.
 */
import { FINGER_MARK, firstParts, partCount, TRILL_MARK, chordName, chordNotes, graceDigits, layout, noteText } from "../core/index.ts";
import type { Score, System, Voice } from "../core/index.ts";

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
  voiceH: 4.2, // bande des nuances et soufflets, sous les lignes d'une partie
  pedalH: 4, // bande de la pédale, sous le système
  rowH: 4.5,
  partGap: 1.4, // espace de part et d'autre du trait épais entre deux parties d'un instrument
  instrumentGap: 5, // espace entre deux instruments
  systemGap: 6.5,
  sectionGap: 5, // espace en plus avant une nouvelle section
  headerH: 17, // titre, en première page
  subtitleH: 5, // place en plus pour un sous-titre
  orderH: 6, // ordre de jeu des sections, en tête de chaque page
  maxStretch: 1.7, // étirement maximal des cases pour remplir la ligne
  graceDigit: 1.25, // largeur d'un chiffre de petite note
  graceGap: 0.75, // espace après chaque rang de petites notes
  arpeggioW: 1.5, // place de la vaguelette d'un arpège, devant l'accord
  noteDigit: 2.05, // largeur d'un chiffre de note (Atkinson Hyperlegible en gras, 3,3 mm)
  slurLevel: 1.3, // hauteur d'un étage de liaisons
  chordNameH: 4.6, // bande du nom d'un accord (« Am »)
  chordNoteH: 2.4, // hauteur d'une note dans un accord écrit en notes ymn empilées
  chordChar: 1.9, // largeur d'un caractère du nom d'un accord
  lyricH: 4.2, // une ligne de paroles (un couplet)
  lyricChar: 1.6, // largeur d'un caractère de paroles
  hyphenW: 2.2, // place d'un trait d'union après une syllabe
  articulationScale: 1.15, // taille des signes d'articulation
  articulationStep: 1.1, // écart entre deux signes d'articulation côte à côte, au-dessus de la note
};

/** Largeur d'une syllabe gravée, depuis le début de sa note. */
export const lyricTextW = (text: string) => [...text].length * G.lyricChar;
/** Largeur que demande une syllabe : son texte, puis un trait d'union ou un peu d'air. */
const lyricW = (text: string, hyphen: boolean) => 0.5 + lyricTextW(text) + (hyphen ? G.hyphenW : 0.9);
/** Place ajoutée à une case par une syllabe trop longue pour elle (le couplet qui en demande le plus). */
const lyricExtra = (sys: System, a: number, cellW: number) =>
  Math.max(0, ...sys.parts.flatMap((p) => p.voice.lyrics.flatMap((l) => l.syllables.filter((x) => x.anchor === a).map((x) => lyricW(x.text, x.hyphen) - cellW))));

/** Affichage des accords : nom anglais, notes ymn empilées, ou les deux. */
export type ChordStyle = "name" | "notes" | "both";

/** Notes d'un accord (de la basse vers l'aigu) et nom à graver : celui écrit, ou celui reconnu. */
export function chordParts(text: string) {
  const notes = chordNotes(text) ?? [];
  const name = /^[A-G]/.test(text) ? text : chordName(notes);
  return { notes, name };
}
const showName = (style: ChordStyle, name?: string) => !!name && style !== "notes";
// sans nom reconnu, les notes s'affichent toujours
const showNotes = (style: ChordStyle, name?: string) => style !== "name" || !name;

/** Hauteur de la bande des accords d'un système : le nom, et/ou les notes empilées. */
const chordH = (s: System, style: ChordStyle) => {
  if (!s.chords.length) return 0;
  const parts = s.chords.map((c) => chordParts(c.text));
  const named = parts.some((p) => showName(style, p.name));
  const stack = Math.max(0, ...parts.filter((p) => showNotes(style, p.name)).map((p) => p.notes.length));
  return (named ? G.chordNameH : 0.8) + stack * G.chordNoteH;
};
/** Largeur que demande un accord : son nom ; ses notes empilées tiennent dans une case. */
const chordW = (text: string, style: ChordStyle) => {
  const p = chordParts(text);
  return showName(style, p.name) ? 0.5 + p.name!.length * G.chordChar + 0.6 : 0;
};

/** Bande des paroles d'une partie : une ligne par couplet, un peu d'air au-dessus. */
const lyricH = (v: Voice) => (v.lyrics.length ? 0.4 + v.lyrics.length * G.lyricH : 0);

/** Bande des liaisons d'une partie, juste sous ses lignes : un étage par niveau d'imbrication. */
const slurH = (v: Voice) => (v.slurs.length ? 1 + (Math.max(...v.slurs.map((s) => s.level)) + 1) * G.slurLevel : 0);

/**
 * Doigté gravé : un chiffre blanc sur une pastille sombre, en bas à droite de la note. Le
 * négatif reste lisible en petit, s'imprime en noir et blanc, et ne ressemble à aucune note.
 * r : demi-largeur de la pastille.
 */
export const FINGER = { r: 1.2, gap: 0.55 };

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
export const noteExtra = (sys: System, a: number, cellW: number) => Math.max(0, ...sys.parts.flatMap((p) => p.rows.map((r) => noteW(r.cells[a], cellW))));

/** Hauteur de l'en-tête de la première page : titre, sous-titre éventuel, compositeur. */
export const headerHeight = (meta: Score["meta"]) => G.headerH + (meta.subtitle ? G.subtitleH : 0);

/** Largeur des rangs de petites notes d'une partie, dans une case. */
export const graceSlotW = (d: number) => d * G.graceDigit + G.graceGap;
const graceW = (digits: number[]) => digits.reduce((w, d) => w + graceSlotW(d), 0);
/** Place ajoutée en tête d'une case par ses petites notes (la partie qui en a le plus). */
export const graceExtra = (sys: System, a: number) => Math.max(0, ...sys.parts.map((p) => graceW(p.graceDigits[a])));
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
  /** Haut de la règle de comptage, depuis le haut du système (comme les places des parties). */
  rulerTop: number;
  /** Place de chaque partie, de haut en bas. */
  parts: PartPlace[];
  /** Place de chaque instrument : du haut de ses lignes au bas de sa dernière partie (pédale exclue). */
  instruments: { top: number; bottom: number; first: number; last: number; name?: string }[];
  height: number;
  /** Abscisse de chaque colonne (case ou séparateur), depuis le bord gauche de la page. */
  xs: number[];
  /** Largeur de chaque colonne. */
  ws: number[];
  /** Hauteur de la bande des accords, juste au-dessus de la règle (0 sans accord). */
  chordBand: number;
};

/**
 * Place d'une partie dans un système, de haut en bas : le trait épais qui la sépare de la
 * partie du dessus (separator, dans un même instrument), ses lignes de notes, puis ses
 * bandes de liaisons, de paroles, de nuances et de pédale. Ordonnées depuis le haut du système.
 */
export type PartPlace = {
  separator?: number;
  rowsTop: number;
  slurTop: number;
  lyricTop: number;
  voiceTop: number;
  pedalTop: number;
  bottom: number;
  slurBand: number;
  lyricBand: number;
  voiceBand: number;
  pedalBand: number;
};

/** order : ordre de jeu des sections, gravé en tête de chaque page (vide s'il n'y a pas de section). */
export type Page = { index: number; systems: PlacedSystem[]; header: boolean; order: string[] };

// l'arpège se dessine devant l'accord, pas dans la bande des nuances
// l'arpège et les articulations se dessinent sur la note, pas dans la bande des nuances
const voiceH = (v: Voice) => (v.marks.some((m) => m.kind !== "arpeggio" && m.kind !== "articulation") || v.hairpins.length ? G.voiceH : 0);

/**
 * Disposition verticale d'un système dont le haut est à y : au-dessus de la règle, les bandes
 * de textes, de structure (débuts de section, points d'orgue, « 3× ») et d'accords ; puis
 * chaque partie. Deux parties d'un instrument sont séparées par un trait épais, deux
 * instruments par un espace ; la pédale d'un instrument passe sous sa dernière partie.
 */
export function geometry(s: System, chords: ChordStyle, y: number) {
  const textBand = s.marks.some((m) => m.kind === "text") ? G.markH : 0;
  const structBand = s.marks.some((m) => m.kind === "times" || m.kind === "marker" || m.kind === "fermata") ? G.markH : 0;
  const chordBand = chordH(s, chords);
  const rulerTop = y + textBand + structBand + chordBand;
  const firsts = firstParts(s.instruments);
  let cur = rulerTop + G.rulerH;
  const parts: PartPlace[] = s.parts.map((p, k) => {
    let separator: number | undefined;
    if (k > 0 && firsts.includes(k)) cur += G.instrumentGap;
    else if (k > 0) {
      separator = cur + G.partGap;
      cur = separator + G.partGap;
    }
    const slurBand = slurH(p.voice), lyricBand = lyricH(p.voice), voiceBand = voiceH(p.voice);
    const pedalBand = p.pedal.spans.length || p.pedal.texts.length ? G.pedalH : 0;
    const rowsTop = cur;
    const slurTop = rowsTop + p.rows.length * G.rowH;
    const lyricTop = slurTop + slurBand;
    const voiceTop = lyricTop + lyricBand;
    const pedalTop = voiceTop + voiceBand;
    cur = pedalTop + pedalBand;
    return { separator, rowsTop, slurTop, lyricTop, voiceTop, pedalTop, bottom: pedalTop, slurBand, lyricBand, voiceBand, pedalBand };
  });
  const instruments = s.instruments.map((x, i) => {
    const first = firsts[i], last = first + x.parts - 1;
    return { top: i === 0 ? rulerTop : parts[first].rowsTop, bottom: parts[last].bottom, first, last, ...(x.name ? { name: x.name } : {}) };
  });
  return { textBand, structBand, chordBand, rulerTop, parts, instruments, height: cur - y + 1 };
}

export const systemHeight = (s: System, chords: ChordStyle = "both") => geometry(s, chords, 0).height;

/** Largeur d'une barre de mesure, selon ses signes de reprise (identique au calcul du moteur). */
const barSepWidth = (c: Extract<System["columns"][number], { kind: "barSep" }>) =>
  c.lead ? G.repeatDots + G.beatSep : G.barSep + (c.endRepeat ? G.repeatDots : 0) + (c.startRepeat ? G.repeatDots : 0);

function place(sys: System, isLast: boolean, y: number, cellW: number, chords: ChordStyle): PlacedSystem {
  const chordAt = new Map(sys.chords.map((c) => [c.anchor, chordW(c.text, chords)]));
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
    const w = c.kind === "anchor" ? Math.max(cellW * stretch + leadExtra(sys, a) + Math.max(noteExtra(sys, a, cellW), lyricExtra(sys, a, cellW)), chordAt.get(a) ?? 0) : c.kind === "barSep" ? barSepWidth(c) : G.beatSep;
    xs.push(x);
    ws.push(w);
    x += w;
  }
  return { sys, stretch, y, xs, ws, ...geometry(sys, chords, 0) };
}

/**
 * compact : cases plus étroites, donc plus de mesures par ligne ; chords : affichage des
 * accords ; align : une note rejouée garde sa ligne (voir layout).
 */
export function engrave(score: Score, { compact = false, chords = "both" as ChordStyle, align = false } = {}): Page[] {
  const cellW = compact ? G.compactCell : G.cell;
  const systems = layout(score, {
    width: CONTENT_W,
    prefix: G.prefix,
    cell: cellW,
    cellAt: (t) =>
      cellW +
      Math.max(...Array.from({ length: partCount(score.instruments) }, (_, k) => graceW(graceDigits(score.graces, k, t)))) +
      (score.arpeggios.some((x) => x.t === t) ? G.arpeggioW : 0) +
      // une note annotée ou une syllabe trop longue élargit sa case (l'une sous l'autre : la plus large compte)
      Math.max(0, ...score.notes.filter((n) => n.start === t).map((n) => noteW(noteText(n), cellW)), ...score.lyrics.filter((l) => l.t === t).map((l) => lyricW(l.text, !!l.hyphen) - cellW)) +
      // un nom d'accord trop long élargit sa case
      Math.max(0, ...score.chords.filter((c) => c.t === t).map((c) => chordW(c.text, chords) - cellW)),
    beatSep: G.beatSep,
    barSep: G.barSep,
    repeatDots: G.repeatDots,
    align,
  });
  const pages: Page[] = [];
  const order = score.order;
  const orderH = order.length ? G.orderH : 0;
  let page: Page = { index: 0, systems: [], header: true, order };
  let y = PAGE.marginTop + headerHeight(score.meta) + orderH;
  const bottom = PAGE.h - PAGE.marginBottom;
  systems.forEach((sys, i) => {
    const h = systemHeight(sys, chords);
    if (sys.section && page.systems.length) y += G.sectionGap;
    if (y + h > bottom && page.systems.length) {
      pages.push(page);
      page = { index: pages.length, systems: [], header: false, order };
      y = PAGE.marginTop + orderH;
    }
    page.systems.push(place(sys, i === systems.length - 1, y, cellW, chords));
    y += h + G.systemGap;
  });
  pages.push(page);
  return pages;
}
