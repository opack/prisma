import { describe, expect, it } from "vitest";
import { TICKS_PER_BEAT, beatGrids, layout, parsePrisma } from "../index.ts";
import { isWrittenCase } from "../locate.ts";

const piece = (body: string[], division = 2) => ["---", "format: 1", ...(division === 3 ? ["division: 3"] : []), "---", "", ...body].join("\n");

// un temps tenu, un temps en deux, un triolet, un temps en quatre
const binary = piece(["m1 |1  |2  *  |3  *  *  |4  .  *  .  ||", "───┼───┼──────┼─────────┼────────────┼┼", "0  |1  |-  3  |5  6  8  |10 -  -  12 ||"]);
const labels = (text: string, detail?: "written" | "division" | "subdivision") => beatGrids(parsePrisma(text), detail).map((beatGrid) => beatGrid.labels.join(" "));

describe("la règle détaillée", () => {
  it("telle qu'écrite : les seules cases du texte", () => {
    expect(labels(binary)).toEqual(["1", "2 *", "3 * *", "4 . * ."]);
    expect(labels(binary, "written")).toEqual(labels(binary));
  });

  it("au premier découpage : chaque temps en 2, un triolet reste en 3", () => {
    expect(labels(binary, "division")).toEqual(["1 *", "2 *", "3 * *", "4 . * ."]);
  });

  it("au second découpage : chaque temps en 4, un triolet en 6, sans mélange de demis et de tiers", () => {
    expect(labels(binary, "subdivision")).toEqual(["1 . * .", "2 . * .", "3 . * . * .", "4 . * ."]);
  });

  it("dans un temps ternaire : en 3, puis en 6", () => {
    const ternary = piece(["m1 |1  |2  ||", "───┼───┼───┼┼", "0  |1  |-  ||"], 3);
    expect(labels(ternary, "division")).toEqual(["1 * *", "2 * *"]);
    expect(labels(ternary, "subdivision")).toEqual(["1 . * . * .", "2 . * . * ."]);
  });

  it("à la gravure, les cases ajoutées prolongent la note tenue", () => {
    const metrics = { width: 999, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 };
    const cells = (detail?: "written" | "division") => layout(parsePrisma(binary), { ...metrics, detail })[0].staves[0].rows[0].cells;
    expect(cells().slice(0, 3)).toEqual(["1", "-", "3"]);
    expect(cells("division").slice(0, 4)).toEqual(["1", "-", "-", "3"]);
  });

  it("une case ajoutée n'est pas dans le texte : rien ne s'y retouche", () => {
    expect(isWrittenCase(binary, 0)).toBe(true);
    expect(isWrittenCase(binary, TICKS_PER_BEAT / 2)).toBe(false);
    expect(isWrittenCase(binary, TICKS_PER_BEAT + TICKS_PER_BEAT / 2)).toBe(true);
    expect(isWrittenCase(binary, 2 * TICKS_PER_BEAT + TICKS_PER_BEAT / 3)).toBe(true);
    expect(isWrittenCase(binary, 2 * TICKS_PER_BEAT + TICKS_PER_BEAT / 2)).toBe(false);
    expect(isWrittenCase(binary, 99 * TICKS_PER_BEAT)).toBe(false);
  });
});
