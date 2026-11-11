/** Options de rendu et d'écoute, choisies dans le panneau « Options » et gardées dans le navigateur. */
import type { LaneColors } from "../score/colors.ts";
import type { SourceColors } from "../editor/sourceColors.ts";
import type { ChordNames, ChordStyle } from "../score/engrave.ts";
import type { SimileDisplay } from "../playback/pedal.ts";
import { CLICK_SOUNDS, DEFAULT_CLICK_SOUNDS } from "../playback/metronome.ts";
import type { ClickSounds } from "../playback/metronome.ts";
import type { ClickGrid } from "../playback/performance.ts";
import type { Align, NoteNames, RulerDetail } from "../../core/index.ts";

/** Comment nommer une note : par son nom (do ré mi, ou C D E), sur un petit clavier, ou pas du tout (le numéro suffit). */
export type NameDisplay = NoteNames | "keyboard";
/** Les noms à écrire : le clavier se dessine, il n'écrit pas de nom. */
export const writtenNames = (nameDisplay: NameDisplay): NoteNames => (nameDisplay === "keyboard" ? "none" : nameDisplay);

/** Comment la partition nomme une hauteur (la tonalité, la note à vide d'une corde) : en Prisma (« 8 », « 5:m »), en do ré mi, ou en anglais. */
export type ScoreNames = "prisma" | "latin" | "english";
/** Les noms à graver : en Prisma, aucun nom de note, le numéro suffit. */
export const engravedNames = (scoreNames: ScoreNames): NoteNames => (scoreNames === "prisma" ? "none" : scoreNames);

export type OctaveStyle = "arrow" | "sign" | "triangle";
export type OctavePosition = "top" | "center";
export type NotePosition = "top" | "center" | "aligned" | "pitch";
export type Density = "normal" | "compact";

export type RenderOptions = {
  /** Marque des octaves : flèche (↑1), signe (+1) ou triangle (▲1). */
  octaveStyle: OctaveStyle;
  /** Place du numéro dans l'onglet : en face de la première ligne du groupe, ou au centre. */
  octavePosition: OctavePosition;
  /** Regraver automatiquement peu après la dernière frappe. */
  autoEngrave: boolean;
  /**
   * Place des notes dans un couloir d'octave : en haut, chaque bloc centré verticalement,
   * alignées (une note rejouée garde sa ligne, pour suivre des yeux une note qui revient), ou une
   * ligne par note (de plus, deux notes d'une même mesure sur deux lignes : le dessin de la mélodie).
   */
  notePosition: NotePosition;
  /** Espacement des cases : normal, ou compact pour gagner de la place sur les partitions chargées. */
  density: Density;
  /** La règle : les cases écrites, ou chaque temps découpé jusqu'au premier ou au second découpage, même sans attaque. */
  rulerDetail: RulerDetail;
  /** Graver les doigtés : les masquer allège la page sans toucher au fichier. */
  fingerings: boolean;
  /** Noms des parties : au premier système seulement (comme une partition), ou à chaque système. */
  namesEverySystem: boolean;
  /** En début de ligne, rappeler la note tenue depuis la ligne précédente (« — 8 ») ; sinon le seul trait de tenue. */
  holdReminders: boolean;
  /** Couleur des couloirs (octaves ou cordes) : aucune (bandes grises alternées), ou une palette, dans l'ordre ou mélangée. */
  laneColors: LaneColors;
  /** Accords : leur nom, leurs notes Prisma empilées, ou les deux. */
  chords: ChordStyle;
  /** Nom des accords : en notation Prisma (« 10:m ») ou en anglais (« Am »). */
  chordNames: ChordNames;
  /** Partition : la tonalité, en tête, en Prisma, en do ré mi ou en anglais ; la note à vide de chaque corde, nommée en do ré mi ou en anglais. */
  scoreNames: ScoreNames;
  /** Les grilles de guitare des accords du morceau, récapitulées en tête de partition. */
  chordChart: boolean;
  /** Sections : chacune commence une nouvelle ligne, ou suit la précédente sur la même ligne, séparée par un blanc. */
  sections: SectionLayout;
  /** Éditeur : le nom des notes (barre de statut, choix de la note d'une case) : do ré mi, notation anglaise, un petit clavier, ou rien. */
  noteNames: NameDisplay;
  /** Éditeur : la coloration du texte, avec les couloirs d'octave, les signes seuls, ou aucune. */
  sourceColors: SourceColors;
  /** Éditeur : la partition et le texte reliés : un clic sur la partition place le curseur du texte sur le signe cliqué, le signe sous le curseur du texte est encadré sur la partition. */
  scoreToText: boolean;
  /** « Ped. simile » : gravé en pédales comme les autres, en pédales atténuées, ou en mention seule. */
  simile: SimileDisplay;
  /** Écoute : dans la dernière mesure d'un système, la page glisse peu à peu pour montrer d'avance le système joué ensuite. */
  lookAhead: boolean;
  /** Écoute : le métronome sur les temps (bouton à côté de la lecture). */
  metronome: boolean;
  /** Métronome : le son de chaque niveau (premier temps, temps, division, subdivision), ou aucun. */
  clickSounds: ClickSounds;
  /** Métronome : sur la grille régulière des temps, ou sur les cases écrites. */
  clickGrid: ClickGrid;
  /** Métronome : une mesure de décompte avant de jouer. */
  countIn: boolean;
  /** Métronome : son volume, par rapport aux instruments (1 : tel quel). */
  clickVolume: number;
};

