/**
 * Gravure : place les systèmes calculés par le moteur de mise en page sur des pages A4.
 * Toutes les dimensions sont en millimètres.
 */
import { ARTICULATION_SIGNS, FINGER_MARK, firstStaves, staffCount, TRILL_MARK, chordName, chordNotes, chordOf, chordPrismaName, chordShape, chordWriting, graceDigits, gridStrings, layout, noteText, parseShape, splitShape, stringCell } from "../core/index.ts";
import type { Align, Part, Score, Shape, System, Voice } from "../core/index.ts";

export const PAGE = { w: 210, h: 297, marginX: 15, marginTop: 14, marginBottom: 16 };
export const CONTENT_W = PAGE.w - 2 * PAGE.marginX;

export const G = {
  cell: 5.2, // largeur naturelle d'une case
  compactCell: 4.1, // largeur d'une case en espacement compact (élargie là où un « 12 » ne tient pas)
  prefix: 7, // colonne des numéros d'octave
  beatSep: 0.8,
  barSep: 1.6,
  repeatDots: 1.8, // place des deux points d'une barre de reprise, de chaque côté (points centrés dedans)
  rulerH: 4.4,
  markH: 4, // une bande d'indications au-dessus du système (cases de reprise, textes)
  voiceH: 4.2, // bande des nuances et soufflets, sous les lignes d'une portée
  pedalH: 4, // bande de la pédale, sous le système
  rowH: 4.5,
  staffGap: 1.4, // espace de part et d'autre du trait épais entre deux portées d'une partie
  partGap: 5, // espace entre deux parties
  systemGap: 6.5,
  sectionGap: 5, // espace en plus avant une nouvelle section
  compactRowH: 4, // espacement compact : des lignes de notes moins hautes
  compactSystemGap: 3.5, // et les systèmes plus serrés
  compactSectionGap: 2.5,
  sectionSep: 5.2, // sections à la suite : un blanc d'une case entre la fin d'une section et la suivante, sur la même ligne
  headerH: 17, // titre, en première page
  subtitleH: 5, // place en plus pour un sous-titre
  orderH: 6, // ordre de jeu des sections, en tête de chaque page
  maxStretch: 1.7, // étirement maximal des cases pour remplir la ligne
  graceDigit: 1.25, // largeur d'un chiffre de petite note
  graceGap: 0.75, // espace après chaque rang de petites notes
  arpeggioW: 1.5, // place de la vaguelette d'un arpège, devant l'accord
  holdW: 2.4, // trait de tenue devant le rappel d'une note commencée au système précédent
  noteDigit: 2.05, // largeur d'un chiffre de note (Atkinson Hyperlegible en gras, 3,3 mm)
  slurLevel: 1.3, // hauteur d'un étage de liaisons
  legatoH: 2.8, // sous les liaisons d'une corde, la lettre du legato (H : hammer-on, P : pull-off)
  techH: 4.6, // au-dessus des cordes, la bande du médiator (⊓, V) et de l'écart des bends (½, full)
  chordNameH: 4.6, // bande du nom d'un accord (« Am »)
  chordNoteH: 2.4, // hauteur d'une note dans un accord écrit en notes Prisma empilées
  chordChar: 1.9, // largeur d'un caractère du nom d'un accord
  gridString: 1.25, // grille d'accord : l'écart entre deux cordes
  gridFret: 1.5, // la hauteur d'une case
  gridFrets: 4, // les cases montrées
  gridMarks: 1.7, // la bande des « x » et « o », au-dessus des cordes
  gridLabel: 2.4, // la case de départ d'une forme haute (« 5 »), à droite de la grille
  chartGap: 4, // récapitulatif des grilles en tête de partition : l'écart entre deux grilles
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
  Math.max(0, ...sys.staves.flatMap((p) => p.voice.lyrics.flatMap((l) => l.syllables.filter((x) => x.anchor === a).map((x) => lyricW(x.text, x.hyphen) - cellW))));

/** Affichage des accords : leur nom, leurs notes Prisma empilées, les deux, ou leur nom et leur grille de guitare. */
export type ChordStyle = "name" | "notes" | "both" | "grid";
/** Le nom des accords : en notation Prisma (« 10:m »), ou en anglais (« Am »). */
export type ChordNames = "prisma" | "english";

/** Notes d'un accord (de la basse vers l'aigu) et nom à graver : celui écrit s'il est dans la notation choisie, sinon celui reconnu. */
export function splitChord(text: string, names: ChordNames = "prisma") {
  const notes = chordNotes(text) ?? [];
  const name = chordWriting(text) === names ? chordOf(text) : names === "english" ? chordName(notes) : chordPrismaName(notes);
  return { notes, name };
}
/**
 * La grille d'un accord sur la guitare du morceau : celle écrite après son nom (« =x02210 »), sinon
 * la plus simple qui le joue ; undefined si rien ne le joue.
 */
export function chordGrid(text: string, parts: Part[]): Shape | undefined {
  const { shape } = splitShape(text);
  const notes = chordNotes(text);
  if (shape !== undefined) return parseShape(shape);
  return notes && chordShape(notes, gridStrings(parts.map((p) => p.strings)));
}
/** La grille gravée : ses cordes, et la place de la case de départ à sa droite. */
export const gridW = (strings = 6) => (strings - 1) * G.gridString + 0.6 + G.gridLabel;
export const gridH = () => G.gridMarks + G.gridFrets * G.gridFret + 1;

const showName = (style: ChordStyle, name?: string) => !!name && style !== "notes";
// sans nom reconnu, les notes s'affichent toujours (sauf avec une grille, qui les montre sur le manche)
const showNotes = (style: ChordStyle, name?: string) => style !== "name" && style !== "grid" ? true : !name;

/** Hauteur de la bande des accords d'un système : le nom, et/ou les notes empilées, ou la grille. */
const chordH = (s: System, style: ChordStyle) => {
  if (!s.chords.length) return 0;
  const chords = s.chords.map((c) => ({ ...splitChord(c.text), grid: style === "grid" ? chordGrid(c.text, s.parts) : undefined }));
  const named = chords.some((p) => showName(style, p.name));
  const stack = Math.max(0, ...chords.filter((p) => !p.grid && showNotes(style, p.name)).map((p) => p.notes.length));
  const grid = chords.some((p) => p.grid) ? gridH() : 0;
  return (named ? G.chordNameH : 0.8) + Math.max(stack * G.chordNoteH, grid);
};
/** Largeur que demande un accord : son nom, ou sa grille ; ses notes empilées tiennent dans une case. */
const chordW = (text: string, style: ChordStyle, names: ChordNames) => {
  const p = splitChord(text, names);
  const name = showName(style, p.name) ? 0.5 + p.name!.length * G.chordChar + 0.6 : 0;
  return style === "grid" ? Math.max(name, 0.5 + gridW() + 0.6) : name;
};

/** Bande des paroles d'une portée : une ligne par couplet, un peu d'air au-dessus. */
const lyricH = (v: Voice) => (v.lyrics.length ? 0.4 + v.lyrics.length * G.lyricH : 0);

/** Bande des liaisons d'une portée, juste sous ses lignes : un étage par niveau d'imbrication. */
export const slurH = (v: Voice) => (v.slurs.length ? 1 + (Math.max(...v.slurs.map((s) => s.level)) + 1) * G.slurLevel : 0);

/**
 * Doigté gravé : un chiffre blanc sur une pastille sombre, en bas à droite de la note. Le
 * négatif reste lisible en petit, s'imprime en noir et blanc, et ne ressemble à aucune note.
 * r : demi-largeur de la pastille.
 */
export const FINGER = { r: 1.2, gap: 0.55 };

/**
 * Une technique des cordes dans une case (« x », « <12> », « 7/ », « 7// », « //7 », « 7b9r »,
 * suivis ou non d'un doigt) : ce qu'elle grave. Undefined pour une autre case.
 */
export const techniqueOf = (c: string) => stringCell(c);

/** La place d'un trait de glissé, à côté de sa case. */
export const SLIDE_W = 2.6;

/** Un signe du médiator sur la ligne @ (« d », « u ») : il se grave au-dessus des cordes, pas sur la note. */
export const isPickSign = (text: string) => text === ARTICULATION_SIGNS.down || text === ARTICULATION_SIGNS.up;

/** L'écart d'un bend, gravé au bout de sa flèche : ½ ton, un ton (full), 1½… */
export const bendLabel = (frets: number) => (frets === 2 ? "full" : frets % 2 ? `${frets > 1 ? (frets - 1) / 2 : ""}½` : String(frets / 2));

/** La largeur d'une case de corde écrite, avant son bend : ses chiffres, et le trait d'un glissé. */
function fretW(c: string | undefined) {
  if (!c || c.startsWith("-")) return 0;
  const t = techniqueOf(c);
  return t ? t.label.length * G.noteDigit * (t.harmonic ? 0.8 : 1) + (t.slideIn ? SLIDE_W : 0) + (t.slide || t.slideOut ? SLIDE_W : 0) : splitNote(c).main.length * G.noteDigit;
}

/**
 * Où part un bend, depuis la gauche de sa case : après la case la plus large de sa colonne, sur
 * les cordes de la portée, pour que la flèche ne coupe pas un chiffre d'une autre corde.
 */
export const bendStart = (rows: { string?: number; cells: string[] }[], a: number) =>
  0.5 + Math.max(0, ...rows.map((r) => (r.string === undefined ? 0 : fretW(r.cells[a])))) + 0.2;

/** Morceaux d'une attaque : la note, la voisine d'une trille, le doigt. */
export function splitNote(c: string) {
  const [body, finger] = c.split(FINGER_MARK);
  const [main, aux] = body.split(TRILL_MARK);
  return { main, aux, finger };
}

/**
 * Largeur ajoutée à une case par une note annotée trop longue pour elle : la note, sa
 * voisine de trille en petit, son doigt, puis un peu de trait ondulé pour une trille.
 */
function noteW(c: string, cellW: number, reminders = true, bendAt = 0) {
  if (!c || c === "-") return 0;
  // un bend : sa flèche, relâchée ou non, puis le doigt
  const tech = bendAt ? techniqueOf(c) : undefined;
  if (tech?.bend !== undefined) return Math.max(0, bendAt + 2.2 + (tech.release ? 2.6 : 0) + 0.8 + (tech.finger ? FINGER.gap + 2 * FINGER.r : 0) + 0.3 - cellW);
  // une autre technique : la case et ses glissés, puis le doigt
  if (tech) return Math.max(0, 0.5 + fretW(c) + (tech.finger ? FINGER.gap + 2 * FINGER.r : 0) + 0.45 - cellW);
  // rappel d'une note tenue en début de système : le trait de tenue, puis ses chiffres en petit
  if (c.startsWith("-")) return reminders ? Math.max(0, 0.5 + G.holdW + 0.6 + (c.length - 1) * G.noteDigit * 0.82 + 0.45 - cellW) : 0;
  const { main, aux, finger } = splitNote(c);
  // une note seule : ses chiffres, puis assez d'air pour ne pas se coller à la case suivante
  // (« 12 » puis « 8 » ne doit pas se lire « 128 »)
  if (aux === undefined && finger === undefined) return Math.max(0, 0.5 + main.length * G.noteDigit + 0.45 - cellW);
  const w = 0.5 + main.length * G.noteDigit + (aux ? 0.35 + aux.length * G.graceDigit : 0) + (finger ? FINGER.gap + 2 * FINGER.r : 0) + (aux ? 1 : 0.3);
  return Math.max(0, w - cellW);
}
/** Place ajoutée par les notes d'une case trop larges pour elle, sur la ligne qui en demande le plus. */
export const noteExtra = (sys: System, a: number, cellW: number, reminders = true) =>
  Math.max(0, ...sys.staves.flatMap((p) => p.rows.map((r) => noteW(r.cells[a], cellW, reminders, r.string !== undefined ? bendStart(p.rows, a) : 0))));

/** Hauteur de l'en-tête de la première page : titre, sous-titre éventuel, compositeur. */
export const headerHeight = (meta: Score["meta"]) => G.headerH + (meta.subtitle ? G.subtitleH : 0);

/** Largeur des rangs de petites notes d'une portée, dans une case. */
export const graceSlotW = (d: number) => d * G.graceDigit + G.graceGap;
const graceW = (digits: number[]) => digits.reduce((w, d) => w + graceSlotW(d), 0);
/** Place ajoutée en tête d'une case par ses petites notes (la portée qui en a le plus). */
export const graceExtra = (sys: System, a: number) => Math.max(0, ...sys.staves.map((p) => graceW(p.graceDigits[a])));
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
  /** Haut de la règle de comptage, depuis le haut du système (comme les places des portées). */
  rulerTop: number;
  /** Place de chaque portée, de haut en bas. */
  staves: StaffPlace[];
  /** Place de chaque partie : du haut de ses lignes au bas de sa dernière portée (pédale exclue). */
  parts: { top: number; bottom: number; first: number; last: number; name?: string }[];
  height: number;
  /** Hauteur d'une ligne de notes (moindre en espacement compact). */
  rowH: number;
  /** Abscisse de chaque colonne (case ou séparateur), depuis le bord gauche de la page. */
  xs: number[];
  /** Largeur de chaque colonne. */
  ws: number[];
  /** Hauteur de la bande des accords, juste au-dessus de la règle (0 sans accord). */
  chordBand: number;
};

