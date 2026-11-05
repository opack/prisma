import { describe, expect, it } from "vitest";
import { splitChord } from "../../app/score/engrave.ts";
import { chordName, chordNameNotes, chordNotes, chordPrismaName } from "../chords.ts";
import { importMusicXml, parsePrisma, TICKS_PER_BEAT, writePrisma } from "../index.ts";
import { C4, musicXml, QUARTER } from "../../../tests/support/musicxml.ts";
import { roundTrip } from "../../../tests/support/round-trip.ts";

describe("accords", () => {
  it("calcule les notes d'un accord nommé, de la basse vers l'aigu", () => {
    const n = (name: string) => chordNameNotes(name)?.join(",");
    expect(n("C")).toBe("1,5,8");
    expect(n("Am")).toBe("10,1,5");
    expect(n("Am7")).toBe("10,1,5,8");
    expect(n("G/B")).toBe("12,3,8");
    expect(n("F#m7b5")).toBe("7,10,1,5");
    expect(n("Bb")).toBe("11,3,6");
    expect(n("C6/9")).toBe("1,3,5,8,10");
    expect(n("Xm")).toBeUndefined();
    expect(n("Cfoo")).toBeUndefined();
  });

  it("reconnaît un accord à partir de ses notes, la basse décidant entre Am7 et C6", () => {
    expect(chordName([10, 1, 5])).toBe("Am");
    expect(chordName([10, 1, 5, 8])).toBe("Am7");
    expect(chordName([1, 5, 8, 10])).toBe("C6");
    expect(chordName([12, 3, 8])).toBe("G/B");
    expect(chordName([1, 2, 3])).toBeUndefined();
    expect(chordNotes("10,1,5")).toEqual([10, 1, 5]);
    expect(chordNotes("10,13")).toBeUndefined();
    expect(chordNotes("10;1;5")).toBeUndefined();
  });

  it("lit le nom Prisma d'un accord : la fondamentale, « : » et la sorte d'accord, « / » et la basse", () => {
    const n = (name: string) => chordNotes(name)?.join(",");
    expect(n("8")).toBe("8,12,3");
    expect(n("5:m")).toBe("5,8,12");
    expect(n("8:7")).toBe("8,12,3,6");
    expect(n("7:m7b5")).toBe("7,10,1,5");
    expect(n("1/8")).toBe("8,1,5");
    expect(n("1:7/5")).toBe("5,8,11,1");
    expect(n("1:6/9")).toBe("1,3,5,8,10");
    for (const bad of ["8:", "5m", "13", "1:xx", "0"]) expect(chordNotes(bad)).toBeUndefined();
    expect(chordPrismaName([10, 1, 5, 8])).toBe("10:m7");
    expect(chordPrismaName([12, 3, 8])).toBe("8/12");
    expect(chordPrismaName([1, 5, 8])).toBe("1");
  });

  const piece = (chords: string) => [chords, "m1      |1  |2  |3  |4  ||", "0       |1  |-  |5  |-  ||", "---", ""].join("\n");

  it("lit la ligne @c, en nom Prisma, en nom anglais ou en notes Prisma, et l'écrit au-dessus de la règle", () => {
    const score = parsePrisma(piece("@c       1       Am  10,1,5"));
    expect(score.chords).toEqual([{ t: 0, text: "1" }, { t: 2 * TICKS_PER_BEAT, text: "Am" }, { t: 3 * TICKS_PER_BEAT, text: "10,1,5" }]);
    const { text, back } = roundTrip(score);
    expect(back.chords).toEqual(score.chords);
    const lines = text.split("\n");
    expect(lines[lines.findIndex((line) => line.startsWith("m1")) - 1]).toMatch(/^@c +1 +Am +10,1,5$/);
  });

  it("grave le nom dans la notation choisie, Prisma par défaut", () => {
    expect(splitChord("Am").name).toBe("10:m");
    expect(splitChord("10,1,5").name).toBe("10:m");
    expect(splitChord("10:m", "english").name).toBe("Am");
    expect(splitChord("G/B", "english").name).toBe("G/B");
    expect(splitChord("10,1,5").notes).toEqual([10, 1, 5]);
  });

  it("tient dans la colonne de gauche la plus étroite", () => {
    const s = parsePrisma(piece("@c       Am"));
    expect(writePrisma(s)).toMatch(/^@c  Am$/m);
    expect(writePrisma(s)).toMatch(/^m1 \|1/m);
  });

  it("refuse un accord inconnu, mal placé ou sous les notes", () => {
    expect(() => parsePrisma(piece("@c       Hm"))).toThrow(/accord inconnu/);
    expect(() => parsePrisma(piece("@c        C"))).toThrow(/exactement sur une case/);
    expect(() => parsePrisma(["m1 |1  ||", "0  |1  ||", "@c  C", "---", ""].join("\n"))).toThrow(/au-dessus de la règle/);
  });

  it("importe les accords du MusicXML (<harmony>), basse comprise", () => {
    const harmony = (step: string, kind: string, extra = "") => `<harmony><root><root-step>${step}</root-step></root><kind>${kind}</kind>${extra}</harmony>`;
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4], duration: 2 * QUARTER, before: harmony("A", "minor-seventh") },
            { midi: [C4], duration: 2 * QUARTER, before: harmony("G", "major", "<bass><bass-step>B</bass-step></bass>") },
          ],
        ],
      },
    ]);
    expect(importMusicXml(xml).chords).toEqual([{ t: 0, text: "10:m7" }, { t: 2 * TICKS_PER_BEAT, text: "8/12" }]);
  });

  it("lit les lettres de nuance de la police musicale, et sépare une nuance en tête de texte", () => {
    const words = (word: string) => `<direction><direction-type><words>${word}</words></direction-type><staff>1</staff></direction>`;
    const xml = musicXml([{ notes: [[{ midi: [C4], duration: 2 * QUARTER, before: words("\ue520\ue520 con sordina") }, { midi: [C4], duration: 2 * QUARTER, before: words("mf dolce") }]] }]);
    expect(importMusicXml(xml).expressions.map((expression) => `${expression.kind}:${expression.text}`)).toEqual(["dynamic:pp", "text:con sordina", "dynamic:mf", "text:dolce"]);
  });

  it("importe les accords écrits en simple texte au-dessus de la portée", () => {
    const words = (word: string) => `<direction placement="above"><direction-type><words>${word}</words></direction-type><staff>1</staff></direction>`;
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4], duration: 2 * QUARTER, before: words("A7") + words("dolce") },
            { midi: [C4], duration: 2 * QUARTER, before: words(" E7 ") },
          ],
        ],
      },
    ]);
    const s = importMusicXml(xml);
    expect(s.chords).toEqual([{ t: 0, text: "10:7" }, { t: 2 * TICKS_PER_BEAT, text: "5:7" }]);
    expect(s.expressions.map((expression) => expression.text)).toEqual(["dolce"]);
  });
});
