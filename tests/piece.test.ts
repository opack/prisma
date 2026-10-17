import { describe, expect, it } from "vitest";
import { isEmpty, parseSettings, settingsName, writeSettings } from "../src/app/piece.ts";

describe("réglages d'un morceau", () => {
  it("se rangent à côté du morceau, du même nom suivi de .json", () => {
    expect(settingsName("gymnopedie.prisma")).toBe("gymnopedie.prisma.json");
  });

  it("gardent une option égale à la générale : le rendu suit la partition d'un ordinateur à l'autre", () => {
    expect(parseSettings(writeSettings({ options: { density: "normal" } }))).toEqual({ options: { density: "normal" } });
  });

  it("se relisent tels qu'écrits", () => {
    const s = { tempo: 72, muted: [1], options: { density: "compact" as const, fingerings: false } };
    expect(parseSettings(writeSettings(s))).toEqual(s);
    expect(JSON.parse(writeSettings(s))).toEqual({ format: 1, ...s });
  });

  it("laissent de côté ce qu'ils ne comprennent pas, et appliquent le reste", () => {
    const text = JSON.stringify({ format: 1, tempo: 999, muted: [2, -1, "x", 2, 0], options: { density: "énorme", sections: "inline", octaveStyle: "sign", metronome: true, inconnue: 1 } });
    // tempo hors limites, partie négative, valeur inconnue, option qui n'est pas du rendu : écartés
    expect(parseSettings(text)).toEqual({ muted: [0, 2], options: { sections: "inline", octaveStyle: "sign" } });
  });

  it("refusent une autre version du format, en le disant", () => {
    expect(() => parseSettings(JSON.stringify({ format: 2 }))).toThrow(/version 2/);
    expect(() => parseSettings("pas du json")).toThrow();
  });

  it("vides, ne demandent pas de fichier", () => {
    expect(isEmpty({})).toBe(true);
    expect(isEmpty({ muted: [], options: {} })).toBe(true);
    expect(isEmpty({ tempo: 60 })).toBe(false);
  });
});
