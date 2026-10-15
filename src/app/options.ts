/** Options de rendu et d'écoute, choisies dans le panneau « Options » et gardées dans le navigateur. */
import type { OctavePalette } from "./colors.ts";
import type { ChordStyle } from "./engrave.ts";
import type { SimileDisplay } from "./pedal.ts";
import { CLICK_SOUNDS, DEFAULT_CLICK_SOUNDS } from "./metronome.ts";
import type { ClickSounds } from "./metronome.ts";
import type { ClickGrid } from "./performance.ts";

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
  /** Noms des instruments : au premier système seulement (comme une partition), ou à chaque système. */
  namesEverySystem: boolean;
  /** En début de ligne, rappeler la note tenue depuis la ligne précédente (« — 8 ») ; sinon le seul trait de tenue. */
  holdReminders: boolean;
  /** Couleur des couloirs d'octave : aucune (bandes grises alternées), arc-en-ciel ou feutrée. */
  octavePalette: OctavePalette;
  /** Couleurs dans un ordre mélangé (fixe) plutôt que progressif : plus de contraste entre voisines. */
  octaveMixed: boolean;
  /** Accords : nom anglais, notes ymn empilées, ou les deux. */
  chords: ChordStyle;
  /** « Ped. simile » : gravé en pédales comme les autres, en pédales atténuées, ou en mention seule. */
  simile: SimileDisplay;
  /** Écoute : le métronome sur les temps (bouton à côté de la lecture). */
  metronome: boolean;
  /** Écoute : les instruments, sans eux le métronome seul (bouton à côté de la lecture). */
  instruments: boolean;
  /** Métronome : le son de chaque niveau (premier temps, temps, division, subdivision), ou aucun. */
  clickSounds: ClickSounds;
  /** Métronome : sur la grille régulière des temps, ou sur les cases écrites. */
  clickGrid: ClickGrid;
  /** Métronome : une mesure de décompte avant de jouer. */
  countIn: boolean;
  /** Métronome : son volume, par rapport aux instruments (1 : tel quel). */
  clickVolume: number;
};

export const DEFAULT_OPTIONS: RenderOptions = { octaveStyle: "triangle", octavePosition: "top", autoEngrave: false, notePosition: "top", density: "normal", fingerings: true, namesEverySystem: false, holdReminders: true, octavePalette: "rainbow", octaveMixed: false, chords: "both", simile: "pedals", metronome: false, instruments: true, clickSounds: DEFAULT_CLICK_SOUNDS, clickGrid: "cells", countIn: false, clickVolume: 1 };

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

export const SIMILE_DISPLAYS: { value: SimileDisplay; label: string }[] = [
  { value: "pedals", label: "Pédales" },
  { value: "faded", label: "Pédales atténuées" },
  { value: "text", label: "Mention seule" },
];

export const CLICK_GRIDS: { value: ClickGrid; label: string }[] = [
  { value: "cells", label: "Cases écrites" },
  { value: "attacks", label: "Attaques" },
  { value: "beats", label: "Temps et divisions" },
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
    const namesEverySystem = typeof raw.namesEverySystem === "boolean" ? raw.namesEverySystem : DEFAULT_OPTIONS.namesEverySystem;
    const holdReminders = typeof raw.holdReminders === "boolean" ? raw.holdReminders : DEFAULT_OPTIONS.holdReminders;
    const octavePalette = OCTAVE_PALETTES.some((p) => p.value === raw.octavePalette) ? raw.octavePalette : DEFAULT_OPTIONS.octavePalette;
    const octaveMixed = typeof raw.octaveMixed === "boolean" ? raw.octaveMixed : DEFAULT_OPTIONS.octaveMixed;
    const chords = CHORD_STYLES.some((c) => c.value === raw.chords) ? raw.chords : DEFAULT_OPTIONS.chords;
    const simile = SIMILE_DISPLAYS.some((d) => d.value === raw.simile) ? raw.simile : DEFAULT_OPTIONS.simile;
    const metronome = typeof raw.metronome === "boolean" ? raw.metronome : DEFAULT_OPTIONS.metronome;
    const instruments = typeof raw.instruments === "boolean" ? raw.instruments : DEFAULT_OPTIONS.instruments;
    const countIn = typeof raw.countIn === "boolean" ? raw.countIn : DEFAULT_OPTIONS.countIn;
    const clickVolume = typeof raw.clickVolume === "number" && raw.clickVolume >= 0 && raw.clickVolume <= 2 ? raw.clickVolume : DEFAULT_OPTIONS.clickVolume;
    const clickGrid = CLICK_GRIDS.some((g) => g.value === raw.clickGrid) ? raw.clickGrid : DEFAULT_OPTIONS.clickGrid;
    const sounds = raw.clickSounds ?? {};
    const clickSounds = Object.fromEntries(
      Object.entries(DEFAULT_CLICK_SOUNDS).map(([level, d]) => [level, CLICK_SOUNDS.some((c) => c.value === sounds[level]) ? sounds[level] : d]),
    ) as ClickSounds;
    return { ...DEFAULT_OPTIONS, octaveStyle, octavePosition, autoEngrave, notePosition, density, fingerings, namesEverySystem, holdReminders, octavePalette, octaveMixed, chords, simile, metronome, instruments, clickSounds, clickGrid, countIn, clickVolume };
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
