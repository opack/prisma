/**
 * Du texte aux pages : la partition lue (un .prisma, ou un MusicXML importé comme à l'ouverture),
 * puis gravée selon les options. Partagé par l'éditeur et par les aperçus de la bibliothèque.
 */
import { DEFAULT_WIDTH, importMusicXml, parsePrisma, writePrisma } from "../../core/index.ts";
import type { Score } from "../../core/index.ts";
import { engrave } from "./engrave.ts";
import type { Page } from "./engrave.ts";
import { alignOf } from "../options/options.ts";
import type { RenderOptions } from "../options/options.ts";
import { withSimile } from "../playback/pedal.ts";

/** Les options qui changent la gravure (les autres ne changent que le dessin des pages). */
export type EngraveOptions = Pick<
  RenderOptions,
  | "density"
  | "fingerings"
  | "chords"
  | "chordNames"
  | "chordChart"
  | "notePosition"
  | "holdReminders"
  | "simile"
  | "sections"
  | "rulerDetail"
>;
export const engraveOptions = (renderOptions: RenderOptions): EngraveOptions => ({
  density: renderOptions.density,
  fingerings: renderOptions.fingerings,
  chords: renderOptions.chords,
  chordNames: renderOptions.chordNames,
  chordChart: renderOptions.chordChart,
  notePosition: renderOptions.notePosition,
  holdReminders: renderOptions.holdReminders,
  simile: renderOptions.simile,
  sections: renderOptions.sections,
  rulerDetail: renderOptions.rulerDetail,
});

export function engravePages(score: Score, options: EngraveOptions): Page[] {
  // doigtés masqués : retirés avant la gravure, pour que les cases reprennent leur largeur
  const plain = options.fingerings ? score : { ...score, notes: score.notes.map(({ finger: _, ...note }) => note) };
  // « Ped. simile » : les pédales qu'il demande, gravées comme les autres ou atténuées, ou la mention seule
  return engrave(withSimile(plain, options.simile), {
    compact: options.density === "compact",
    chords: options.chords,
    chordNames: options.chordNames,
    chart: options.chordChart,
    align: alignOf(options.notePosition),
    reminders: options.holdReminders,
    inlineSections: options.sections === "inline",
    detail: options.rulerDetail,
  });
}

/** La partition d'un fichier : un .prisma lu, ou un MusicXML importé puis relu, comme à l'ouverture. */
export function scoreOf(text: string, kind: "prisma" | "musicxml", name: string): Score {
  return parsePrisma(kind === "prisma" ? text : writePrisma(importMusicXml(text, name), { width: DEFAULT_WIDTH }));
}
