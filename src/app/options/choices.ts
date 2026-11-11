/**
 * Les choix du panneau des options : ses onglets, et pour chaque option à liste, ses valeurs, leur nom
 * et ce qu'elles font ; le nom en clair de la valeur d'une option du rendu, pour dire celle de l'autre
 * portée.
 */
import type { LaneColors } from "../score/colors.ts";
import type { ClickLevel } from "../playback/performance.ts";
import type { RenderOptions } from "./options.ts";
import type { PieceKey } from "./piece.ts";

/** Un choix d'une liste : sa valeur, son nom, et ce qu'il fait. */
export type Option<T> = { value: T; label: string; hint: string };

export const TABS = [
  { id: "editing", label: "Édition", piece: false },
  { id: "score", label: "Partition", piece: true },
  { id: "lanes", label: "Couloirs", piece: true },
  { id: "notes", label: "Notes", piece: true },
  { id: "playback", label: "Lecture", piece: false },
  { id: "metronome", label: "Métronome", piece: false },
] as const;
export type Tab = (typeof TABS)[number]["id"];

export const CHORDS: Option<RenderOptions["chords"]>[] = [
  { value: "both", label: "Nom et notes", hint: "le nom de l'accord (10:m), avec ses notes Prisma dessous (10 1 5)" },
  { value: "name", label: "Nom", hint: "le nom de l'accord : 10:m, 8/12" },
  { value: "notes", label: "Notes", hint: "les notes Prisma empilées, la basse en bas : 10 1 5" },
  {
    value: "grid",
    label: "Nom et grille",
    hint: "le nom de l'accord, avec sa grille pour la guitare : celle écrite (10:m=x02210), sinon la plus simple",
  },
];

export const CHORD_NAMES: Option<RenderOptions["chordNames"]>[] = [
  { value: "prisma", label: "Prisma", hint: "la fondamentale en nombre, puis la sorte d'accord : 10:m, 8:7, 8/12" },
  { value: "english", label: "Anglais", hint: "le nom anglais, lu par les accompagnateurs : Am, G7, G/B" },
];

export const SCORE_NAMES: Option<RenderOptions["scoreNames"]>[] = [
  { value: "prisma", label: "Prisma", hint: "la tonalité en Prisma (8, 5:m) ; chaque corde, son seul numéro" },
  {
    value: "latin",
    label: "Do ré mi",
    hint: "la tonalité par son nom (sol majeur, mi mineur), et la note à vide de chaque corde (mi, la)",
  },
  { value: "english", label: "C D E", hint: "la tonalité en notation anglaise (G, Em), et la note à vide de chaque corde (E, A)" },
];

export const NOTE_NAMES: Option<RenderOptions["noteNames"]>[] = [
  { value: "latin", label: "Do ré mi", hint: "dans la barre de statut de l'éditeur ; le do central est do3" },
  { value: "english", label: "C D E", hint: "dans la barre de statut de l'éditeur, en notation anglaise ; le do central est C4" },
  {
    value: "keyboard",
    label: "Clavier",
    hint: "un petit clavier, la note (ou l'accord) marquée sur ses touches ; le choix de la note d'une case se fait sur un clavier",
  },
  { value: "none", label: "Aucun", hint: "le numéro Prisma suffit : ni nom ni clavier" },
];

export const SOURCE_COLORS: Option<RenderOptions["sourceColors"]>[] = [
  {
    value: "octaves",
    label: "Signes et octaves",
    hint: "les signes en couleur, et chaque ligne de notes sur le fond de son couloir d'octave, comme sur la partition",
  },
  { value: "signs", label: "Signes", hint: "les barres, les traits, les nuances, les doigtés… en couleur, sur un fond blanc" },
  { value: "none", label: "Aucune", hint: "un texte sobre, d'une seule couleur" },
];

export const SECTIONS: Option<RenderOptions["sections"]>[] = [
  { value: "newLine", label: "À la ligne", hint: "chaque section commence une nouvelle ligne, comme les couplets d'une chanson" },
  {
    value: "inline",
    label: "À la suite",
    hint: "une section suit la précédente sur la même ligne, séparée par un blanc : la partition est plus courte",
  },
];

export const SIMILE: Option<RenderOptions["simile"]>[] = [
  { value: "pedals", label: "Pédales", hint: "les pédales qu'il demande, dessinées comme les autres ; le fichier garde la mention" },
  { value: "faded", label: "Pédales atténuées", hint: "les mêmes, en gris clair, pour alléger la page" },
  { value: "text", label: "Mention seule", hint: "« Ped. simile », sans les pédales qu'il demande" },
];

