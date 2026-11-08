/**
 * Les couleurs, les polices et les traits de la page gravée : ce que partagent ses composants.
 *
 * Trois sortes de chiffres, trois apparences :
 *  - notes : gras, noir, droit (la seule chose à jouer) ;
 *  - temps : plus petits, italiques, gris ;
 *  - octaves : onglet pâle couvrant le groupe, chiffre gris foncé.
 */
export const INK = "#1b1d1f";
export const GREY = "#8a8f94";
export const LIGHT = "#c9cdd1";
export const LIGHT_TEXT = "#aeb3b8";
/** Le fond d'un couloir sur deux, sans couleur d'octave. */
export const BAND = "#f1f2ee";
export const TAB = "#e6e8e3";
export const TAB_TEXT = "#4a4f54";
/** Les petites notes : gris foncé, entre les notes et les tenues. */
export const GRACE = "#5a5f64";

export const FONT = `"Atkinson Hyperlegible", "Segoe UI", system-ui, sans-serif`;
/** Nuances en gras italique à empattements, comme sur une partition. */
export const DYNAMIC_FONT = `Georgia, "Times New Roman", serif`;
/** Paroles : à empattements, droites, pour ne pas les confondre avec les chiffres des notes. */
export const LYRIC_FONT = DYNAMIC_FONT;

/** Le trait d'une ondulation (trille, arpège, vibrato). */
export const WAVE = { fill: "none", stroke: INK, "stroke-width": 0.3, "stroke-linejoin": "round", "stroke-linecap": "round" } as const;

/** Un liseré blanc autour d'un texte : il reste lisible là où il traverse un trait. */
export const HALO = { stroke: "#fff", "stroke-width": 0.6, "paint-order": "stroke", "stroke-linejoin": "round" } as const;
