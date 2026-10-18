import { describe, expect, it } from "vitest";
import { caseAt, extendRuler, noteLine, rulerSuffixes, systemOf, writeCase } from "../src/app/complete.ts";
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
});
