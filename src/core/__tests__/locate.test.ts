import { describe, expect, it } from "vitest";
import { TICKS_PER_BEAT, octaveOf, parsePrisma } from "../index.ts";
import { locate, textPlace } from "../locate.ts";

const text = [
  "---",
  "format: 1",
  "---",
  "",
  "m1 |1  *  |2  ||",
  "───┼──────┼───┼┼",
  "+1 |3'5-  |-  ||",
  "0  |8  10 |12 ||",
  "───┼──────┼───┼┼",
  "-1 |1  -  |-  ||",
  "@   p",
  "",
  "m2 |1  |2  ||",
  "───┼───┼───┼┼",
  "0  |   |5  ||",
  "───┼───┼───┼┼",
  "-1 |8  |   ||",
].join("\n");
const lines = text.split("\n");
const at = (place?: { line: number; column: number }) => place && lines[place.line - 1].slice(place.column - 1, place.column + 2).trim();

describe("de la partition au texte", () => {
  it("retrouve chaque note dans le texte", () => {
    for (const note of parsePrisma(text).notes) {
      const place = locate(text, { t: note.start, staff: note.staff, octave: octaveOf(note.midi), content: String((note.midi % 12) + 1) });
      expect(at(place)).toMatch(new RegExp(`^(\\d+')*${(note.midi % 12) + 1}`));
    }
  });

  it("une tenue, une case vide, une portée sans octave donnée", () => {
    expect(locate(text, { t: TICKS_PER_BEAT / 2, staff: 0, octave: 5, content: "-" })).toEqual({ line: 7, column: 8 });
    expect(locate(text, { t: TICKS_PER_BEAT / 2, staff: 1, octave: 3, content: "-" })).toEqual({ line: 10, column: 8 });
    expect(locate(text, { t: 2 * TICKS_PER_BEAT, staff: 0, octave: 4, content: "" })).toEqual({ line: 15, column: 5 });
    expect(locate(text, { t: 3 * TICKS_PER_BEAT, staff: 1 })).toEqual({ line: 17, column: 9 });
    expect(locate(text, { t: 9 * TICKS_PER_BEAT, staff: 0 })).toBeUndefined();
    // un couloir que le système du texte n'a pas : la ligne de l'octave la plus proche
    expect(locate(text, { t: 2 * TICKS_PER_BEAT, staff: 0, octave: 6, content: "" })).toEqual({ line: 15, column: 5 });
    expect(locate(text, { t: 0, staff: 1, octave: 1, content: "" })).toEqual({ line: 10, column: 5 });
  });

  it("et du texte à la partition : chaque note retrouve son instant, sa portée et son octave", () => {
    for (const note of parsePrisma(text).notes) {
      const place = locate(text, { t: note.start, staff: note.staff, octave: octaveOf(note.midi), content: String((note.midi % 12) + 1) })!;
      expect(textPlace(text, place.line, place.column)).toMatchObject({ t: note.start, staff: note.staff, octave: octaveOf(note.midi) });
    }
    // la règle : tout le système ; une ligne @ : sa portée
    expect(textPlace(text, 5, 12)).toEqual({ t: TICKS_PER_BEAT, staff: -1 });
    expect(textPlace(text, 11, 5)).toEqual({ t: 0, staff: 1 });
    expect(textPlace(text, 2, 1)).toBeUndefined();
  });
});
