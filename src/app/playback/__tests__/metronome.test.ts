import { describe, expect, it } from "vitest";
import { clicks, countIn, passages } from "../performance.ts";
import { parsePrisma, TICKS_PER_BEAT as T } from "../../../core/index.ts";
import type { Score } from "../../../core/index.ts";

describe("écoute : métronome", () => {
  it("bat chaque temps du déroulé, le premier de la mesure marqué, levée comprise", () => {
    // une levée sur le temps 2, puis une mesure de 2 temps, reprise
    const s: Score = {
      ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
      beats: [
        { bar: "0", barIndex: 0, label: 2, division: 2 },
        { bar: "1", barIndex: 1, label: 1, division: 2 },
        { bar: "1", barIndex: 1, label: 2, division: 2 },
      ] as Score["beats"],
      repeats: [{ barIndex: 1, start: true, end: true }],
    };
    const beats = clicks(s, passages(s)).filter((c) => c.level === "beat" || c.level === "downbeat");
    expect(beats.map((c) => `${c.at / T}${c.level === "downbeat" ? "!" : ""}`).join(" ")).toBe("0 1! 2 3! 4");
  });

  it("divise chaque temps sur sa grille régulière, en 2 ou en 3, puis en deux", () => {
    const s: Score = {
      ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
      beats: [
        { bar: "1", barIndex: 0, label: 1, division: 2 },
        { bar: "1", barIndex: 0, label: 2, division: 3 },
      ] as Score["beats"],
    };
    const short = { downbeat: "1", beat: "T", division: "d", subdivision: "s" };
    expect(clicks(s, passages(s)).map((c) => `${short[c.level]}${+(c.at / T).toFixed(3)}`).join(" ")).toBe(
      "10 s0.25 d0.5 s0.75 T1 s1.167 d1.333 s1.5 d1.667 s1.833",
    );
  });

  it("bat les cases écrites, chacune à son niveau, pour faire entendre quand jouer", () => {
    // une noire, deux croches, quatre doubles croches
    const s = parsePrisma("m1 |1  |2  *  |3  .  *  .  ||\n0  |1  |3  5  |8  10 12 1  ||\n");
    const short = { downbeat: "1", beat: "T", division: "d", subdivision: "s" };
    expect(clicks(s, passages(s), "cells").map((c) => `${short[c.level]}${c.at / T}`).join(" ")).toBe("10 T1 d1.5 T2 s2.25 d2.5 s2.75");
  });

  it("bat les seules attaques, temps compris : ni les tenues, ni les cases d'un soufflet", () => {
    // la case « * » du premier temps n'existe que pour le soufflet ; le 3e temps n'est qu'une tenue
    const s = parsePrisma("m1 |1  *  |2  |3  ||\n0  |1  -  |3  |-  ||\n@      <----\n");
    const short = { downbeat: "1", beat: "T", division: "d", subdivision: "s" };
    const at = (grid: "cells" | "attacks") => clicks(s, passages(s), grid).map((c) => `${short[c.level]}${c.at / T}`).join(" ");
    expect(at("cells")).toBe("10 d0.5 T1 T2");
    expect(at("attacks")).toBe("10 T1");
  });
});

describe("écoute : décompte", () => {
  it("compte une mesure, puis les temps qui mènent à une levée", () => {
    // une levée sur le temps 4, puis une mesure de 4 temps
    const s: Score = {
      ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
      beats: [{ bar: "0", barIndex: 0, label: 4, division: 2 }, ...[1, 2, 3, 4].map((label) => ({ bar: "1", barIndex: 1, label, division: 2 }))] as Score["beats"],
    };
    const ps = passages(s);
    const short = (ls: string[]) => ls.map((l) => (l === "downbeat" ? "1" : "·")).join("");
    expect(short(countIn(s, ps, 0))).toBe("1···1··");
    expect(short(countIn(s, ps, T))).toBe("1···");
    expect(short(countIn(s, ps, 3 * T))).toBe("1···1·");
  });
});