export const COLORS: Option<LaneColors>[] = [
  { value: "none", label: "Blanc et gris", hint: "des bandes alternées, sans couleur" },
  { value: "rainbow", label: "Arc-en-ciel", hint: "une couleur fixe par octave (ou par corde), du violet (grave) au rose (aigu)" },
  {
    value: "rainbowMixed",
    label: "Arc-en-ciel mélangé",
    hint: "les mêmes couleurs dans un ordre mélangé : deux couloirs voisins contrastent davantage",
  },
  { value: "muted", label: "Feutré", hint: "des teintes douces et discrètes, dans l'ordre" },
  { value: "mutedMixed", label: "Feutré mélangé", hint: "les teintes feutrées dans un ordre mélangé" },
];

export const OCTAVE_SYMBOLS: Option<RenderOptions["octaveStyle"]>[] = [
  { value: "triangle", label: "Triangles", hint: "▲1  0  ▼1" },
  { value: "arrow", label: "Flèches", hint: "↑1  0  ↓1" },
  { value: "sign", label: "Signes", hint: "+1  0  −1" },
];

export const OCTAVE_POSITIONS: Option<RenderOptions["octavePosition"]>[] = [
  { value: "top", label: "En haut", hint: "le numéro en face de la première ligne de son octave" },
  { value: "center", label: "Au centre", hint: "le numéro au milieu de son octave" },
];

export const NOTE_POSITIONS: Option<RenderOptions["notePosition"]>[] = [
  { value: "top", label: "En haut", hint: "les notes en haut de leur couloir d'octave" },
  { value: "center", label: "Centrées", hint: "chaque groupe de notes centré dans son couloir" },
  { value: "aligned", label: "Alignées", hint: "une note rejouée garde sa ligne, pour la suivre des yeux" },
  {
    value: "pitch",
    label: "Une ligne par note",
    hint: "alignées, et deux notes d'une même mesure sur deux lignes, l'aiguë au-dessus : le dessin des arpèges et de la mélodie",
  },
];

export const RULER_DETAILS: Option<RenderOptions["rulerDetail"]>[] = [
  { value: "written", label: "Telle qu'écrite", hint: "les cases écrites dans le texte, sans plus" },
  {
    value: "division",
    label: "Premier découpage",
    hint: "chaque temps coupé au moins en 2 (en 3 s'il est ternaire), même sans attaque : 1 * 2 *",
  },
  {
    value: "subdivision",
    label: "Second découpage",
    hint: "chaque temps coupé au moins en 4 (en 6 s'il est ternaire), même sans attaque : 1 . * . 2 . * . ; la partition s'allonge",
  },
];

export const DENSITIES: Option<RenderOptions["density"]>[] = [
  { value: "normal", label: "Normal", hint: "des cases larges, plus lisibles" },
  { value: "compact", label: "Compact", hint: "des cases serrées, pour les partitions chargées" },
];

export const CLICK_LEVELS: { value: ClickLevel; label: string; hint: string }[] = [
  { value: "downbeat", label: "Premier temps", hint: "le 1 de la mesure" },
  { value: "beat", label: "Temps", hint: "1, 2, 3…" },
  { value: "division", label: "Division", hint: "le temps en 2 (ou en 3) : *" },
  { value: "subdivision", label: "Subdivision", hint: "chaque division en 2 : ." },
];

const labelOf = <T extends string>(list: { value: T; label: string }[], value: T) =>
  list.find((option) => option.value === value)?.label ?? value;

/** Le nom, en clair, de la valeur d'une option du rendu (pour dire celle de l'autre portée). */
export const DESCRIBE: Record<PieceKey, (renderOptions: RenderOptions) => string> = {
  chords: (renderOptions) => labelOf(CHORDS, renderOptions.chords),
  chordNames: (renderOptions) => labelOf(CHORD_NAMES, renderOptions.chordNames),
  scoreNames: (renderOptions) => labelOf(SCORE_NAMES, renderOptions.scoreNames),
  chordChart: (renderOptions) => (renderOptions.chordChart ? "récapitulées en tête" : "sur la partition seulement"),
  namesEverySystem: (renderOptions) => (renderOptions.namesEverySystem ? "à chaque système" : "au premier système"),
  sections: (renderOptions) => labelOf(SECTIONS, renderOptions.sections),
  simile: (renderOptions) => labelOf(SIMILE, renderOptions.simile),
  octavePosition: (renderOptions) => labelOf(OCTAVE_POSITIONS, renderOptions.octavePosition),
  octaveStyle: (renderOptions) => labelOf(OCTAVE_SYMBOLS, renderOptions.octaveStyle),
  laneColors: (renderOptions) => labelOf(COLORS, renderOptions.laneColors),
  density: (renderOptions) => labelOf(DENSITIES, renderOptions.density),
  rulerDetail: (renderOptions) => labelOf(RULER_DETAILS, renderOptions.rulerDetail),
  notePosition: (renderOptions) => labelOf(NOTE_POSITIONS, renderOptions.notePosition),
  holdReminders: (renderOptions) => (renderOptions.holdReminders ? "rappelée" : "trait seul"),
  fingerings: (renderOptions) => (renderOptions.fingerings ? "affichés" : "masqués"),
};
