/**
 * Couleur par octave : chaque couloir d'octave sur un fond pâle, toujours le même pour une
 * octave donnée, dans tous les morceaux, pour apprendre à situer les octaves. L'onglet
 * reprend la couleur un ton plus soutenu. Le numéro d'octave reste dans l'onglet : la
 * couleur ne porte jamais seule l'information (impression en noir et blanc, daltonisme).
 */
export type OctavePalette = "none" | "rainbow" | "muted";

/** Une teinte : le fond du couloir et celui de son onglet. */
type Tint = { band: string; tab: string };

const RAINBOW = {
  greyviolet: { band: "#eeeaf2", tab: "#d9d2e2" },
  violet: { band: "#ebe3f6", tab: "#d6c8ec" },
  blue: { band: "#e2eaf8", tab: "#c7d6f1" },
  cyan: { band: "#ddf0f3", tab: "#bfe2e8" },
  green: { band: "#e3f3df", tab: "#c7e6bf" },
  yellow: { band: "#faf3d2", tab: "#f1e3a3" },
  orange: { band: "#fde8d3", tab: "#f8cfa6" },
  red: { band: "#fbe0dd", tab: "#f3bfb9" },
  pink: { band: "#f2e6ea", tab: "#e3cad3" },
};

// teintes feutrées : sourdes et douces, plus discrètes que l'arc-en-ciel
const MUTED = {
  gray: { band: "#f1f1ef", tab: "#e3e2e0" },
  brown: { band: "#f4eeee", tab: "#eee0da" },
  orange: { band: "#fbecdd", tab: "#fadec9" },
  yellow: { band: "#fbf3db", tab: "#fdecc8" },
  green: { band: "#edf3ec", tab: "#dbeddb" },
  blue: { band: "#e7f3f8", tab: "#d3e5ef" },
  purple: { band: "#f4f0f7", tab: "#e8deee" },
  pink: { band: "#faf1f5", tab: "#f5e0e9" },
  red: { band: "#fdebec", tab: "#ffe2dd" },
};

/**
 * Teinte de chaque octave, de -4 (le plus grave) à +4. « Dans l'ordre » : une progression
 * qui dit aussi « plus haut » ou « plus bas ». « Mélangé » : un ordre fixe où deux octaves
 * voisines ont toujours des teintes bien différentes ; l'octave 0 garde sa couleur.
 */
const ORDERS: Record<Exclude<OctavePalette, "none">, { natural: Tint[]; mixed: Tint[] }> = {
  rainbow: {
    natural: [RAINBOW.greyviolet, RAINBOW.violet, RAINBOW.blue, RAINBOW.cyan, RAINBOW.green, RAINBOW.yellow, RAINBOW.orange, RAINBOW.red, RAINBOW.pink],
    mixed: [RAINBOW.yellow, RAINBOW.violet, RAINBOW.cyan, RAINBOW.orange, RAINBOW.green, RAINBOW.pink, RAINBOW.blue, RAINBOW.red, RAINBOW.greyviolet],
  },
  muted: {
    natural: [MUTED.green, MUTED.yellow, MUTED.orange, MUTED.brown, MUTED.gray, MUTED.blue, MUTED.purple, MUTED.pink, MUTED.red],
    mixed: [MUTED.red, MUTED.blue, MUTED.yellow, MUTED.purple, MUTED.gray, MUTED.green, MUTED.orange, MUTED.pink, MUTED.brown],
  },
};

/** Teinte d'une octave (écart au do central, de -4 à +4), ou rien sans palette. */
export function octaveTint(palette: OctavePalette, mixed: boolean, offset: number): Tint | undefined {
  if (palette === "none") return undefined;
  const list = ORDERS[palette][mixed ? "mixed" : "natural"];
  return list[Math.max(0, Math.min(8, offset + 4))];
}
