import { describe, expect, it } from "vitest";
import { importMusicXml, parsePrisma, TICKS_PER_BEAT, writePrisma } from "../index.ts";
import { C4, musicXml, QUARTER } from "../../../tests/support/musicxml.ts";

describe("paroles", () => {
  const piece = [
    "m1 |1  |2   |3  |4  ||1  |2   |3  |4  ||",
    "+1 |   |    |   |1  ||   |    |   |   ||",
    "0  |8  |10  |12 |   ||12 |10  |8  |-  ||",
    "@l  A-  men -------   A-  men -------",
    "@l  oh  la   la  di",
    "---",
    "-1 |1  |-   |-  |-  ||8  |-   |-  |-  ||",
    "",
  ].join("\n");

  it("lit une syllabe par case, le trait d'union, la prolongation et les couplets", () => {
    const score = parsePrisma(piece);
    expect(score.lyrics.filter((lyric) => lyric.verse === 1)).toEqual([
      { staff: 0, verse: 1, t: 0, text: "A", hyphen: true },
      { staff: 0, verse: 1, t: TICKS_PER_BEAT, text: "men", extend: 4 * TICKS_PER_BEAT },
      { staff: 0, verse: 1, t: 4 * TICKS_PER_BEAT, text: "A", hyphen: true },
      { staff: 0, verse: 1, t: 5 * TICKS_PER_BEAT, text: "men", extend: 8 * TICKS_PER_BEAT },
    ]);
    expect(score.lyrics.filter((l) => l.verse === 2).map((l) => l.text)).toEqual(["oh", "la", "la", "di"]);
  });

  it("réécrit les paroles telles quelles", () => {
    const written = writePrisma(parsePrisma(piece)).split("\n");
    for (const line of piece.split("\n").slice(0, 7).filter((x) => x !== "---")) expect(written).toContain(line);
  });

  it("prolonge une syllabe d'un système au suivant", () => {
    const s = parsePrisma(piece);
    const text = writePrisma(s, { width: 26 });
    expect(text.match(/^@l  A-  men -------$/gm)).toHaveLength(2);
    expect(parsePrisma(text).lyrics).toEqual(s.lyrics);
    // une syllabe tenue jusque dans le système suivant y reprend par « --- » en tête
    const long = parsePrisma(["m1 |1  |2  ||1  |2  ||", "0  |1  |3  ||5  |-  ||", "@l  oh ------------", "---", "-1 |   |   ||   |   ||", ""].join("\n"));
    expect(long.lyrics).toEqual([{ staff: 0, verse: 1, t: 0, text: "oh", extend: 4 * TICKS_PER_BEAT }]);
    const split = writePrisma(long, { width: 14 });
    expect(split).toMatch(/^@l  ---/m);
    expect(parsePrisma(split).lyrics).toEqual(long.lyrics);
    // syllabe sur la dernière case d'un système, prolongée au suivant
    const late = parsePrisma(["m1 |1  |2  ||1  |2  ||", "0  |1  |3  ||5  |-  ||", "@l      oh --------", "---", "-1 |   |   ||   |   ||", ""].join("\n"));
    expect(late.lyrics).toEqual([{ staff: 0, verse: 1, t: TICKS_PER_BEAT, text: "oh", extend: 4 * TICKS_PER_BEAT }]);
    expect(parsePrisma(writePrisma(late, { width: 14 })).lyrics).toEqual(late.lyrics);
  });

  it("veut les octaves d'une portée de l'aigu au grave, chacune numérotée une fois", () => {
    expect(() => parsePrisma(["m1 |1  ||", "-1 |1  ||", "+1 |5  ||", ""].join("\n"))).toThrow(/ligne 3, col. 1 : octave « \+1 » sous l'octave « -1 »/);
    expect(() => parsePrisma(["m1 |1  ||", "0  |1  ||", "0  |5  ||", ""].join("\n"))).toThrow(/octave « 0 » écrite deux fois/);
    expect(() => parsePrisma(["m1 |1  ||", "+1 |1  ||", "───┼───┼┼", "+1 |5  ||", ""].join("\n"))).not.toThrow();
  });

  it("refuse une note écrite après la dernière barre", () => {
    expect(() => parsePrisma(["m1 |1  |2  ||", "0  |1  |3  ||5", ""].join("\n"))).toThrow(/ligne 2, col. 14 : rien ne s'écrit après la dernière barre/);
    expect(() => parsePrisma(["m1 |1  |2  ||", "0  |1  |3  ||   ", ""].join("\n"))).not.toThrow();
  });

  it("refuse des paroles mal placées", () => {
    const one = (line: string) => ["m1 |1  |2  |3  ||", "0  |1  |3  |5  ||", line, "---", "-1 |   |   |   ||", ""].join("\n");
    expect(() => parsePrisma(one("@l   la"))).toThrow(/exactement sur une case/);
    expect(() => parsePrisma(one("@l  ---"))).toThrow(/écrivez d'abord la syllabe/);
    expect(() => parsePrisma(one("@l  la- --"))).toThrow(/ne se prolonge pas/);
    expect(() => parsePrisma(one("@l  la -"))).toThrow(/dépasser la case/);
    expect(() => parsePrisma(["@l  la", "m1 |1  ||", "0  |1  ||", "---", ""].join("\n"))).toThrow(/sous les lignes de leur portée/);
  });

  it("importe les paroles du MusicXML : syllabes, couplets, mélismes", () => {
    const ly = (n: number, syllabic: string, text: string, extend = false) =>
      `<lyric number="${n}"><syllabic>${syllabic}</syllabic><text>${text}</text>${extend ? "<extend/>" : ""}</lyric>`;
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4], duration: QUARTER, lyric: ly(1, "begin", "A") + ly(2, "single", "Oh !") },
            { midi: [C4 + 2], duration: QUARTER, lyric: ly(1, "end", "men", true) + ly(2, "single", "la") },
            { midi: [C4 + 4], duration: QUARTER },
            { midi: [C4 + 5], duration: QUARTER, tie: ["start"] },
          ],
        ],
      },
      { notes: [[{ midi: [C4 + 5], duration: QUARTER, tie: ["stop"] }, { midi: [C4], duration: 3 * QUARTER, lyric: ly(1, "single", "oui") }]] },
    ]);
    const s = importMusicXml(xml);
    expect(s.lyrics).toEqual([
      { staff: 0, verse: 1, t: 0, text: "A", hyphen: true },
      { staff: 0, verse: 2, t: 0, text: "Oh\u00A0!" },
      { staff: 0, verse: 1, t: TICKS_PER_BEAT, text: "men", extend: 5 * TICKS_PER_BEAT },
      { staff: 0, verse: 2, t: TICKS_PER_BEAT, text: "la" },
      { staff: 0, verse: 1, t: 5 * TICKS_PER_BEAT, text: "oui" },
    ]);
    expect(parsePrisma(writePrisma(s)).lyrics).toEqual(s.lyrics);
  });
});