export const DEFAULT_OPTIONS: RenderOptions = {
  octaveStyle: "triangle",
  octavePosition: "top",
  autoEngrave: false,
  notePosition: "top",
  density: "normal",
  rulerDetail: "written",
  fingerings: true,
  namesEverySystem: false,
  holdReminders: true,
  laneColors: "rainbow",
  chords: "both",
  chordNames: "prisma",
  scoreNames: "prisma",
  chordChart: false,
  sections: "newLine",
  noteNames: "latin",
  sourceColors: "octaves",
  scoreToText: true,
  simile: "pedals",
  lookAhead: true,
  metronome: false,
  clickSounds: DEFAULT_CLICK_SOUNDS,
  clickGrid: "cells",
  countIn: false,
  clickVolume: 1,
};

export const OCTAVE_STYLES: { value: OctaveStyle; label: string; sample: string }[] = [
  { value: "arrow", label: "Flèches", sample: "↑1  0  ↓1" },
  { value: "sign", label: "Signes", sample: "+1  0  −1" },
  { value: "triangle", label: "Triangles", sample: "▲1  0  ▼1" },
];

export const OCTAVE_POSITIONS: { value: OctavePosition; label: string }[] = [
  { value: "top", label: "En haut" },
  { value: "center", label: "Au centre" },
];

/** Les notes alignées à la gravure, selon la place des notes choisie. */
export const alignOf = (position: NotePosition): Align | undefined =>
  position === "aligned" ? "replayed" : position === "pitch" ? "pitch" : undefined;

export const NOTE_POSITIONS: { value: NotePosition; label: string }[] = [
  { value: "top", label: "En haut" },
  { value: "center", label: "Centrées" },
  { value: "aligned", label: "Alignées" },
  { value: "pitch", label: "Une ligne par note" },
];

export const LANE_COLORS: { value: LaneColors; label: string }[] = [
  { value: "none", label: "Blanc et gris" },
  { value: "rainbow", label: "Arc-en-ciel" },
  { value: "rainbowMixed", label: "Arc-en-ciel mélangé" },
  { value: "muted", label: "Feutré" },
  { value: "mutedMixed", label: "Feutré mélangé" },
];

export const CHORD_STYLES: { value: ChordStyle; label: string; sample: string }[] = [
  { value: "name", label: "Nom", sample: "10:m" },
  { value: "notes", label: "Notes", sample: "10 1 5" },
  { value: "both", label: "Les deux", sample: "10:m + 10 1 5" },
  { value: "grid", label: "Nom et grille", sample: "10:m + x02210" },
];

export const RULER_DETAILS: RulerDetail[] = ["written", "division", "subdivision"];

export type SectionLayout = "newLine" | "inline";
export const SECTION_LAYOUTS: { value: SectionLayout; label: string }[] = [
  { value: "newLine", label: "À la ligne" },
  { value: "inline", label: "À la suite" },
];

export const SIMILE_DISPLAYS: { value: SimileDisplay; label: string }[] = [
  { value: "pedals", label: "Pédales" },
  { value: "faded", label: "Pédales atténuées" },
  { value: "text", label: "Mention seule" },
];

export const CLICK_GRIDS: { value: ClickGrid; label: string; hint: string }[] = [
  { value: "cells", label: "Cases écrites", hint: "un coup par case écrite : il fait entendre quand jouer" },
  { value: "attacks", label: "Attaques", hint: "seulement là où une note commence : ni les tenues, ni les silences" },
  { value: "beats", label: "Temps et divisions", hint: "une grille régulière, quelles que soient les cases écrites" },
];

export const DENSITIES: { value: Density; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "compact", label: "Compact" },
];

const KEY = "prisma:options";

