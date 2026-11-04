import { describe, expect, it } from "vitest";
import { clampTempo, percentOf, stepPercent, stepTempo, tempoAt } from "../src/app/playback/tempo.ts";
import { MAX_TEMPO, MIN_TEMPO } from "../src/app/options/piece.ts";

describe("le tempo de l'écoute", () => {
  it("avance et recule d'un pas, sans sortir des bornes", () => {
    expect(stepTempo(72, 5)).toBe(77);
    expect(stepTempo(72, -5)).toBe(67);
    expect(stepTempo(MIN_TEMPO + 2, -5)).toBe(MIN_TEMPO);
    expect(stepTempo(MAX_TEMPO - 1, 5)).toBe(MAX_TEMPO);
  });

  it("se prend en part du tempo écrit, arrondie et bornée", () => {
    expect(tempoAt(120, 70)).toBe(84);
    expect(tempoAt(75, 50)).toBe(38); // 37,5 arrondi
    expect(tempoAt(30, 50)).toBe(MIN_TEMPO);
    expect(tempoAt(120, 100)).toBe(120);
  });

  it("dit sa part du tempo écrit", () => {
    expect(percentOf(84, 120)).toBe(70);
    expect(percentOf(77, 120)).toBe(64);
  });

  it("passe d'une dizaine de pour cent du tempo écrit à la suivante", () => {
    expect(stepPercent(100, 100, 1)).toBe(110);
    expect(stepPercent(100, 100, -1)).toBe(90);
    expect(stepPercent(64, 100, 1)).toBe(70);
    expect(stepPercent(64, 100, -1)).toBe(60);
    // 70 % de 75 : 52,5, arrondi à 53 ; −10 % ne revient pas sur 53, il va à 60 % (45)
    expect(stepPercent(53, 75, -1)).toBe(45);
    expect(stepPercent(53, 75, 1)).toBe(60);
  });

  it("reste aux bornes", () => {
    expect(stepPercent(MIN_TEMPO, 100, -1)).toBe(MIN_TEMPO);
    expect(stepPercent(MAX_TEMPO, 100, 1)).toBe(MAX_TEMPO);
    expect(clampTempo(19.4)).toBe(MIN_TEMPO);
  });
});
