import { describe, expect, it } from "vitest";
import { importMusicXml, parsePrisma, TICKS_PER_BEAT, writePrisma } from "../index.ts";

describe("portées et parties", () => {
  const song = [
    "---",
    "parts: Chant, Piano",
    "---",
    "m1 |1    |2  |3  |4   ||",
    "───┼─ Chant ─┼───┼────┼┼",
    "0  |8    |-  |10 |8   ||",
    "@l  Ah ---------  oui",
    "═══╪═ Piano ═╪═══╪════╪╪",
    "0  |5    |   |5  |    ||",
    "───┼─────┼───┼───┼────┼┼",
    "-1 |1    |-  |8  |-   ||",
    "@   Ped.          *",
    "",
  ].join("\n");
  const swap = (from: string, to: string) => song.replace(from, to);

  it("lit les portées de chaque partie, nommées sur leur trait", () => {
    const score = parsePrisma(song);
    expect(score.parts).toEqual([{ name: "Chant", staves: 1 }, { name: "Piano", staves: 2 }]);
    expect(score.meta.staves).toBeUndefined();
    expect(score.notes.filter((note) => note.start === 0).map((n) => n.staff)).toEqual([0, 1, 2]);
    expect(score.lyrics.map((lyric) => lyric.staff)).toEqual([0, 0]);
    expect(score.pedals).toEqual([{ staff: 2, start: 0, end: 3 * TICKS_PER_BEAT }]);
  });

  it("réécrit le texte tel quel", () => {
    expect(writePrisma(parsePrisma(song))).toBe("---\nformat: 1\n" + song.slice(4).replace("---\nm1", "---\n\nm1"));
  });

  it("lit le nom n'importe où sur son trait, entre des espaces", () => {
    expect(parsePrisma(swap("═══╪═ Piano ═╪═══╪════╪╪", "═══╪═════╪═══╪═  Piano  ═╪╪")).parts[1].name).toBe("Piano");
  });

  it("refuse un nom de partie non déclaré, déplacé ou manquant", () => {
    expect(() => parsePrisma(swap("═ Piano ═", "═ Pno. ══"))).toThrow(/« Pno\. » non déclaré/);
    expect(() => parsePrisma(swap("─ Chant ─", "─ Piano ─"))).toThrow(/à la place de « Chant »/);
    expect(() => parsePrisma(swap("───┼─ Chant ─┼", "───┼───────┼"))).toThrow(/il manque le nom de la partie « Chant »/);
    expect(() => parsePrisma(swap("parts: Chant, Piano\n", ""))).toThrow(/non déclarée : nommez les parties/);
    expect(() => parsePrisma(swap("parts: Chant, Piano", "parts: Chant, Piano, Flûte"))).toThrow(/il manque des parties/);
    expect(() => parsePrisma(swap("───┼─────┼───┼───┼────┼┼", "───┼─ Main ┼───┼───┼────┼┼"))).toThrow(/trait double/);
  });

  it("refuse un système qui n'a pas les mêmes portées que le premier", () => {
    const two = ["m1 |1  ||", "0  |1  ||", "───┼───┼┼", "0  |1  ||", "", "m2 |1  ||", "0  |1  ||", ""].join("\n");
    expect(() => parsePrisma(two)).toThrow(/pas les mêmes portées que le premier \(1 au lieu de 2\)/);
  });

  it("met la pédale sous la dernière portée d'une partie seulement", () => {
    expect(() => parsePrisma(swap("0  |5    |   |5  |    ||", "0  |5    |   |5  |    ||\n@   Ped."))).toThrow(/sous la dernière portée de sa partie/);
  });

  it("importe chaque <part> comme une partie, et chaque portée comme une portée", () => {
    const note = (step: string, octave: number, staff: number, extra = "") =>
      `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><staff>${staff}</staff>${extra}</note>`;
    const attributes = (staves: number) => `<attributes><divisions>1</divisions><staves>${staves}</staves><time><beats>4</beats><beat-type>4</beat-type></time></attributes>`;
    const twoStaves = `<?xml version="1.0"?><score-partwise version="3.1"><part-list>
      <score-part id="P1"><part-name>Chant</part-name></score-part><score-part id="P2"><part-name>Piano</part-name></score-part></part-list>
      <part id="P1"><measure number="1">${attributes(1)}${note("C", 5, 1, "<lyric><syllabic>single</syllabic><text>Ah</text></lyric>")}</measure></part>
      <part id="P2"><measure number="1">${attributes(2)}<direction><direction-type><pedal type="start"/></direction-type><staff>1</staff></direction>${note("E", 4, 1)}<backup><duration>4</duration></backup>${note("C", 3, 2)}</measure></part>
      </score-partwise>`;
    const s = importMusicXml(twoStaves);
    expect(s.parts).toEqual([{ name: "Chant", staves: 1 }, { name: "Piano", staves: 2 }]);
    expect(s.notes.map((n) => `${n.staff}:${n.midi}`)).toEqual(["0:72", "1:64", "2:48"]);
    expect(s.lyrics).toEqual([{ staff: 0, verse: 1, t: 0, text: "Ah" }]);
    expect(s.pedals).toEqual([{ staff: 2, start: 0, end: 4 * TICKS_PER_BEAT }]);
    expect(parsePrisma(writePrisma(s)).parts).toEqual(s.parts);
  });
});
