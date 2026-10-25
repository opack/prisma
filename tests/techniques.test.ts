import { describe, expect, it } from "vitest";
import { exportMusicXml, importMusicXml, parsePrisma, settleSlides, writePrisma } from "../src/core/index.ts";
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
      { midi: 69, slide: "up" },
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

  it("lisent les glissés : vers la note suivante, vers rien, depuis rien, dans les deux sens", () => {
    const s = parsePrisma(piece(["9\\", "7//", "\\\\5", "//3\\\\"]));
    expect(s.notes.map((n) => [n.midi - 64, n.slide, n.slideOut, n.slideIn])).toEqual([
      [9, "down", undefined, undefined],
      [7, undefined, "up", undefined],
      [5, undefined, undefined, "down"],
      [3, undefined, "down", "up"],
    ]);
    const text = writePrisma(s);
    expect(text).toContain("|9\\ |7// |\\\\5 |//3\\\\ ||");
    expect(writePrisma(parsePrisma(text))).toBe(text);
  });

  it("refusent un glissé vers la note suivante qui ne la trouve pas, ou dans l'autre sens", () => {
    const err = (cells: string[]) => {
      try {
        parsePrisma(piece(cells));
        return "";
      } catch (e) {
        return (e as Error).message;
      }
    };
    expect(err(["7/", "", "9", ""])).toContain("« 7// »");
    expect(err(["7/", "", "", ""])).toContain("« 7// »");
    expect(err(["7/", "5", "", ""])).toContain("« 7\\ » glisse vers elle");
    expect(err(["7/", "7", "", ""])).toContain("la même");
    expect(err(["7/", "-", "9", ""])).toBe("");
  });

  it("font entendre les glissés d'entrée et de sortie, sans attaque après la première", () => {
    const s = parsePrisma(piece(["//7", "", "7\\\\", ""]));
    const played = playedNotes(s, passages(s));
    // l'entrée : trois cases d'en dessous, la première attaquée, puis la note sans attaque
    expect(played.slice(0, 4).map((n) => n.midi - 64)).toEqual([4, 5, 6, 7]);
    expect(played[1].velocity).toBeLessThan(played[0].velocity);
    expect(played[3].velocity).toBeLessThan(played[0].velocity);
    // la sortie : la note attaquée, puis cinq cases vers le grave
    expect(played.slice(4).map((n) => n.midi - 64)).toEqual([7, 6, 5, 4, 3, 2]);
    expect(played[4].velocity).toBeGreaterThan(played[5].velocity);
  });

  it("passent par MusicXML : le glissé vers la note suivante, la chute, la montée, l'arrivée d'en dessous et d'au-dessus", () => {
    const text = writePrisma(parsePrisma(piece(["//5/", "7\\\\", "\\\\9//", "3"])));
    const xml = exportMusicXml(parsePrisma(text));
    for (const tag of ["<scoop ", "<falloff ", "<plop ", "<doit ", '<slide type="start"']) expect(xml).toContain(tag);
    expect(writePrisma(importMusicXml(xml)).replace(/^key: .*\n/m, "")).toBe(text);
  });

  it("rendus justes après un import ou une conversion : le sens de la note suivante, sinon un glissé de sortie", () => {
    const n = (midi: number, start: number, end: number, slide?: "up" | "down") => ({ staff: 0, string: 1, midi, start, end, ...(slide ? { slide } : {}) });
    const [a, , c, , e] = settleSlides([n(69, 0, T, "up"), n(67, T, 2 * T), n(67, 2 * T, 3 * T, "up"), n(70, 3.5 * T, 4 * T), n(70, 4 * T, 5 * T, "down")]);
    expect([a.slide, a.slideOut]).toEqual(["down", undefined]);
    expect([c.slide, c.slideOut]).toEqual([undefined, "up"]);
    expect([e.slide, e.slideOut]).toEqual([undefined, "down"]);
  });

  it("passent par MusicXML et reviennent telles quelles", () => {
    const text = writePrisma(parsePrisma(piece(["x", "<12>", "5/", "8"], ["@   d       u       P.M.---------------", "@                   (-------)   ~~~~~~~"])));
    const xml = exportMusicXml(parsePrisma(text));
    for (const tag of ["<notehead>x</notehead>", "<harmonic><natural/></harmonic>", '<slide type="start"', '<hammer-on type="start" number="1">H</hammer-on>', "<down-bow/>", "<up-bow/>", "<words>P.M.</words>", '<wavy-line type="start"']) expect(xml).toContain(tag);
    expect(writePrisma(importMusicXml(xml)).replace(/^key: .*\n/m, "")).toBe(text);
  });
});
