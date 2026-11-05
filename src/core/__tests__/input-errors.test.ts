import { describe, expect, it } from "vitest";
import { parsePrisma, TICKS_PER_BEAT as T, writePrisma } from "../index.ts";
import { notesKey } from "../../../tests/support/round-trip.ts";

describe("erreurs de saisie", () => {
  const base = (body: string) => `m1 |1  |2  ||\n───┼───┼───┼┼\n${body}`;
  const err = (txt: string) => {
    try {
      parsePrisma(txt);
    } catch (e) {
      return (e as Error).message;
    }
    return "aucune erreur";
  };

  it("accepte une seule portée, sans aucun trait", () => {
    const s = parsePrisma("m1 |1  |2  ||\n0  |1  |-  ||\n");
    expect(s.parts).toEqual([{ staves: 1 }]);
    expect(s.notes).toEqual([{ staff: 0, midi: 60, start: 0, end: 2 * T }]);
  });
  it("signale une étiquette de case inconnue", () => {
    expect(err("m1 |1  x  |2  ||\n───\n0  |1     |-  ||\n───")).toMatch(/ligne 1, col\. 8 : étiquette de case « x » inconnue/);
  });
  it("refuse un « - » en début de système", () => {
    expect(err(base("0  |-  |   ||\n───┼───┼───┼┼"))).toMatch(/ligne 3.*écrivez le numéro de la note/);
  });
  it("refuse un numéro hors de 1 à 12", () => {
    expect(err(base("0  |13 |   ||\n───┼───┼───┼┼"))).toMatch(/ligne 3, col\. 5 : case invalide « 13 »/);
  });
  it("demande l'octave sur la première ligne d'une portée", () => {
    expect(err(base("   |1  |   ||\n───┼───┼───┼┼"))).toMatch(/indiquer son octave/);
  });
  it("lit les octaves relatives au do central", () => {
    const s = parsePrisma("m1 |1  ||\n+1 |1  ||\n0  |1  ||\n---\n-1 |1  ||\n-2 |1  ||\n");
    expect(s.notes.map((n) => n.midi)).toEqual([72, 60, 48, 36]);
  });
  it("écrit les octaves relatives au do central", () => {
    const text = writePrisma(parsePrisma("m1 |1  ||\n+1 |1  ||\n---\n-1 |1  ||\n"));
    expect(text).toContain("+1 |1  ||");
    expect(text).toContain("-1 |1  ||");
  });
  it("refuse un numéro d'octave sans signe", () => {
    expect(err("m1 |1  ||\n4  |1  ||\n---\n")).toMatch(/octave invalide/);
  });
  it("refuse une octave mal écrite", () => {
    expect(err("m1 |1  ||\n+a |1  ||\n---\n")).toMatch(/octave invalide/);
  });
  it("lit et écrit le frontmatter en anglais", () => {
    const s = parsePrisma("---\ntitle: Essai\ncomposer: Moi\ncell: 3\n---\nm1 |1  ||\n0  |1  ||\n---\n");
    expect(s.meta).toMatchObject({ title: "Essai", composer: "Moi", cell: 3 });
    const text = writePrisma(s);
    expect(text).toContain("title: Essai");
    expect(text).toContain("composer: Moi");
  });
  it("accepte une saisie minimale à la main", () => {
    const s = parsePrisma("m1 |1  |2  ||\n0  |5  |-  ||\n---\n-1 |1  |   ||\n");
    expect(notesKey(s)).toBe(`0:64@0-${2 * T} 1:48@0-${T}`);
  });
});
