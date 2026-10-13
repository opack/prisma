/** Options de rendu, choisies dans le panneau « Options » et gardées dans le navigateur. */
export type OctaveStyle = "arrow" | "sign" | "triangle";
export type OctavePosition = "top" | "center";
export type NotePosition = "top" | "center";
export type Density = "normal" | "compact";

export type RenderOptions = {
  /** Marque des octaves : flèche (↑1), signe (+1) ou triangle (▲1). */
  octaveStyle: OctaveStyle;
  /** Place du numéro dans l'onglet : en face de la première ligne du groupe, ou au centre. */
  octavePosition: OctavePosition;
  /** Regraver automatiquement peu après la dernière frappe. */
  autoEngrave: boolean;
  /** Place des notes dans un couloir d'octave : en haut, ou chaque bloc centré verticalement. */
  notePosition: NotePosition;
  /** Espacement des cases : normal, ou compact pour gagner de la place sur les partitions chargées. */
  density: Density;
  /** Graver les doigtés : les masquer allège la page sans toucher au fichier. */
  fingerings: boolean;
};

export const DEFAULT_OPTIONS: RenderOptions = { octaveStyle: "triangle", octavePosition: "top", autoEngrave: false, notePosition: "top", density: "normal", fingerings: true };

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
    return { ...DEFAULT_OPTIONS, octaveStyle, octavePosition, autoEngrave, notePosition, density, fingerings };
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
