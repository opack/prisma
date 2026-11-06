import { describe, expect, it } from "vitest";
import { importMusicXml, parsePrisma, TICKS_PER_BEAT, writePrisma } from "../index.ts";
import { C4, musicXml, QUARTER } from "../../../tests/support/musicxml.ts";
import type { Score } from "../index.ts";

describe("pédale", () => {
  const pk = (score: Score) => score.pedals.map((pedal) => `${pedal.start / TICKS_PER_BEAT}-${pedal.end / TICKS_PER_BEAT}`).join(" ");
  /** Ligne @ avec chaque signe à sa colonne : évite de compter les espaces à la main. */
  const at = (...signs: [number, string][]) => {
    let line = "@";
    for (const [col, text] of signs) line = line.padEnd(col) + text;
    return line;
  };
  const ruler = "m1 |1  |2  |3  ||1  |2  |3  ||";
  const body = (pedal: string) => [ruler, "0  |1  |   |   ||3  |   |   ||", "---", "-1 |1  |-  |-  ||8  |-  |-  ||", pedal, ""].join("\n");

  it("lit Ped., *Ped. et * sous la main gauche", () => {
    const s = parsePrisma(body(at([4, "Ped."], [17, "*Ped."], [25, "*"])));
    expect(pk(s)).toBe("0-3 3-5");
  });

  it("écrit la pédale sur sa propre ligne, tout en bas, et la relit à l'identique", () => {
    const s = parsePrisma(body(at([4, "Ped."], [17, "*Ped."], [25, "*"])));
    const text = writePrisma(s);
    expect(text.trimEnd().split("\n").pop()).toMatch(/^@ +Ped\. +\*Ped\. +\*$/);
    expect(pk(parsePrisma(text))).toBe(pk(s));
  });

  it("tient la pédale d'un système au suivant sans la réécrire", () => {
    const bars = Array.from({ length: 8 }, () => "1  |2  |3  ||").join("");
    const notes = Array.from({ length: 8 }, () => "1  |   |   ||").join("");
    const s = parsePrisma(`m1 |${bars}\n---\n-1 |${notes}\n${at([4, "Ped."])}\n`);
    expect(pk(s)).toBe("0-24"); // jamais relâchée : jusqu'à la fin du morceau
    const text = writePrisma(s, { width: 40 });
    expect(text.match(/Ped\./g)?.length).toBe(1);
    expect(pk(parsePrisma(text))).toBe("0-24");
  });

  it("refuse les signes de pédale incohérents", () => {
    expect(() => parsePrisma(body(at([4, "*"])))).toThrow(/sans pédale enfoncée/);
    expect(() => parsePrisma(body(at([4, "Ped."], [12, "Ped."])))).toThrow(/déjà enfoncée/);
    const rh = [ruler, "0  |1  |   |   ||3  |   |   ||", at([4, "Ped."]), "---", "-1 |1  |   |   ||8  |   |   ||", ""].join("\n");
    expect(() => parsePrisma(rh)).toThrow(/sous la dernière portée de sa partie/);
  });

  it("importe la pédale du MusicXML", () => {
    const ped = (type: string) =>
      `<direction><direction-type><pedal type="${type}" line="yes"/></direction-type><staff>2</staff></direction>`;
    const xml = musicXml([
      {
        time: [3, 4],
        notes: [
          [{ midi: [C4], duration: 3 * QUARTER }],
          [
            { midi: [48], duration: QUARTER, staff: 2, before: ped("start") },
            { midi: [52], duration: QUARTER, staff: 2 },
            { midi: [55], duration: QUARTER, staff: 2, before: ped("change") },
          ],
        ],
      },
      { notes: [[{ midi: [C4], duration: 3 * QUARTER }], [{ midi: [48], duration: 3 * QUARTER, staff: 2, before: ped("stop") }]] },
    ]);
    const s = importMusicXml(xml);
    expect(pk(s)).toBe("0-2 2-3");
    expect(pk(parsePrisma(writePrisma(s)))).toBe("0-2 2-3");
  });
});

describe("consignes de pédale", () => {
  const ruler = "m1 |1  |2  |3  ||1  |2  |3  ||";
  const piece = (rh: string, lh: string) =>
    [ruler, "0  |1  |   |   ||3  |   |   ||", rh, "---", "-1 |1  |-  |-  ||8  |-  |-  ||", lh, ""].join("\n");

  it("lit « Ped. simile » comme une consigne de pédale, et l'écrit sur la ligne de pédale", () => {
    const score = parsePrisma(piece("", "@   Ped.         *   Ped. simile").replace("\n\n---", "\n---"));
    expect(score.pedalTexts).toEqual([{ staff: 1, t: 4 * TICKS_PER_BEAT, text: "Ped. simile" }]);
    expect(score.expressions).toEqual([]);
    const text = writePrisma(score);
    expect(text.trimEnd().split("\n").pop()).toMatch(/^@ +Ped\. +\* +Ped\. simile$/);
    expect(parsePrisma(text).pedalTexts).toEqual(score.pedalTexts);
  });

  it("refuse une consigne de pédale sous la main droite", () => {
    expect(() => parsePrisma(piece("@   Ped. simile", ""))).toThrow(/sous la dernière portée de sa partie/);
  });

  it("importe « Ped. simile » du MusicXML sur la ligne de pédale, même écrit sur la portée du haut", () => {
    const dir = `<direction><direction-type><words>Ped. simile</words></direction-type><staff>1</staff></direction>`;
    const s = importMusicXml(musicXml([{ notes: [[{ midi: [C4], duration: 4 * QUARTER, before: dir }]] }]));
    expect(s.pedalTexts).toEqual([{ staff: 1, t: 0, text: "Ped. simile" }]);
    expect(s.expressions).toEqual([]);
  });
});