/**
 * Place d'une portée dans un système, de haut en bas : le trait épais qui la sépare de la
 * portée du dessus (separator, dans une même partie), ses lignes de notes, puis ses
 * bandes de liaisons, de paroles, de nuances et de pédale. Ordonnées depuis le haut du système.
 */
export type StaffPlace = {
  separator?: number;
  /** Sur une corde, au-dessus des cordes : la bande du médiator et de l'écart des bends (sa hauteur : rowsTop - techTop). */
  techTop: number;
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
/** Une grille du récapitulatif en tête de partition : le nom de l'accord, sa grille, et sa place. */
export type ChartItem = { name: string; shape: Shape; x: number; y: number };
export type Page = { index: number; systems: PlacedSystem[]; header: boolean; order: string[]; chart?: ChartItem[] };

// l'arpège se dessine devant l'accord, pas dans la bande des nuances
// l'arpège et les articulations se dessinent sur la note, pas dans la bande des nuances
const voiceH = (v: Voice) => (v.marks.some((m) => m.kind !== "arpeggio" && m.kind !== "articulation") || v.hairpins.length || v.effects.length ? G.voiceH : 0);

/**
 * Disposition verticale d'un système dont le haut est à y : au-dessus de la règle, les bandes
 * de textes, de structure (débuts de section, points d'orgue, « 3× ») et d'accords ; puis
 * chaque portée. Deux portées d'une partie sont séparées par un trait épais, deux
 * parties par un espace ; la pédale d'une partie passe sous sa dernière portée.
 */
export function geometry(s: System, chords: ChordStyle, y: number, rowH: number = G.rowH) {
  const textBand = s.marks.some((m) => m.kind === "text") ? G.markH : 0;
  const structBand = s.marks.some((m) => m.kind === "times" || m.kind === "marker" || m.kind === "fermata") ? G.markH : 0;
  const chordBand = chordH(s, chords);
  const rulerTop = y + textBand + structBand + chordBand;
  const firsts = firstStaves(s.parts);
  let cur = rulerTop + G.rulerH;
  const staves: StaffPlace[] = s.staves.map((p, k) => {
    let separator: number | undefined;
    if (k > 0 && firsts.includes(k)) cur += G.partGap;
    else if (k > 0) {
      separator = cur + G.staffGap;
      cur = separator + G.staffGap;
    }
    // sur une corde, sous les liaisons, la lettre du legato (H, P)
    const legato = p.voice.slurs.length && p.rows.some((r) => r.string !== undefined) ? G.legatoH : 0;
    const slurBand = slurH(p.voice) + legato, lyricBand = lyricH(p.voice), voiceBand = voiceH(p.voice);
    const pedalBand = p.pedal.spans.length || p.pedal.texts.length ? G.pedalH : 0;
    // au-dessus des cordes, le sens du médiator et l'écart des bends, en grand, comme en tablature
    const tech = p.rows.some((r) => r.string !== undefined) && (p.voice.marks.some((m) => m.kind === "articulation" && isPickSign(m.text)) || p.rows.some((r) => r.cells.some((c) => techniqueOf(c)?.bend !== undefined)));
    const techTop = cur;
    const rowsTop = cur + (tech ? G.techH : 0);
    const slurTop = rowsTop + p.rows.length * rowH;
    const lyricTop = slurTop + slurBand;
    const voiceTop = lyricTop + lyricBand;
    const pedalTop = voiceTop + voiceBand;
    cur = pedalTop + pedalBand;
    return { separator, techTop, rowsTop, slurTop, lyricTop, voiceTop, pedalTop, bottom: pedalTop, slurBand, lyricBand, voiceBand, pedalBand };
  });
  const parts = s.parts.map((x, i) => {
    const first = firsts[i], last = first + x.staves - 1;
    return { top: i === 0 ? rulerTop : staves[first].rowsTop, bottom: staves[last].bottom, first, last, ...(x.name ? { name: x.name } : {}) };
  });
  return { textBand, structBand, chordBand, rulerTop, staves, parts, height: cur - y + 1, rowH };
}

export const systemHeight = (s: System, chords: ChordStyle = "both", rowH: number = G.rowH) => geometry(s, chords, 0, rowH).height;

/** Largeur d'une barre de mesure, selon ses signes de reprise (identique au calcul du moteur). */
const barSepWidth = (c: Extract<System["columns"][number], { kind: "barSep" }>) =>
  c.lead
    ? G.repeatDots + G.beatSep
    : c.spaced
      ? // fin de section, blanc, puis début de la suivante, ouvert comme un début de ligne
        G.barSep + (c.endRepeat ? G.repeatDots : 0) + G.sectionSep + (c.startRepeat ? G.repeatDots + G.beatSep : 0)
      : G.barSep + (c.endRepeat ? G.repeatDots : 0) + (c.startRepeat ? G.repeatDots : 0);

/**
 * prevStretch : étirement de la ligne précédente de la même section, s'il y en a une. La
 * dernière ligne d'une section (ou du morceau) le reprend, sans dépasser la largeur : ses
 * cases ont la même taille que celles du dessus, et une ligne courte reste courte.
 */
function place(sys: System, isLast: boolean, y: number, cellW: number, chords: ChordStyle, names: ChordNames, prevStretch?: number, reminders = true, rowH: number = G.rowH): PlacedSystem {
  const chordAt = new Map(sys.chords.map((c) => [c.anchor, chordW(c.text, chords, names)]));
  const anchorOf = (ci: number) => sys.anchors.indexOf(ci);
  const cells = sys.anchors.length;
  const fixed = sys.width - cells * cellW;
  let stretch = (CONTENT_W - fixed) / (cells * cellW);
  if ((isLast || sys.endsSection) && prevStretch !== undefined) stretch = Math.min(stretch, prevStretch);
  stretch = Math.max(0.5, Math.min(stretch, G.maxStretch));
  const xs: number[] = [];
  const ws: number[] = [];
  let x = PAGE.marginX + G.prefix;
  for (const c of sys.columns) {
    // les petites notes s'ajoutent en tête de case, sans étirement
    const a = anchorOf(xs.length);
    const w = c.kind === "anchor" ? Math.max(cellW * stretch + leadExtra(sys, a) + Math.max(noteExtra(sys, a, cellW, reminders), lyricExtra(sys, a, cellW)), chordAt.get(a) ?? 0) : c.kind === "barSep" ? barSepWidth(c) : G.beatSep;
    xs.push(x);
    ws.push(w);
    x += w;
  }
  return { sys, stretch, y, xs, ws, ...geometry(sys, chords, 0, rowH) };
}

/**
 * Le récapitulatif des grilles, en tête de partition : chaque accord du morceau une fois (le même
 * nom avec une autre grille écrite compte à part), dans l'ordre où il vient, en rangées centrées
 * à partir de top. Un accord que rien ne joue sur la guitare n'y est pas.
 */
export function chordChart(score: Score, names: ChordNames, top: number) {
  const seen = new Set<string>();
  const found: { name: string; shape: Shape }[] = [];
  for (const c of [...score.chords].sort((a, b) => a.t - b.t)) {
    const name = splitChord(c.text, names).name ?? chordOf(c.text);
    const shape = chordGrid(c.text, score.parts);
    const key = name + "=" + shape?.join(",");
    if (!shape || seen.has(key)) continue;
    seen.add(key);
    found.push({ name, shape });
  }
  const w = (name: string) => Math.max(name.length * G.chordChar, gridW()) + G.chartGap;
  const rowH = G.chordNameH + gridH() + 1.5;
  // en rangées : autant qu'il en tient sur la largeur, chaque rangée centrée
  const rows: { name: string; shape: Shape }[][] = [[]];
  let used = 0;
  for (const f of found) {
    if (used + w(f.name) > CONTENT_W && rows[rows.length - 1].length) {
      rows.push([]);
      used = 0;
    }
    rows[rows.length - 1].push(f);
    used += w(f.name);
  }
  const items: ChartItem[] = rows.flatMap((row, r) => {
    let x = PAGE.marginX + (CONTENT_W - row.reduce((n, f) => n + w(f.name), 0) + G.chartGap) / 2;
    return row.map((f) => {
      const item = { ...f, x, y: top + r * rowH };
      x += w(f.name);
      return item;
    });
  });
  return { items, height: found.length ? rows.length * rowH : 0 };
}

/**
 * compact : cases plus étroites, donc plus de mesures par ligne ; chords : affichage des
 * accords ; align : notes alignées, une note rejouée gardant sa ligne, ou une ligne par note (voir layout) ; reminders : rappel, en début
 * de système, de la note tenue depuis le système précédent ; inlineSections : une nouvelle section
 * suit sur la même ligne, séparée par un blanc, au lieu de commencer une ligne.
 */
export function engrave(score: Score, { compact = false, chords = "both" as ChordStyle, chordNames = "prisma" as ChordNames, chart = false, align = undefined as Align | undefined, reminders = true, inlineSections = false } = {}): Page[] {
  const cellW = compact ? G.compactCell : G.cell;
  const rowH = compact ? G.compactRowH : G.rowH;
  const systems = layout(score, {
    width: CONTENT_W,
    prefix: G.prefix,
    cell: cellW,
    cellAt: (t) =>
      cellW +
      Math.max(...Array.from({ length: staffCount(score.parts) }, (_, k) => graceW(graceDigits(score.graces, k, t, score.parts)))) +
      (score.arpeggios.some((x) => x.t === t) ? G.arpeggioW : 0) +
      // une note annotée ou une syllabe trop longue élargit sa case (l'une sous l'autre : la plus large compte)
      Math.max(0, ...score.notes.filter((n) => n.start === t).map((n) => noteW(noteText(n, score.parts), cellW)), ...score.lyrics.filter((l) => l.t === t).map((l) => lyricW(l.text, !!l.hyphen) - cellW)) +
      // un nom d'accord trop long élargit sa case
      Math.max(0, ...score.chords.filter((c) => c.t === t).map((c) => chordW(c.text, chords, chordNames) - cellW)),
    beatSep: G.beatSep,
    barSep: G.barSep,
    repeatDots: G.repeatDots,
    allStrings: true,
    align,
    sectionSep: inlineSections ? G.sectionSep : undefined,
  });
  const pages: Page[] = [];
  const order = score.order;
  const orderH = order.length ? G.orderH : 0;
  let page: Page = { index: 0, systems: [], header: true, order };
  let y = PAGE.marginTop + headerHeight(score.meta) + orderH;
  if (chart) {
    const c = chordChart(score, chordNames, y);
    if (c.items.length) {
      page.chart = c.items;
      y += c.height + G.systemGap;
    }
  }
  const bottom = PAGE.h - PAGE.marginBottom;
  let lastStretch: number | undefined;
  systems.forEach((sys, i) => {
    const h = systemHeight(sys, chords, rowH);
    if (sys.section && page.systems.length) y += compact ? G.compactSectionGap : G.sectionGap;
    if (y + h > bottom && page.systems.length) {
      pages.push(page);
      page = { index: pages.length, systems: [], header: false, order };
      y = PAGE.marginTop + orderH;
    }
    // la ligne précédente, si elle est de la même section
    const prev = i > 0 && !sys.section && !systems[i - 1].endsSection ? lastStretch : undefined;
    const placed = place(sys, i === systems.length - 1, y, cellW, chords, chordNames, prev, reminders, rowH);
    lastStretch = placed.stretch;
    page.systems.push(placed);
    y += h + (compact ? G.compactSystemGap : G.systemGap);
  });
  pages.push(page);
  return pages;
}
