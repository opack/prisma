import { describe, expect, it } from "vitest";
import { exportMusicXml, importMusicXml, parsePrisma, writePrisma } from "../src/core/index.ts";
import { passages, playedNotes } from "../src/app/performance.ts";

const T = 2880;
/** Une guitare : sur la corde 1, une note par temps ; dessous, des lignes @. */
const piece = (cells: string[], marks: string[] = []) => `---
parts: Guitare
---

m1 |1      |2      |3      |4      ||
───┼─ Guitare ─────┼───────┼───────┼┼
1  |${cells.map((c) => c.padEnd(7)).join("|")}||
${marks.join("\n")}
`;

describe("techniques des cordes", () => {
  it("lisent dans la case la note étouffée, l'harmonique, le glissé et le bend", () => {
    const s = parsePrisma(piece(["x", "<12>", "5/", "7b9r_3"]));
    expect(s.notes.map(({ staff: _, string: __, start: ___, end: ____, ...n }) => n)).toEqual([
      { midi: 64, dead: true },
      { midi: 76, harmonic: true },
      { midi: 69, slide: true },
      { midi: 71, bend: 73, release: true, finger: 3 },
    ]);
  });

  it("lisent sur la ligne @ le médiator, l'étouffé de la paume et le vibrato", () => {
    const s = parsePrisma(piece(["0", "1", "3", "5"], ["@   d       u       P.M.---", "@                           ~~~~~~~"]));
    expect(s.articulations.map((a) => [a.t / T, a.kind])).toEqual([[0, "down"], [1, "up"]]);
    expect(s.effects.map((e) => [e.kind, e.start / T, e.end / T])).toEqual([["palmMute", 2, 3], ["vibrato", 3, 4]]);
  });

  it("se réécrivent telles quelles", () => {
    const text = writePrisma(parsePrisma(piece(["x", "<12>", "5/", "7b9r"], ["@   d       u       P.M.---------------"])));
    expect(text).toContain("|x  |<12> |5/   |7b9r ||");
    expect(writePrisma(parsePrisma(text))).toBe(text);
  });

  it("refusent une harmonique hors des nœuds, un bend qui descend ou trop grand, une technique hors des cordes", () => {
    const err = (text: string) => {
      try {
        parsePrisma(text);
        return "";
      } catch (e) {
        return (e as Error).message;
      }
    };
    expect(err(piece(["<6>", "", "", ""]))).toContain("harmonique");
    expect(err(piece(["7b5", "", "", ""]))).toContain("bend");
    expect(err(piece(["7b12", "", "", ""]))).toContain("bend");
    expect(err(piece(["x", "-", "", ""]))).toContain("ne se tient pas");
    const piano = `m1 |1  |2  ||\n───┼───┼───┼┼\n0  |1  |   ||\n@   d\n`;
    expect(err(piano)).toContain("médiator");
    expect(err(piano.replace("@   d", "@   P.M.---"))).toContain("paume");
  });

  it("s'entendent : étouffée brève et sourde, harmonique plus haut, bend tiré puis relâché, legato sans attaque", () => {
    const s = parsePrisma(piece(["x", "<7>", "7b9r", "5"], ["@                   (---------)"]));
    const played = playedNotes(s, passages(s));
    expect(played[0]).toMatchObject({ midi: 64, filter: 700 });
    expect(played[0].end - played[0].start).toBeLessThan(T / 4);
    // l'harmonique à la case 7 : la quinte au-dessus de l'octave
    expect(played[1].midi).toBe(64 + 19);
    // le bend : la case 7, la 9, puis la 7 à nouveau, sans nouvelle attaque
    expect(played.slice(2, 5).map((n) => n.midi)).toEqual([71, 73, 71]);
    expect(played[3].velocity).toBeLessThan(played[2].velocity);
    // le pull-off de la 7 à la 5, sous la liaison
    expect(played[5].velocity).toBeLessThan(played[2].velocity);
  });

  it("passent par MusicXML et reviennent telles quelles", () => {
    const text = writePrisma(parsePrisma(piece(["x", "<12>", "5/", "8"], ["@   d       u       P.M.---------------", "@                   (-------)   ~~~~~~~"])));
    const xml = exportMusicXml(parsePrisma(text));
    for (const tag of ["<notehead>x</notehead>", "<harmonic><natural/></harmonic>", '<slide type="start"', '<hammer-on type="start" number="1">H</hammer-on>', "<down-bow/>", "<up-bow/>", "<words>P.M.</words>", '<wavy-line type="start"']) expect(xml).toContain(tag);
    expect(writePrisma(importMusicXml(xml)).replace(/^key: .*\n/m, "")).toBe(text);
  });
});
