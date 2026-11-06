import { describe, expect, it } from "vitest";
import { importMusicXml, layout, parsePrisma, writePrisma } from "../index.ts";
import { musicXml, QUARTER } from "../../../tests/support/musicxml.ts";
import { roundTrip } from "../../../tests/support/round-trip.ts";

describe("reprises", () => {
  const measure = (midi: number) => ({ notes: [[{ midi: [midi], duration: 4 * QUARTER }]] });

  it("écrit ||: :|| et :||: sur la règle et sur chaque ligne de notes", () => {
    const xml = musicXml([
      measure(60),
      { ...measure(62), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward"/>` },
      { ...measure(64), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward"/>` },
      measure(65),
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
    const row = text.split("\n").find((line) => line.startsWith("0 "))!;
    expect(row.replace(/[^|:]/g, "")).toBe(ruler.replace(/[^|:]/g, ""));
  });

  it("met « ||: » en tête du système suivant quand la reprise commence après un saut de ligne", () => {
    const xml = musicXml([
      measure(60),
      measure(62),
      { ...measure(64), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward"/>` },
    ]);
    const { text } = roundTrip(importMusicXml(xml), 30);
    expect(text).toMatch(/^m3 \|\|:1 /m);
  });

  it("note le nombre de passages « 3× »", () => {
    const xml = musicXml([{ ...measure(60), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward" times="3"/>` }]);
    const score = importMusicXml(xml);
    expect(score.repeats[0].times).toBe(3);
    const { text } = roundTrip(score);
    expect(text).toContain("3×");
  });

  it("lit une reprise écrite à la main, sans les deux points sur les lignes de notes", () => {
    const score = parsePrisma("m1 ||:1  |2  :||1  |2  ||\n0  ||:1  |-   ||5  |   ||\n---\n-1 || 1  |    ||1  |   ||\n");
    expect(score.repeats).toEqual([{ barIndex: 0, start: true, end: true }]);
  });

  it("marque la dernière barre du morceau comme barre de fin", () => {
    const score = parsePrisma("m1 |1  ||1  ||1  ||1  ||\n0  |1  ||1  ||1  ||1  ||\n---\n");
    const sys = layout(score, { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 })[0];
    const bars = sys.columns.filter((column) => column.kind === "barSep");
    expect(bars.map((column) => !!(column as { final?: boolean }).final)).toEqual([false, false, false, true]);
  });

  it("garde les textes de la ligne @", () => {
    const score = parsePrisma("@   rit.     a tempo\nm1 |1  |2  ||1  ||\n0  |1  |   ||1  ||\n---\n");
    expect(score.texts.map((textMark) => textMark.text)).toEqual(["rit.", "a tempo"]);
    expect(writePrisma(score)).toMatch(/^@ +rit\. +a tempo$/m);
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
  const piece = (order: string, top: string, rulerLine = ruler, notes = "0  |1  ||1  ||1  ||1  ||") =>
    `${order ? `---\norder: ${order}\n---\n` : ""}${top}\n${rulerLine}\n${notes}\n---\n`;

  it("lit les sections et l'ordre de jeu", () => {
    const score = parsePrisma(piece("A B A", at([3, "[A]"], [bar[1] + 1, "[B]"])));
    expect(score.markers).toEqual([
      { label: "A", barIndex: 0 },
      { label: "B", barIndex: 2 },
    ]);
    expect(score.order).toEqual(["A", "B", "A"]);
    expect(score.meta.order).toBeUndefined();
  });

  it("commence chaque section sur un nouveau système, et ferme la précédente d'une double barre", () => {
    const score = parsePrisma(piece("A B A", at([3, "[A]"], [bar[1] + 1, "[B]"])));
    const systems = layout(score, { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 });
    expect(systems.map((system) => system.section)).toEqual(["A", "B"]);
    expect(systems.map((system) => system.endsSection)).toEqual([true, false]);
    const bars = systems[0].columns.filter((column) => column.kind === "barSep") as { section?: boolean }[];
    expect(bars.map((column) => !!column.section)).toEqual([false, true]);
    // à l'écriture aussi : la section B ouvre le second système
    expect(writePrisma(score)).toMatch(/\n\n@  \[B\]\nm3 \|/);
  });

  it("à la suite : une section suit la précédente sur la même ligne, séparée par un blanc", () => {
    const score = parsePrisma(piece("A B A", at([3, "[A]"], [bar[1] + 1, "[B]"])));
    const metrics = { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 };
    const [one, ...rest] = layout(score, { ...metrics, sectionSep: 4 });
    expect(rest).toEqual([]);
    expect(one.section).toBe("A");
    const bars = one.columns.filter((column) => column.kind === "barSep") as { section?: boolean; spaced?: boolean }[];
    expect(bars.map((column) => [!!column.section, !!column.spaced])).toEqual([
      [false, false],
      [true, true],
      [false, false],
      [false, false],
    ]);
    // la lettre de B contre la barre qui l'ouvre ; 4 de plus que la ligne ordinaire
    const opening = one.columns.findIndex((column) => column.kind === "barSep" && column.spaced);
    expect(one.marks.filter((mark) => mark.kind === "marker").map((mark) => [mark.label, mark.column])).toEqual([
      ["A", -1],
      ["B", opening],
    ]);
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
    const rulerLine = "m1 ||:1  ||1  ||1  :||1  ||";
    const barlines = [...rulerLine.matchAll(/\|\|/g)].map((match) => match.index!);
    const notes = "0  ||:1  ||1  ||1  :||1  ||";
    expect(() => parsePrisma(piece("A B", at([4, "[A]"], [barlines[1] + 1, "[B]"]), rulerLine, notes))).toThrow(
      /reprise passe le début de la section « \[B\] »/,
    );
  });
});
