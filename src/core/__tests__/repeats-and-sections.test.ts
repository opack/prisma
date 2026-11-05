import { describe, expect, it } from "vitest";
import { importMusicXml, layout, parsePrisma, writePrisma } from "../index.ts";
import { musicXml, QUARTER } from "../../../tests/support/musicxml.ts";
import { roundTrip } from "../../../tests/support/round-trip.ts";

describe("reprises", () => {
  const n = (p: number) => ({ notes: [[{ midi: [p], duration: 4 * QUARTER }]] });

  it("écrit ||: :|| et :||: sur la règle et sur chaque ligne de notes", () => {
    const xml = musicXml([
      n(60),
      { ...n(62), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward"/>` },
      { ...n(64), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward"/>` },
      n(65),
    ]);
    const score = importMusicXml(xml);
    expect(score.repeats).toEqual([
      { barIndex: 1, start: true, end: true },
      { barIndex: 2, start: true, end: true },
    ]);
    expect(score.markers).toEqual([]); // reprises simples : pas de section
    const { text } = roundTrip(score);
    const ruler = text.split("\n").find((line) => line.startsWith("m1"))!;
    expect(ruler).toMatch(/\|\|:1 .*:\|\|:1 .*:\|\|1 /);
    const row = text.split("\n").find((l) => l.startsWith("0 "))!;
    expect(row.replace(/[^|:]/g, "")).toBe(ruler.replace(/[^|:]/g, ""));
  });

  it("met « ||: » en tête du système suivant quand la reprise commence après un saut de ligne", () => {
    const xml = musicXml([n(60), n(62), { ...n(64), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward"/>` }]);
    const { text } = roundTrip(importMusicXml(xml), 30);
    expect(text).toMatch(/^m3 \|\|:1 /m);
  });

  it("note le nombre de passages « 3× »", () => {
    const xml = musicXml([{ ...n(60), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward" times="3"/>` }]);
    const score = importMusicXml(xml);
    expect(score.repeats[0].times).toBe(3);
    const { text } = roundTrip(score);
    expect(text).toContain("3×");
  });

  it("lit une reprise écrite à la main, sans les deux points sur les lignes de notes", () => {
    const s = parsePrisma("m1 ||:1  |2  :||1  |2  ||\n0  ||:1  |-   ||5  |   ||\n---\n-1 || 1  |    ||1  |   ||\n");
    expect(s.repeats).toEqual([{ barIndex: 0, start: true, end: true }]);
  });

  it("marque la dernière barre du morceau comme barre de fin", () => {
    const s = parsePrisma("m1 |1  ||1  ||1  ||1  ||\n0  |1  ||1  ||1  ||1  ||\n---\n");
    const sys = layout(s, { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 })[0];
    const bars = sys.columns.filter((column) => column.kind === "barSep");
    expect(bars.map((c) => !!(c as { final?: boolean }).final)).toEqual([false, false, false, true]);
  });

  it("garde les textes de la ligne @", () => {
    const s = parsePrisma("@   rit.     a tempo\nm1 |1  |2  ||1  ||\n0  |1  |   ||1  ||\n---\n");
    expect(s.texts.map((textMark) => textMark.text)).toEqual(["rit.", "a tempo"]);
    expect(writePrisma(s)).toMatch(/^@ +rit\. +a tempo$/m);
  });

  it("refuse une indication qui ne commence pas sur une case", () => {
    expect(() => parsePrisma("@     rit.\nm1 |1  |2  ||\n0  |1  |   ||\n---\n")).toThrow(/doit commencer exactement sur une case/);
  });

  it("refuse « 3× » hors d'une fin de reprise", () => {
    expect(() => parsePrisma("@   3×\nm1 |1  ||\n0  |1  ||\n---\n")).toThrow(/:\|\|/);
  });
});

describe("sections", () => {
  const ruler = "m1 |1  ||1  ||1  ||1  ||";
  const bar = [...ruler.matchAll(/\|\|/g)].map((match) => match.index!);
  const at = (...signs: [number, string][]) => {
    let line = "@";
    for (const [col, text] of signs) line = line.padEnd(col) + text;
    return line;
  };
  const piece = (order: string, top: string, r = ruler, notes = "0  |1  ||1  ||1  ||1  ||") =>
    `${order ? `---\norder: ${order}\n---\n` : ""}${top}\n${r}\n${notes}\n---\n`;

  it("lit les sections et l'ordre de jeu", () => {
    const score = parsePrisma(piece("A B A", at([3, "[A]"], [bar[1] + 1, "[B]"])));
    expect(score.markers).toEqual([{ label: "A", barIndex: 0 }, { label: "B", barIndex: 2 }]);
    expect(score.order).toEqual(["A", "B", "A"]);
    expect(score.meta.order).toBeUndefined();
  });

  it("commence chaque section sur un nouveau système, et ferme la précédente d'une double barre", () => {
    const s = parsePrisma(piece("A B A", at([3, "[A]"], [bar[1] + 1, "[B]"])));
    const systems = layout(s, { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 });
    expect(systems.map((x) => x.section)).toEqual(["A", "B"]);
    expect(systems.map((x) => x.endsSection)).toEqual([true, false]);
    const bars = systems[0].columns.filter((column) => column.kind === "barSep") as { section?: boolean }[];
    expect(bars.map((c) => !!c.section)).toEqual([false, true]);
    // à l'écriture aussi : la section B ouvre le second système
    expect(writePrisma(s)).toMatch(/\n\n@  \[B\]\nm3 \|/);
  });

  it("à la suite : une section suit la précédente sur la même ligne, séparée par un blanc", () => {
    const s = parsePrisma(piece("A B A", at([3, "[A]"], [bar[1] + 1, "[B]"])));
    const metrics = { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 };
    const [one, ...rest] = layout(s, { ...metrics, sectionSep: 4 });
    expect(rest).toEqual([]);
    expect(one.section).toBe("A");
    const bars = one.columns.filter((c) => c.kind === "barSep") as { section?: boolean; spaced?: boolean }[];
    expect(bars.map((c) => [!!c.section, !!c.spaced])).toEqual([[false, false], [true, true], [false, false], [false, false]]);
    // la lettre de B contre la barre qui l'ouvre ; 4 de plus que la ligne ordinaire
    const opening = one.columns.findIndex((c) => c.kind === "barSep" && c.spaced);
    expect(one.marks.filter((mark) => mark.kind === "marker").map((m) => [m.label, m.column])).toEqual([["A", -1], ["B", opening]]);
    const plain = layout(parsePrisma(piece("", "", ruler)), metrics)[0];
    expect(one.width - plain.width).toBe(4);
  });

  it("refuse un ordre de jeu qui nomme une section absente", () => {
    expect(() => parsePrisma(piece("A C", at([3, "[A]"], [bar[1] + 1, "[B]"])))).toThrow(/aucune section « \[C\] »/);
  });

  it("refuse une section que l'ordre de jeu ne joue jamais", () => {
    expect(() => parsePrisma(piece("A A", at([3, "[A]"], [bar[1] + 1, "[B]"])))).toThrow(/section « \[B\] » n'est jamais jouée/);
    expect(() => parsePrisma(piece("", at([3, "[A]"], [bar[1] + 1, "[B]"])))).not.toThrow();
  });

  it("refuse un morceau qui commence avant sa première section", () => {
    expect(() => parsePrisma(piece("B", at([bar[1] + 1, "[B]"])))).toThrow(/première mesure/);
  });

  it("refuse une reprise à cheval sur deux sections", () => {
    const r = "m1 ||:1  ||1  ||1  :||1  ||";
    const b = [...r.matchAll(/\|\|/g)].map((match) => match.index!);
    const notes = "0  ||:1  ||1  ||1  :||1  ||";
    expect(() => parsePrisma(piece("A B", at([4, "[A]"], [b[1] + 1, "[B]"]), r, notes))).toThrow(/reprise passe le début de la section « \[B\] »/);
  });
});
