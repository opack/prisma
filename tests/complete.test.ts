import { describe, expect, it } from "vitest";
import { caseAt, extendRuler, noteLine, octaveRoom, rulerSuffixes, soundingAt, systemOf, writeCase, writeChord } from "../src/app/complete.ts";
import { parsePrisma } from "../src/core/index.ts";

const sys = [
  "@   p      <---",
  "m1 |1  *  |2  ||",
  "───┼──────┼───┼┼",
  "0  |1     |3  ||",
  "@   cresc.     ",
  "───┼──────┼───┼┼",
  "-1 |8  -  |-  ||",
];
const apply = (lines: string[], r: ReturnType<typeof writeCase>) => lines.map((l, k) => r.lines.get(k) ?? l);

describe("écrire dans un système", () => {
  it("trouve le système et la case du curseur", () => {
    expect(systemOf(sys, 3)).toEqual({ first: 0, last: 6, ruler: 1 });
    expect(caseAt(sys[1], 4)).toEqual({ start: 4, end: 7, bar: false });
    expect(caseAt(sys[1], 8)).toEqual({ start: 7, end: 10, bar: true });
  });

  it("écrit dans les espaces d'une case qui a la place", () => {
    const r = writeCase(sys, systemOf(sys, 3)!, 3, caseAt(sys[1], 8)!, "5");
    expect([...r.lines.keys()]).toEqual([3]);
    expect(r.lines.get(3)).toBe("0  |1  5  |3  ||");
    expect(r.caret).toEqual({ line: 3, col: 8 });
  });

  it("élargit la case sur tout le système quand elle est trop étroite", () => {
    const out = apply(sys, writeCase(sys, systemOf(sys, 3)!, 3, caseAt(sys[1], 4)!, "12_3"));
    expect(out).toEqual([
      "@   p        <---",
      "m1 |1    *  |2  ||",
      "───┼────────┼───┼┼",
      "0  |12_3    |3  ||",
      "@   cresc.",
      "───┼────────┼───┼┼",
      "-1 |8    -  |-  ||",
    ]);
    expect(() => parsePrisma(out.join("\n"))).not.toThrow();
  });

  it("allonge un soufflet coupé par l'élargissement", () => {
    const s = ["m1 |1  |2  |3  ||", "0  |1  |   |   ||", "@   <-------"];
    const out = apply(s, writeCase(s, systemOf(s, 1)!, 1, caseAt(s[0], 8)!, "5~7"));
    expect(out[2]).toBe("@   <--------");
    expect(out[0]).toBe("m1 |1  |2   |3  ||");
  });

  it("prolonge une ligne de notes courte avec les barres de la règle", () => {
    const s = ["m1 |1  |2  |3  ||", "0  |1"];
    expect(writeCase(s, systemOf(s, 1)!, 1, caseAt(s[0], 12)!, "8").lines.get(1)).toBe("0  |1  |   |8");
  });

  it("prolonge la règle, ses traits et ses lignes de notes", () => {
    const s = ["m1 |1  |2  |", "───┼───┼───┼", "0  |1  |3  |", "@   p"];
    expect(rulerSuffixes(s[0], 3).map((x) => x.text)).toEqual(["3  |", "3  *  |", "3  *  *  |", "|"]);
    const out = apply(s, extendRuler(s, systemOf(s, 0)!, "3  ||".slice(0, 4)));
    expect(out).toEqual(["m1 |1  |2  |3  |", "───┼───┼───┼───┼", "0  |1  |3  |   |", "@   p"]);
    const end = apply(s, extendRuler(s, systemOf(s, 0)!, "|"));
    expect(end.slice(0, 3)).toEqual(["m1 |1  |2  ||", "───┼───┼───┼┼", "0  |1  |3  ||"]);
    expect(rulerSuffixes("m1 |1  |2  ||", 3)[0].text).toBe("1  |");
  });

  it("ouvre une ligne de notes avec les barres de la règle", () => {
    expect(noteLine("m12|1  *  |2  ||", "+1")).toBe("+1 |      |   ||");
    expect(systemOf(["m1 |1  ||", "0  |1  ||", ""], 2)?.ruler).toBe(0);
  });

  it("ne coupe jamais un texte de plusieurs mots d'une ligne @", () => {
    const s = [
      "@   Andante très expressif",
      "m1 |1   *  *  |2  |3  ||1  *  *  |2  ||",
      "───┼──────────┼───┼───┼┼─────────┼───┼┼",
      "+1 |       9  |-  |6  ||-  4  6  |4  ||",
      "0  |          |   |   ||   11    |11 ||",
      "@                       (----------)",
    ];
    const out = apply(s, writeCase(s, systemOf(s, 3)!, 3, caseAt(s[1], 11)!, "9_5"));
    expect(out[0]).toBe("@   Andante très expressif");
    expect(out[3]).toBe("+1 |       9_5 |-  |6  ||-  4  6  |4  ||");
    expect(out[5]).toBe("@                        (----------)");
    expect(() => parsePrisma(out.join("\n"))).not.toThrow();
  });

  it("n'offre que les octaves possibles pour une nouvelle ligne", () => {
    const s = ["m1 |1  ||", "───┼───┼┼", "+1 |1  ||", "", "-1 |5  ||", "───┼───┼┼", "-2 |1  ||", "", "@   p"];
    const sys = systemOf(s, 3)!;
    // entre +1 et -1 : la même octave, 0
    expect(octaveRoom(s, sys, 3)).toEqual({ same: true, octaves: [0] });
    // sous -2 : les octaves plus graves
    expect(octaveRoom(s, sys, 7)).toEqual({ same: true, octaves: [-3, -4] });
    // sous une ligne @ : aucune
    expect(octaveRoom([...s, ""], sys, 9).octaves).toEqual([]);
    // au-dessus d'une ligne sans numéro : seulement la même octave
    const t = ["m1 |1  ||", "0  |1  ||", "", "   |3  ||"];
    expect(octaveRoom(t, systemOf(t, 2)!, 2)).toEqual({ same: true, octaves: [] });
  });
});

