import { describe, expect, it } from "vitest";
import { inspect } from "../inspect.ts";

describe("ce que montre le curseur", () => {
  const text = [
    "---",
    "parts: Chant, Piano",
    "bpm: 72",
    "---",
    "",
    "@  [A]          rit.",
    "m12|1  *  |2  |3  ||1      |2  |3  ||",
    "───┼─ Chant ┼───┼───┼┼───────┼───┼───┼┼",
    "0  |8  10 |-  |   ||12~1_3 |   |   ||",
    "@l  Ah --",
    "═══╪═ Piano ╪═══╪═══╪╪═══════╪═══╪═══╪╪",
    "+1 |3'5   |   |   ||       |   |   ||",
    "@   p      <---     !",
    "───┼──────┼───┼───┼┼───────┼───┼───┼┼",
    "-1 |1     |-  |   ||       |   |   ||",
    "@   Ped.                *",
    "",
  ].join("\n");
  const at = async (line: number, col: number, names: "latin" | "english" | "none" = "latin") => {
    const lines = text.split("\n");
    return inspect(text, lines.slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0) + col - 1, names);
  };

  it("nomme la clé de l'en-tête et lit sa valeur", async () => {
    expect((await at(3, 1)).symbol).toEqual({ text: "bpm", meaning: "tempo de départ : ici 72 temps par minute" });
    expect(inspect("---\ndivision: 3\n---\n", 5).symbol?.meaning).toBe("découpage par défaut d'un temps : ici ternaire, chaque temps en 3");
    expect(inspect("---\ntitle: X\n---\n", 5).symbol?.meaning).toBe("titre du morceau");
  });

  it("place le curseur dans la musique : section, mesure, temps, case, portée", async () => {
    const inspection = await at(9, 8);
    expect([inspection.line, inspection.column, inspection.section, inspection.bar, inspection.beat, inspection.cell, inspection.staff]).toEqual([9, 8, "A", "12", 1, { index: 2, count: 2 }, 0]);
    expect(inspection.parts).toEqual([{ name: "Chant", staves: 1 }, { name: "Piano", staves: 2 }]);
    expect(inspection.symbol).toEqual({ text: "10", meaning: "la3", keys: [10] });
    // sans noms : le numéro suffit
    expect((await at(9, 8, "none")).symbol?.meaning).toBe("note");
    expect((await at(9, 8, "english")).symbol?.meaning).toBe("A4");
    expect((await at(15, 5)).staff).toBe(2);
    expect((await at(9, 22)).bar).toBe("13");
  });

  it("traduit les notes : tenue, trille et doigté, petites notes, octave", async () => {
    expect((await at(9, 12)).symbol?.meaning).toBe("10 (la3) qui continue");
    expect((await at(9, 21)).symbol?.meaning).toBe("si3, en trille avec do4, doigt 3 (majeur)");
    expect((await at(12, 5)).symbol?.meaning).toBe("petite note : ré4, puis mi4");
    expect((await at(12, 1)).symbol?.meaning).toBe("octave +1 : de do4 à si4");
    expect((await at(9, 21, "none")).symbol).toMatchObject({ meaning: "note, en trille avec 1, doigt 3 (majeur)", keys: [12], trill: 1 });
    expect((await at(12, 5)).symbol).toMatchObject({ keys: [5], graces: [3] });
    expect((await at(9, 12, "none")).symbol).toMatchObject({ meaning: "10 qui continue", keys: [10] });
    expect((await at(12, 1, "none")).symbol?.meaning).toBe("octave +1");
  });

  it("traduit les indications, les barres et les traits", async () => {
    expect((await at(6, 4)).symbol?.meaning).toBe("début de la section A");
    expect((await at(6, 17)).symbol?.meaning).toBe("ritardando : en ralentissant");
    expect((await at(13, 5)).symbol?.meaning).toBe("piano : doux");
    expect((await at(13, 12)).symbol?.meaning).toBe("crescendo : de plus en plus fort");
    expect((await at(13, 21)).symbol?.meaning).toBe("accent : attaque plus forte");
    expect((await at(16, 5)).symbol?.meaning).toBe("enfoncer la pédale");
    expect((await at(7, 19)).symbol?.meaning).toBe("fin de mesure");
    expect((await at(11, 1)).symbol?.meaning).toBe("trait double : sépare deux parties ; il porte le nom de la partie « Piano »");
    expect((await at(10, 5)).symbol?.meaning).toBe("syllabe des paroles");
    const chords = "@c  Am  10,1,5  10:m\nm1 |1   |2   |3   ||\n0  |    |    |    ||\n";
    expect(inspect(chords, 4).symbol).toEqual({ text: "Am", meaning: "(10:m, 10,1,5) accord la do mi", keys: [10, 1, 5] });
    expect(inspect(chords, 8).symbol).toEqual({ text: "10,1,5", meaning: "(10:m, Am) accord la do mi", keys: [10, 1, 5] });
    expect(inspect(chords, 16).symbol).toEqual({ text: "10:m", meaning: "(Am, 10,1,5) accord la do mi", keys: [10, 1, 5] });
    expect(inspect(chords, 4, "none").symbol?.meaning).toBe("(10:m, 10,1,5) accord 10 1 5");
    expect(inspect("@c  8,3,4\nm1 |1   ||\n0  |    ||\n", 4).symbol?.meaning).toBe("accord sol ré ré♯");
  });
});
