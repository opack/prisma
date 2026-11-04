import { describe, expect, it } from "vitest";
import { clampTempo, percentOf, sliderRange, stepTempo, tempoAt } from "../src/app/playback/tempo.ts";
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

  it("se règle au curseur du quart au double du tempo écrit, dans les bornes", () => {
    expect(sliderRange(120)).toEqual({ min: 30, max: 240 });
    expect(sliderRange(60)).toEqual({ min: MIN_TEMPO, max: 120 });
    expect(sliderRange(200)).toEqual({ min: 50, max: MAX_TEMPO });
    expect(clampTempo(19.4)).toBe(MIN_TEMPO);
  });
});