/** Les options enregistrées dans le navigateur, ou celles d'un texte (les réglages d'un morceau), validées. */
export function loadOptions(stored?: string | null): RenderOptions {
  try {
    const raw = JSON.parse((stored === undefined ? localStorage.getItem(KEY) : stored) ?? "{}");
    const octaveStyle = OCTAVE_STYLES.some((choice) => choice.value === raw.octaveStyle) ? raw.octaveStyle : DEFAULT_OPTIONS.octaveStyle;
    const octavePosition = OCTAVE_POSITIONS.some((choice) => choice.value === raw.octavePosition)
      ? raw.octavePosition
      : DEFAULT_OPTIONS.octavePosition;
    const autoEngrave = typeof raw.autoEngrave === "boolean" ? raw.autoEngrave : DEFAULT_OPTIONS.autoEngrave;
    const notePosition = NOTE_POSITIONS.some((choice) => choice.value === raw.notePosition)
      ? raw.notePosition
      : DEFAULT_OPTIONS.notePosition;
    const density = DENSITIES.some((choice) => choice.value === raw.density) ? raw.density : DEFAULT_OPTIONS.density;
    const rulerDetail = RULER_DETAILS.includes(raw.rulerDetail) ? raw.rulerDetail : DEFAULT_OPTIONS.rulerDetail;
    const fingerings = typeof raw.fingerings === "boolean" ? raw.fingerings : DEFAULT_OPTIONS.fingerings;
    const namesEverySystem = typeof raw.namesEverySystem === "boolean" ? raw.namesEverySystem : DEFAULT_OPTIONS.namesEverySystem;
    const holdReminders = typeof raw.holdReminders === "boolean" ? raw.holdReminders : DEFAULT_OPTIONS.holdReminders;
    const laneColors = LANE_COLORS.some((choice) => choice.value === raw.laneColors) ? raw.laneColors : DEFAULT_OPTIONS.laneColors;
    const chords = CHORD_STYLES.some((choice) => choice.value === raw.chords) ? raw.chords : DEFAULT_OPTIONS.chords;
    const chordNames = raw.chordNames === "english" || raw.chordNames === "prisma" ? raw.chordNames : DEFAULT_OPTIONS.chordNames;
    const scoreNames = ["prisma", "latin", "english"].includes(raw.scoreNames) ? raw.scoreNames : DEFAULT_OPTIONS.scoreNames;
    const chordChart = typeof raw.chordChart === "boolean" ? raw.chordChart : DEFAULT_OPTIONS.chordChart;
    const simile = SIMILE_DISPLAYS.some((choice) => choice.value === raw.simile) ? raw.simile : DEFAULT_OPTIONS.simile;
    const sections = SECTION_LAYOUTS.some((choice) => choice.value === raw.sections) ? raw.sections : DEFAULT_OPTIONS.sections;
    const noteNames = ["latin", "english", "keyboard", "none"].includes(raw.noteNames) ? raw.noteNames : DEFAULT_OPTIONS.noteNames;
    const sourceColors = ["octaves", "signs", "none"].includes(raw.sourceColors) ? raw.sourceColors : DEFAULT_OPTIONS.sourceColors;
    const scoreToText = typeof raw.scoreToText === "boolean" ? raw.scoreToText : DEFAULT_OPTIONS.scoreToText;
    const lookAhead = typeof raw.lookAhead === "boolean" ? raw.lookAhead : DEFAULT_OPTIONS.lookAhead;
    const metronome = typeof raw.metronome === "boolean" ? raw.metronome : DEFAULT_OPTIONS.metronome;
    const countIn = typeof raw.countIn === "boolean" ? raw.countIn : DEFAULT_OPTIONS.countIn;
    const clickVolume =
      typeof raw.clickVolume === "number" && raw.clickVolume >= 0 && raw.clickVolume <= 2 ? raw.clickVolume : DEFAULT_OPTIONS.clickVolume;
    const clickGrid = CLICK_GRIDS.some((choice) => choice.value === raw.clickGrid) ? raw.clickGrid : DEFAULT_OPTIONS.clickGrid;
    const sounds = raw.clickSounds ?? {};
    const clickSounds = Object.fromEntries(
      Object.entries(DEFAULT_CLICK_SOUNDS).map(([level, fallback]) => [
        level,
        CLICK_SOUNDS.some((choice) => choice.value === sounds[level]) ? sounds[level] : fallback,
      ]),
    ) as ClickSounds;
    return {
      ...DEFAULT_OPTIONS,
      octaveStyle,
      octavePosition,
      autoEngrave,
      notePosition,
      density,
      rulerDetail,
      fingerings,
      namesEverySystem,
      holdReminders,
      laneColors,
      chords,
      chordNames,
      scoreNames,
      chordChart,
      sections,
      noteNames,
      sourceColors,
      scoreToText,
      simile,
      lookAhead,
      metronome,
      clickSounds,
      clickGrid,
      countIn,
      clickVolume,
    };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

export function saveOptions(renderOptions: RenderOptions) {
  try {
    localStorage.setItem(KEY, JSON.stringify(renderOptions));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}
