/** Options de rendu, choisies dans le panneau « Options » et gardées dans le navigateur. */
import type { OctavePalette } from "./colors.ts";
import type { ChordStyle } from "./engrave.ts";

export type OctaveStyle = "arrow" | "sign" | "triangle";
export type OctavePosition = "top" | "center";
export type NotePosition = "top" | "center" | "aligned";
export type Density = "normal" | "compact";

export type RenderOptions = {
  /** Marque des octaves : flèche (↑1), signe (+1) ou triangle (▲1). */
  octaveStyle: OctaveStyle;
  /** Place du numéro dans l'onglet : en face de la première ligne du groupe, ou au centre. */
  octavePosition: OctavePosition;
  /** Regraver automatiquement peu après la dernière frappe. */
  autoEngrave: boolean;
  /**
   * Place des notes dans un couloir d'octave : en haut, chaque bloc centré verticalement, ou
   * alignées (une note rejouée garde sa ligne, pour suivre des yeux une note qui revient).
   */
  notePosition: NotePosition;
  /** Espacement des cases : normal, ou compact pour gagner de la place sur les partitions chargées. */
  density: Density;
  /** Graver les doigtés : les masquer allège la page sans toucher au fichier. */
  fingerings: boolean;
  /** Couleur des couloirs d'octave : aucune (bandes grises alternées), arc-en-ciel ou feutrée. */
  octavePalette: OctavePalette;
  /** Couleurs dans un ordre mélangé (fixe) plutôt que progressif : plus de contraste entre voisines. */
  octaveMixed: boolean;
  /** Accords : nom anglais, notes ymn empilées, ou les deux. */
  chords: ChordStyle;
};

export const DEFAULT_OPTIONS: RenderOptions = { octaveStyle: "triangle", octavePosition: "top", autoEngrave: false, notePosition: "top", density: "normal", fingerings: true, octavePalette: "rainbow", octaveMixed: false, chords: "both" };

export const OCTAVE_STYLES: { value: OctaveStyle; label: string; sample: string }[] = [
  { value: "arrow", label: "Flèches", sample: "↑1  0  ↓1" },
  { value: "sign", label: "Signes", sample: "+1  0  −1" },
  { value: "triangle", label: "Triangles", sample: "▲1  0  ▼1" },
];

export const OCTAVE_POSITIONS: { value: OctavePosition; label: string }[] = [
  { value: "top", label: "En haut" },
  { value: "center", label: "Au centre" },
];

export const NOTE_POSITIONS: { value: NotePosition; label: string }[] = [
  { value: "top", label: "En haut" },
  { value: "center", label: "Centrées" },
  { value: "aligned", label: "Alignées" },
];

export const OCTAVE_PALETTES: { value: OctavePalette; label: string }[] = [
  { value: "none", label: "Aucune" },
  { value: "rainbow", label: "Arc-en-ciel" },
  { value: "muted", label: "Feutrée" },
];

export const CHORD_STYLES: { value: ChordStyle; label: string; sample: string }[] = [
  { value: "name", label: "Nom", sample: "Am" },
  { value: "notes", label: "Notes", sample: "10 1 5" },
  { value: "both", label: "Les deux", sample: "Am + 10 1 5" },
];

export const DENSITIES: { value: Density; label: string }[] = [
  { value: "normal", label: "Normal" },
  { value: "compact", label: "Compact" },
];

const KEY = "ymn:options";

export function loadOptions(): RenderOptions {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const octaveStyle = OCTAVE_STYLES.some((s) => s.value === raw.octaveStyle) ? raw.octaveStyle : DEFAULT_OPTIONS.octaveStyle;
    const octavePosition = OCTAVE_POSITIONS.some((p) => p.value === raw.octavePosition)
      ? raw.octavePosition
      : DEFAULT_OPTIONS.octavePosition;
    const autoEngrave = typeof raw.autoEngrave === "boolean" ? raw.autoEngrave : DEFAULT_OPTIONS.autoEngrave;
    const notePosition = NOTE_POSITIONS.some((p) => p.value === raw.notePosition) ? raw.notePosition : DEFAULT_OPTIONS.notePosition;
    const density = DENSITIES.some((d) => d.value === raw.density) ? raw.density : DEFAULT_OPTIONS.density;
    const fingerings = typeof raw.fingerings === "boolean" ? raw.fingerings : DEFAULT_OPTIONS.fingerings;
    const octavePalette = OCTAVE_PALETTES.some((p) => p.value === raw.octavePalette) ? raw.octavePalette : DEFAULT_OPTIONS.octavePalette;
    const octaveMixed = typeof raw.octaveMixed === "boolean" ? raw.octaveMixed : DEFAULT_OPTIONS.octaveMixed;
    const chords = CHORD_STYLES.some((c) => c.value === raw.chords) ? raw.chords : DEFAULT_OPTIONS.chords;
    return { ...DEFAULT_OPTIONS, octaveStyle, octavePosition, autoEngrave, notePosition, density, fingerings, octavePalette, octaveMixed, chords };
  } catch {
    return DEFAULT_OPTIONS;
  }
}

export function saveOptions(o: RenderOptions) {
  try {
    localStorage.setItem(KEY, JSON.stringify(o));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}
