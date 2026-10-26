import { describe, expect, it } from "vitest";
import { engrave } from "../src/app/score/engrave.ts";
import { chordNotes, chordShape, exportMusicXml, importMusicXml, parsePrisma, parseShape, shapeNotes, shapeText, stringsOf, writePrisma } from "../src/core/index.ts";

const guitar = stringsOf("guitar", "standard", 0)!;
const shape = (chord: string, s = guitar) => shapeText(chordShape(chordNotes(chord)!, s)!);

/** Un morceau d'une partie de guitare, et sa ligne d'accords au-dessus de la règle. */
const piece = (chords: string, parts = "Guitare") => `---
parts: ${parts}
---

@c  ${chords}
m1 |1           |2           ||
───┼─ Guitare ──┼────────────┼┼
1  |0           |            ||
`;

describe("grilles d'accords", () => {
  it("lisent et écrivent la forme compacte, avec des traits quand une case a deux chiffres", () => {
    expect(parseShape("x02210")).toEqual([null, 0, 2, 2, 1, 0]);
    expect(parseShape("x-12-14-14-13-x")).toEqual([null, 12, 14, 14, 13, null]);
    expect(shapeText([null, 12, 14, 14, 13, null])).toBe("x-12-14-14-13-x");
    expect(shapeText([3, 2, 0, 0, 0, 3])).toBe("320003");
    expect(parseShape("x0221")).toHaveLength(5);
    expect(parseShape("x0a210")).toBeUndefined();
    expect(parseShape("x-25-0")).toBeUndefined();
  });

  it("choisissent la forme que connaît tout guitariste : accords ouverts, puis barrés", () => {
    const open = { C: "x32010", D: "xx0232", E: "022100", G: "320003", A: "x02220", Am: "x02210", Dm: "xx0231", Em: "022000", E7: "020100", A7: "x02020", D7: "xx0212", B7: "x21202", Cmaj7: "x32000" };
    for (const [chord, frets] of Object.entries(open)) expect([chord, shape(chord)]).toEqual([chord, frets]);
    expect(shape("F")).toBe("133211");
    expect(shape("B")).toBe("x24442");
    expect(shape("Ab")).toBe("466544");
    // la basse d'un renversement sur la corde la plus grave jouée
    expect(shape("G/B")).toBe("x20003");
    expect(shape("D/F#")).toBe("200232");
  });

  it("comptent depuis le capo, et suivent l'accordage", () => {
    // ré majeur, capo 2 : la forme de do
    expect(shape("D", stringsOf("guitar", "standard", 2)!)).toBe("x32010");
    // drop-d : le ré grave à vide
    expect(shape("D", stringsOf("guitar", "drop-d", 0)!)).toBe("000232");
  });

  it("disent les notes qu'elles jouent, de la basse vers l'aigu", () => {
    expect(shapeNotes([null, 0, 2, 2, 1, 0], guitar)).toEqual([10, 5, 1]);
    // au capo 2, la même forme joue si mineur
    expect(shapeNotes([null, 0, 2, 2, 1, 0], stringsOf("guitar", "standard", 2)!)).toEqual([12, 7, 3]);
  });

  it("s'accolent au nom de l'accord, et se relisent telles qu'écrites", () => {
    const s = parsePrisma(piece("10:m=x02210  8=320033"));
    expect(s.chords.map((c) => c.text)).toEqual(["10:m=x02210", "8=320033"]);
    expect(writePrisma(s)).toContain("@c  10:m=x02210  8=320033");
  });

  it("refusent une grille mal écrite, d'un autre nombre de cordes, ou qui joue une note hors de l'accord", () => {
    const err = (chords: string, parts?: string) => {
      try {
        parsePrisma(piece(chords, parts));
        return "";
      } catch (e) {
        return (e as Error).message;
      }
    };
    expect(err("10:m=x0z210")).toContain("une case par corde");
    expect(err("10:m=x0221")).toContain("5 cordes pour une guitare de 6");
    // x02220 : la majeur, son do♯ n'est pas dans la mineur
    expect(err("10:m=x02220")).toContain("elle joue le 2");
    // capo 2 : la forme de la mineur sonne si mineur
    expect(err("10:m=x02210", "Guitare (capo 2)")).toContain("capo 2 compris");
  });

  it("passent par MusicXML, dans le <frame> de l'accord", () => {
    const text = writePrisma(parsePrisma(piece("10:m=x02210  8=3-5-5-4-3-3")));
    const xml = exportMusicXml(parsePrisma(text));
    expect(xml).toContain("<frame><frame-strings>6</frame-strings><frame-frets>4</frame-frets><frame-note><string>5</string><fret>0</fret></frame-note>");
    expect(xml).toContain("<first-fret>3</first-fret>");
    const back = importMusicXml(xml);
    expect(back.chords.map((c) => c.text)).toEqual(["10:m=x02210", "8=355433"]);
  });

  it("se récapitulent en tête de partition, chaque accord une fois, dans l'ordre où il vient", () => {
    const text = `---
parts: Guitare
---

@c  10:m         8             10:m         8=355433
m1 |1           |2           ||1           |2           ||
───┼─ Guitare ──┼────────────┼┼────────────┼────────────┼┼
1  |0           |            ||0           |            ||
`;
    const [first, ...rest] = engrave(parsePrisma(text), { chords: "name", chordNames: "english", chart: true });
    // la même grille revient une fois ; une autre grille écrite pour le même accord compte à part
    expect(first.chart!.map((c) => [c.name, shapeText(c.shape)])).toEqual([["Am", "x02210"], ["G", "320003"], ["G", "355433"]]);
    expect(rest.every((p) => !p.chart)).toBe(true);
    expect(engrave(parsePrisma(text), { chords: "name" })[0].chart).toBeUndefined();
  });
});
