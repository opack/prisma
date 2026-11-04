import { describe, expect, it } from "vitest";
import { clampTempo, stepTempo } from "../src/app/playback/tempo.ts";
import { MAX_TEMPO, MIN_TEMPO } from "../src/app/options/piece.ts";

describe("le tempo de l'écoute", () => {
  it("avance et recule d'un pas, sans sortir des bornes", () => {
    expect(stepTempo(72, 1)).toBe(73);
    expect(stepTempo(72, -5)).toBe(67);
    expect(stepTempo(MIN_TEMPO + 2, -5)).toBe(MIN_TEMPO);
    expect(stepTempo(MAX_TEMPO - 1, 5)).toBe(MAX_TEMPO);
  });

  it("reste entier et dans les bornes", () => {
    expect(clampTempo(19.4)).toBe(MIN_TEMPO);
    expect(clampTempo(72.6)).toBe(73);
  });
});
