import { describe, expect, it } from "vitest";
import { velocities } from "../dynamics.ts";
import { parsePrisma, TICKS_PER_BEAT as T } from "../../../core/index.ts";
import type { Score } from "../../../core/index.ts";

describe("écoute : nuances", () => {
  /** Un morceau d'une note par temps, sur une portée (ou deux, la seconde sans indication). */
  const piece = (n: number, more: Partial<Score> = {}, staves = 1): Score => ({
    ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
    parts: [{ staves }],
    notes: Array.from({ length: n * staves }, (_, i) => ({ staff: i % staves, midi: 60, start: Math.floor(i / staves) * T, end: (Math.floor(i / staves) + 1) * T })),
    ...more,
  });
  const dyn = (t: number, text: string, staff = 0) => ({ staff, t: t * T, text, kind: "dynamic" as const });

  it("joue chaque nuance à son intensité, mf par défaut", () => {
    expect(velocities(piece(3, { expressions: [dyn(1, "p"), dyn(2, "(ff)")] }))).toEqual([70, 42, 100]);
  });

  it("accentue la seule note d'un sf, et attaque fort un fp avant de jouer piano", () => {
    expect(velocities(piece(3, { expressions: [dyn(0, "p"), dyn(1, "sf")] }))).toEqual([42, 100, 42]);
    expect(velocities(piece(2, { expressions: [dyn(0, "fp")] }))).toEqual([86, 42]);
  });

  it("mène un soufflet jusqu'à la nuance qui le suit, ou d'un pas sans elle", () => {
    const hairpins = [{ staff: 0, kind: "<" as const, start: 0, end: 4 * T }];
    expect(velocities(piece(5, { expressions: [dyn(0, "p"), dyn(4, "f")], hairpins }))).toEqual([42, 53, 64, 75, 86]);
    expect(velocities(piece(5, { expressions: [dyn(0, "p")], hairpins }))).toEqual([42, 46, 49, 53, 56]);
  });

  it("lit « cresc. » et « dim. » comme des soufflets jusqu'à la nuance suivante", () => {
    expect(velocities(piece(3, { expressions: [dyn(0, "f"), { staff: 0, t: 0, text: "dim.", kind: "text" }, dyn(2, "p")] }))).toEqual([86, 64, 42]);
  });

  it("applique une nuance à toute la partie, sauf à une portée qui a la sienne au même instant", () => {
    // pp écrit à droite vaut aussi pour la gauche, même si la gauche a ses propres indications ; le f
    // écrit à gauche vaut de même pour la droite
    expect(velocities(piece(3, { expressions: [dyn(1, "pp"), dyn(2, "f", 1)] }, 2))).toEqual([70, 70, 28, 28, 86, 86]);
    // mf à droite et p à gauche, écrits ensemble : chacune le sien
    expect(velocities(piece(1, { expressions: [dyn(0, "mf"), dyn(0, "p", 1)] }, 2))).toEqual([70, 42]);
  });
});
