/** Options de rendu, choisies dans le panneau « Options » et gardées dans le navigateur. */
export type OctaveStyle = "arrow" | "sign" | "triangle";
export type OctavePosition = "top" | "center";

export type RenderOptions = {
  /** Marque des octaves : flèche (↑1), signe (+1) ou triangle (▲1). */
  octaveStyle: OctaveStyle;
  /** Place du numéro dans l'onglet : en face de la première ligne du groupe, ou au centre. */
  octavePosition: OctavePosition;
  /** Regraver automatiquement peu après la dernière frappe. */
  autoEngrave: boolean;
};

export const DEFAULT_OPTIONS: RenderOptions = { octaveStyle: "triangle", octavePosition: "top", autoEngrave: false };

export const OCTAVE_STYLES: { value: OctaveStyle; label: string; sample: string }[] = [
  { value: "arrow", label: "Flèches", sample: "↑1  0  ↓1" },
  { value: "sign", label: "Signes", sample: "+1  0  −1" },
  { value: "triangle", label: "Triangles", sample: "▲1  0  ▼1" },
];

export const OCTAVE_POSITIONS: { value: OctavePosition; label: string }[] = [
  { value: "top", label: "En haut" },
  { value: "center", label: "Au centre" },
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
    return { ...DEFAULT_OPTIONS, octaveStyle, octavePosition, autoEngrave };
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