describe("l'accord qui sonne dans une colonne", () => {
  const lines = ["@c", "m1 |1  |2  |3  |4  ||", "0  |8  |-  |10 |-  ||", "   |5  |-  |6  |-  ||", "---", "-1 |1  |-  |-  |-  ||"];
  const at = (col: number) => soundingAt(lines, { ruler: 1, last: 5 }, col);
  it("prend sur chaque ligne la note de la case, ou celle que sa tenue prolonge, du grave à l'aigu", () => {
    expect(at(4)).toEqual([48, 64, 67]);
    expect(at(8)).toEqual([48, 64, 67]);
    expect(at(12)).toEqual([48, 65, 69]);
  });

  it("suit une tenue par-dessus la barre de mesure", () => {
    const over = ["@c", "m1 |1  |2  ||1  |2  ||", "0  |8  |5  ||-  |-  ||", "---", "-1 |1  |-  ||-  |-  ||"];
    expect(soundingAt(over, { ruler: 1, last: 4 }, 17)).toEqual([48, 64]);
  });
});

describe("écrire un accord sur la ligne @c", () => {
  const lines = ["@c  x02210  8", "m1 |1  |2  |3  |4  ||", "───┼─ Guitare ────┼┼", "1  |0  |   |   |   ||"];
  const text = (l: string[]) => `---\nparts: Guitare\n---\n\n${l.join("\n")}\n`;
  const sys = { first: 0, last: 3, ruler: 1 };

  it("élargit la case d'un accord trop long, comme celle d'une note ; les accords suivants gardent la leur", () => {
    const out = apply(lines, writeChord(lines, sys, 0, 4, 6, "10:m=x02210"));
    expect(out.slice(0, 2)).toEqual(["@c  10:m=x02210      8", "m1 |1           |2  |3  |4  ||"]);
    expect(parsePrisma(text(out)).chords.map((c) => [c.t / 2880, c.text])).toEqual([[0, "10:m=x02210"], [2, "8"]]);
    // le dernier accord de la ligne aussi
    const last = apply(lines, writeChord(lines, sys, 0, 12, 1, "8=320003"));
    expect(last.slice(0, 2)).toEqual(["@c  x02210  8=320003", "m1 |1  |2  |3        |4  ||"]);
  });

  it("n'élargit rien quand l'accord tient dans sa case", () => {
    const r = writeChord(lines, sys, 0, 4, 6, "Am");
    expect([...r.lines.keys()]).toEqual([0]);
    expect(r.lines.get(0)).toBe("@c  Am      8");
  });
});
