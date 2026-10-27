/**
 * La vue de la partition, retenue d'une visite à l'autre : le zoom (un facteur parmi des crans),
 * l'ajustement des pages à la place laissée à la partition (à sa hauteur, côte à côte ; à sa
 * largeur, l'une sous l'autre ; ou deux systèmes seuls, la lecture focalisée), la largeur de
 * l'éditeur, la piste de lecture montrée ou non. Choisir un ajustement remet le zoom à 100 % : la
 * page tient alors exactement ; le zoom part de là. En lecture focalisée, pas de zoom.
 */
import { useCallback, useState } from "react";

export const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
export type Fit = "height" | "width" | "focus";
const FITS: Fit[] = ["height", "width", "focus"];
/** La largeur de l'éditeur, en part de la largeur de l'écran : par défaut, et ses bornes. */
export const EDITOR_WIDTH = 0.42;
export const clampWidth = (w: number) => Math.round(Math.min(0.8, Math.max(0.2, w)) * 1000) / 1000;

export type View = { zoom: number; fit: Fit; editorWidth: number; progress: boolean };

const VIEW_KEY = "prisma:view";
const DEFAULT: View = { zoom: 1, fit: "height", editorWidth: EDITOR_WIDTH, progress: true };

function load(): View {
  try {
    const raw = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "{}");
    return {
      zoom: ZOOMS.includes(raw.zoom) ? raw.zoom : 1,
      fit: FITS.includes(raw.fit) ? raw.fit : "height",
      editorWidth: typeof raw.editorWidth === "number" ? clampWidth(raw.editorWidth) : EDITOR_WIDTH,
      progress: raw.progress !== false,
    };
  } catch {
    return DEFAULT;
  }
}

function save(view: View) {
  try {
    localStorage.setItem(VIEW_KEY, JSON.stringify(view));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
  return view;
}

/** Le cran de zoom voisin, plus grand ou plus petit. */
const step = (zoom: number, dir: 1 | -1) => (dir > 0 ? (ZOOMS.find((z) => z > zoom + 1e-6) ?? zoom) : ([...ZOOMS].reverse().find((z) => z < zoom - 1e-6) ?? zoom));

export function useView() {
  const [view, setState] = useState(load);
  const setView = useCallback((patch: Partial<View>) => setState((cur) => save({ ...cur, ...patch })), []);
  const zoomBy = useCallback((dir: 1 | -1) => setState((cur) => (cur.fit === "focus" ? cur : save({ ...cur, zoom: step(cur.zoom, dir) }))), []);
  return { view, setView, zoomBy };
}
