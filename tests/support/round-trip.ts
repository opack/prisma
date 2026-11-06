/** L'aller-retour d'une partition par le texte .prisma, et ce qu'on en compare. */
import { expect } from "vitest";
import { parsePrisma, writePrisma } from "../../src/core/index.ts";
import type { Score } from "../../src/core/index.ts";

/** Les notes, chacune en portée, hauteur, début et fin : deux partitions aux mêmes notes ont la même clé. */
export const notesKey = (score: Score) => score.notes.map((note) => `${note.staff}:${note.midi}@${note.start}-${note.end}`).join(" ");

/** Les temps, chacun en mesure et numéro. */
export const beatsKey = (score: Score) => score.beats.map((beat) => `${beat.bar}.${beat.label}`).join(" ");

/** L'aller-retour .prisma doit retrouver exactement les mêmes notes et les mêmes temps. */
export function roundTrip(score: Score, width = 96) {
  const text = writePrisma(score, { width });
  const back = parsePrisma(text);
  expect(notesKey(back)).toBe(notesKey(score));
  expect(beatsKey(back)).toBe(beatsKey(score));
  return { text, back };
}
