import { describe, expect, it } from "vitest";
import { instrumentsOf, staffInstruments } from "../../app/playback/instruments.ts";
import { guessInstrument, importMusicXml, parsePrisma, writePrisma } from "../index.ts";

describe("instruments", () => {
  it("se devinent d'après le nom de la partie, en français ou en anglais", () => {
    const cases: [string | undefined, string][] = [
      [undefined, "piano"],
      ["Piano", "piano"],
      ["Piano électrique", "electric-piano"],
      ["Flûte", "flute"],
      ["Flute 1", "flute"],
      ["Violon II", "violin"],
      ["Violoncelle", "cello"],
      ["Contrebasse", "double-bass"],
      ["Basse électrique", "electric-bass"],
      ["Chant", "voice"],
      ["Soprano", "voice"],
      ["Alto", "voice"],
      ["Viola", "viola"],
      ["Saxophone alto", "saxophone"],
      ["Cor", "horn"],
      ["Cor anglais", "oboe"],
      ["Harpsichord", "harpsichord"],
      ["Ukulélé", "piano"],
    ];
    for (const [name, instrument] of cases) expect([name, guessInstrument(name)]).toEqual([name, instrument]);
  });

  it("donnent celui choisi pour le morceau, sinon celui de la partition, à chaque portée de la partie", () => {
    const parts = [
      { name: "Flûte", staves: 1 },
      { name: "Piano", staves: 2 },
      { name: "Chœur de droite", staves: 1, instrument: "flute" as const },
    ];
    expect(instrumentsOf(parts)).toEqual(["flute", "piano", "flute"]);
    expect(instrumentsOf(parts, [null, "harpsichord", "voice"])).toEqual(["flute", "harpsichord", "voice"]);
    expect(instrumentsOf(parts, ["inconnu"])).toEqual(["flute", "piano", "flute"]);
    expect(staffInstruments(parts, ["flute", "harpsichord"])).toEqual(["flute", "harpsichord", "harpsichord", "piano"]);
  });

  const choir = (parts: string) =>
    [
      "---",
      `parts: ${parts}`,
      "---",
      "m1 |1  |2  ||",
      "───┼─ Chœur de droite ─┼┼",
      "0  |8  |   ||",
      "═══╪═ Piano ═╪═══╪╪",
      "0  |1  |   ||",
      "",
    ].join("\n");

  it("s'écrivent entre parenthèses après le nom de la partie, et se relisent", () => {
    const score = parsePrisma(choir("Chœur de droite (flute), Piano"));
    expect(score.parts).toEqual([
      { name: "Chœur de droite", staves: 1, instrument: "flute" },
      { name: "Piano", staves: 1 },
    ]);
    expect(writePrisma(score)).toContain("parts: Chœur de droite (flute), Piano");
    expect(parsePrisma(writePrisma(score)).parts).toEqual(score.parts);
  });

  it("refusent un instrument inconnu, en donnant la liste", () => {
    expect(() => parsePrisma(choir("Chœur de droite (flûte), Piano"))).toThrow(
      /instrument « flûte » inconnu pour « Chœur de droite » ; les instruments : piano, electric-piano/,
    );
  });

  it("s'importent du MusicXML d'après le programme General MIDI, écrits seulement si le nom ne les fait pas deviner", () => {
    const part = (id: string, name: string, program: number) =>
      `<score-part id="${id}"><part-name>${name}</part-name><midi-instrument id="${id}-I1"><midi-program>${program}</midi-program></midi-instrument></score-part>`;
    const body = (id: string) =>
      `<part id="${id}"><measure number="1"><attributes><divisions>1</divisions><time><beats>2</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><type>half</type></note></measure></part>`;
    const xml = (parts: [string, string, number][]) =>
      `<?xml version="1.0"?><score-partwise version="3.1"><part-list>${parts.map(([id, n, p]) => part(id, n, p)).join("")}</part-list>${parts.map(([id]) => body(id)).join("")}</score-partwise>`;
    expect(
      importMusicXml(
        xml([
          ["P1", "Flute", 74],
          ["P2", "Voix de droite", 41],
        ]),
      ).parts,
    ).toEqual([
      { name: "Flute", staves: 1 },
      { name: "Voix de droite", staves: 1, instrument: "violin" },
    ]);
    // une seule partie : nommée pour porter son instrument, sauf le piano
    expect(importMusicXml(xml([["P1", "Flute", 74]])).parts).toEqual([{ name: "Flute", staves: 1 }]);
    expect(importMusicXml(xml([["P1", "Piano", 1]])).parts).toEqual([{ staves: 1 }]);
  });
});
