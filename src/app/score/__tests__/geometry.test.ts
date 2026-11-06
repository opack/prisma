import { describe, expect, it } from "vitest";
import { TICKS_PER_BEAT, parsePrisma } from "../../../core/index.ts";
import { METRICS, engrave } from "../engrave.ts";
import { anchorAt, arpeggioPath, barsIn, columnAt, markWidth, nearestColumn, spacedWidths, systemBand, trillPath } from "../geometry.ts";

/** Deux mesures de deux temps, le premier temps coupé en deux cases : cinq cases en tout. */
const piece = ["m1 |1  *  |2  ||1  |2  ||", "0  |1  3  |5  ||8  |-  ||", ""].join("\n");
const placed = engrave(parsePrisma(piece))[0].systems[0];
const { anchors } = placed.sys;

describe("les cases d'un système", () => {
  it("range les cases par mesure, de gauche à droite", () => {
    expect(barsIn(placed)).toEqual([anchors.slice(0, 3), anchors.slice(3)]);
  });

  it("trouve la case qui sonne à un instant : la dernière commencée", () => {
    expect(anchorAt(placed, 0)).toBe(0);
    expect(anchorAt(placed, TICKS_PER_BEAT / 2)).toBe(1);
    // entre deux débuts de case, la case commencée sonne encore
    expect(anchorAt(placed, TICKS_PER_BEAT / 2 + 1)).toBe(1);
    expect(anchorAt(placed, 4 * TICKS_PER_BEAT - 1)).toBe(4);
    expect(columnAt(placed, TICKS_PER_BEAT)).toBe(anchors[2]);
  });

  it("trouve la case sous un clic, ou la plus proche entre deux cases", () => {
    const third = anchors[2];
    expect(nearestColumn(placed, placed.xs[third] + 0.1)).toBe(third);
    expect(nearestColumn(placed, 0)).toBe(anchors[0]);
    expect(nearestColumn(placed, 1000)).toBe(anchors[anchors.length - 1]);
  });

  it("donne la hauteur du curseur, de la règle au bas de la dernière portée", () => {
    const { top, bottom } = systemBand(placed);
    expect(top).toBe(placed.y + placed.rulerTop);
    expect(bottom).toBeGreaterThan(top);
  });
});

describe("les tracés", () => {
  it("ondule une trille d'un bout à l'autre, une demi-période par courbe", () => {
    const path = trillPath(10, 13.9, 5);
    expect(path.startsWith("M 10 5")).toBe(true);
    expect(path.match(/Q/g)).toHaveLength(6);
    expect(path.endsWith(" 13.9 5")).toBe(true);
  });

  it("ondule un arpège de haut en bas, avec sa flèche quand il descend", () => {
    const up = arpeggioPath(20, 0, 2.6, false);
    expect(up.match(/Q/g)).toHaveLength(4);
    expect(up).not.toContain("L");
    const down = arpeggioPath(20, 0, 2.6, true);
    // la même vaguelette, puis la flèche : sa pointe au bas de l'arpège
    expect(down.startsWith(up + " M ")).toBe(true);
    expect(down).toContain("L 20 2.6 L");
  });
});

describe("les largeurs", () => {
  it("estime une nuance plus large qu'un texte de même longueur", () => {
    expect(markWidth("mf", "dynamic")).toBeGreaterThan(markWidth("mf", "text"));
    expect(markWidth("", "text")).toBeCloseTo(0.9);
  });

  it("coupe la barre entre deux sections : la fin de l'une, un blanc, le début de l'autre", () => {
    const plain = spacedWidths({ kind: "barSep" }, 50, 10);
    expect(plain).toEqual({ close: METRICS.barSep, open: 0, gap: [50 + METRICS.barSep, 60] });
    const repeated = spacedWidths({ kind: "barSep", endRepeat: true, startRepeat: true }, 50, 10);
    expect(repeated.close).toBe(METRICS.barSep + METRICS.repeatDots);
    expect(repeated.open).toBe(METRICS.repeatDots + METRICS.beatSep);
    expect(repeated.gap).toEqual([50 + repeated.close, 60 - repeated.open]);
  });
});
