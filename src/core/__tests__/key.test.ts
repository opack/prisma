import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { guessKey, importMusicXml, keyName, keysOfSignature, parseKey, parsePrisma, prismaKey, writePrisma } from "../index.ts";
import { musicXml, q } from "../../../tests/support/musicxml.ts";

describe("tonalité", () => {
  const body = "m1 |1  |2  |3  |4  ||\n0  |1  |5  |8  |1  ||\n";
  const read = (key: string) => parsePrisma(`---\nkey: ${key}\n---\n${body}`);

  it.each([
    ["8", 8, false],
    ["5:m", 5, true],
    ["G", 8, false],
    ["Em", 5, true],
    ["F#m", 7, true],
    ["Bb", 11, false],
  ])("lit « %s »", (text, tonic, minor) => {
    expect(parseKey(text)).toMatchObject({ tonic, minor });
  });

  it("garde l'écriture choisie, sans guillemets", () => {
    expect(writePrisma(read("5:m"))).toMatch(/^key: 5:m$/m);
    expect(writePrisma(read("F#m"))).toMatch(/^key: F#m$/m);
  });

  it("refuse une tonalité qui ne s'écrit pas ainsi", () => {
    for (const k of ["13", "5m", "H", "sol"]) expect(() => read(k)).toThrow(/« key » est la tonalité du morceau/);
  });

  it("se nomme en latin ou en anglais, avec l'altération usuelle", () => {
    expect(keyName(parseKey("11")!, "latin")).toBe("si♭ majeur");
    expect(keyName(parseKey("2:m")!, "latin")).toBe("do♯ mineur");
    expect(keyName(parseKey("Gb")!, "latin")).toBe("sol♭ majeur");
    expect(keyName(parseKey("5:m")!, "english")).toBe("Em");
    expect(keyName(parseKey("8")!, "none")).toBe("");
  });

  it("s'importe de l'armure du MusicXML, majeure ou mineure selon les notes, en notation Prisma", () => {
    expect(keysOfSignature(2)).toEqual([
      { tonic: 3, minor: false },
      { tonic: 12, minor: true },
    ]);
    // une armure d'un dièse : sol majeur (sol si ré) ou mi mineur (mi sol si)
    const xml = (key: number, chord: number[]) => musicXml([{ key, notes: [[{ midi: chord, dur: 4 * q }]] }]);
    expect(importMusicXml(xml(1, [67, 71, 74])).meta.key).toBe("8");
    expect(importMusicXml(xml(1, [64, 67, 71])).meta.key).toBe("5:m");
    // sans altération à l'armure, la mineur plutôt que do majeur quand les notes le disent
    expect(importMusicXml(xml(0, [57, 60, 64])).meta.key).toBe("10:m");
  });

  it("se devine aux notes du morceau", () => {
    expect(guessKey(parsePrisma(body))).toEqual({ tonic: 1, minor: false });
    const gymnopedie = importMusicXml(readFileSync(new URL("../../../tests/fixtures/gymnopedie1.musicxml", import.meta.url), "utf8"));
    expect(prismaKey(guessKey(gymnopedie)!)).toBe("3");
  });
});
