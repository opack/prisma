/**
 * La vue de la partition, retenue d'une visite à l'autre (voir app/score/view.ts, qui garde les
 * crans de zoom et la lecture du stockage) : le zoom, l'ajustement des pages, la largeur de
 * l'éditeur, la piste de lecture montrée ou non. Choisir un ajustement remet le zoom à 100 % ; en
 * lecture focalisée, pas de zoom.
 */
import { useStorage } from "@vueuse/core";
import { EDITOR_WIDTH, FITS, ZOOMS, clampWidth } from "./view.ts";
import type { Fit, View } from "./view.ts";

const DEFAULT: View = { zoom: 1, fit: "height", editorWidth: EDITOR_WIDTH, progress: true };

/** La vue lue du stockage, chaque valeur ramenée à ce qui est permis. */
function sane(raw: Partial<View>): View {
  return {
    zoom: ZOOMS.includes(raw.zoom as number) ? (raw.zoom as number) : 1,
    fit: FITS.includes(raw.fit as Fit) ? (raw.fit as Fit) : "height",
    editorWidth: typeof raw.editorWidth === "number" ? clampWidth(raw.editorWidth) : EDITOR_WIDTH,
    progress: raw.progress !== false,
  };
}

/** Le cran de zoom voisin, plus grand ou plus petit. */
const step = (zoom: number, direction: 1 | -1) =>
  direction > 0
    ? (ZOOMS.find((level) => level > zoom + 1e-6) ?? zoom)
    : ([...ZOOMS].reverse().find((level) => level < zoom - 1e-6) ?? zoom);

export function useView() {
  const view = useStorage<View>("prisma:view", DEFAULT, localStorage, {
    serializer: { read: (raw) => sane(JSON.parse(raw)), write: JSON.stringify },
  });
  const setView = (patch: Partial<View>) => (view.value = { ...view.value, ...patch });
  const zoomBy = (direction: 1 | -1) => view.value.fit !== "focus" && setView({ zoom: step(view.value.zoom, direction) });
  return { view, setView, zoomBy };
}
