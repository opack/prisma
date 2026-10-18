import { describe, expect, it } from "vitest";
import { TICKS_PER_BEAT as T, octaveOf, parsePrisma } from "../src/core/index.ts";
import { locate, textPlace } from "../src/core/locate.ts";

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
const at = (p?: { line: number; column: number }) => p && lines[p.line - 1].slice(p.column - 1, p.column + 2).trim();

describe("de la partition au texte", () => {
  it("retrouve chaque note dans le texte", () => {
    for (const n of parsePrisma(text).notes) {
      const p = locate(text, { t: n.start, staff: n.staff, octave: octaveOf(n.midi), content: String((n.midi % 12) + 1) });
      expect(at(p)).toMatch(new RegExp(`^(\\d+')*${(n.midi % 12) + 1}`));
    }
  });

  it("une tenue, une case vide, une portée sans octave donnée", () => {
    expect(locate(text, { t: T / 2, staff: 0, octave: 5, content: "-" })).toEqual({ line: 7, column: 8 });
    expect(locate(text, { t: T / 2, staff: 1, octave: 3, content: "-" })).toEqual({ line: 10, column: 8 });
    expect(locate(text, { t: 2 * T, staff: 0, octave: 4, content: "" })).toEqual({ line: 15, column: 5 });
    expect(locate(text, { t: 3 * T, staff: 1 })).toEqual({ line: 17, column: 9 });
    expect(locate(text, { t: 9 * T, staff: 0 })).toBeUndefined();
    // un couloir que le système du texte n'a pas : la ligne de l'octave la plus proche
    expect(locate(text, { t: 2 * T, staff: 0, octave: 6, content: "" })).toEqual({ line: 15, column: 5 });
    expect(locate(text, { t: 0, staff: 1, octave: 1, content: "" })).toEqual({ line: 10, column: 5 });
  });

  it("et du texte à la partition : chaque note retrouve son instant, sa portée et son octave", () => {
    for (const n of parsePrisma(text).notes) {
      const p = locate(text, { t: n.start, staff: n.staff, octave: octaveOf(n.midi), content: String((n.midi % 12) + 1) })!;
      expect(textPlace(text, p.line, p.column)).toMatchObject({ t: n.start, staff: n.staff, octave: octaveOf(n.midi) });
    }
    // la règle : tout le système ; une ligne @ : sa portée
    expect(textPlace(text, 5, 12)).toEqual({ t: T, staff: -1 });
    expect(textPlace(text, 11, 5)).toEqual({ t: 0, staff: 1 });
    expect(textPlace(text, 2, 1)).toBeUndefined();
  });
});
