/**
 * Du texte aux pages : la partition lue (un .ymn, ou un MusicXML importé comme à l'ouverture),
 * puis gravée selon les options. Partagé par l'éditeur et par les aperçus de la bibliothèque.
 */
import { DEFAULT_WIDTH, importMusicXml, parseYmn, writeYmn } from "../core/index.ts";
import type { Score } from "../core/index.ts";
import { engrave } from "./engrave.ts";
import type { Page } from "./engrave.ts";
import { alignOf } from "./options.ts";
import type { RenderOptions } from "./options.ts";
import { withSimile } from "./pedal.ts";

/** Les options qui changent la gravure (les autres ne changent que le dessin des pages). */
export type EngraveOptions = Pick<RenderOptions, "density" | "fingerings" | "chords" | "notePosition" | "holdReminders" | "simile" | "sections">;
export const engraveOptions = (o: RenderOptions): EngraveOptions => ({
  density: o.density,
  fingerings: o.fingerings,
  chords: o.chords,
  notePosition: o.notePosition,
  holdReminders: o.holdReminders,
  simile: o.simile,
  sections: o.sections,
});

export function engravePages(score: Score, o: EngraveOptions): Page[] {
  // doigtés masqués : retirés avant la gravure, pour que les cases reprennent leur largeur
  const plain = o.fingerings ? score : { ...score, notes: score.notes.map(({ finger: _, ...n }) => n) };
  // « Ped. simile » : les pédales qu'il demande, gravées comme les autres ou atténuées, ou la mention seule
  return engrave(withSimile(plain, o.simile), { compact: o.density === "compact", chords: o.chords, align: alignOf(o.notePosition), reminders: o.holdReminders, inlineSections: o.sections === "inline" });
}

/** La partition d'un fichier : un .ymn lu, ou un MusicXML importé puis relu, comme à l'ouverture. */
export function scoreOf(text: string, kind: "ymn" | "musicxml", name: string): Score {
  return parseYmn(kind === "ymn" ? text : writeYmn(importMusicXml(text, name), { width: DEFAULT_WIDTH }));
}
