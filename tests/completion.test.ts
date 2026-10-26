import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { CompletionContext } from "@codemirror/autocomplete";
import { completionSource } from "../src/app/completion.ts";
import { cases, systemOf, writeMark } from "../src/app/complete.ts";

const source = completionSource(() => "latin");
/** Les étiquettes proposées à la ligne L (à partir de 0), colonne C, sur Ctrl+Espace. */
const labels = (doc: string, L: number, C: number) => {
  const state = EditorState.create({ doc });
  const line = state.doc.line(L + 1);
  const r = source(new CompletionContext(state, Math.min(line.from + C, line.to), true));
  return r ? r.options.map((o) => o.label) : [];
};

const MARKS = `---
format: 1
parts: Piano, Guitare
---

@  [A]       
m1 |1  |2  |3  |4  ||
───┼─ Piano ───┼───┼┼
0  |1  |3  |5  |8  ||
@                   
═══╪═ Guitare ═╪═══╪╪
1  |0  |1  |3  |5  ||
@                   
`;

describe("complétion de la ligne @", () => {
  it("n'écrit pas sur une section posée sur la barre, faute de place dans la case", () => {
    expect(labels(MARKS, 5, 6)).toEqual([]);
  });

  it("propose au-dessus de la règle ce qui vaut pour le système", () => {
    const l = labels(MARKS, 5, 8);
    expect(l).toContain("[B]");
    expect(l).toContain("rit.");
    expect(l).not.toContain("mf");
  });

  it("propose sous une portée ses nuances, soufflets, articulations ; la pédale au piano, le médiator à la guitare", () => {
    const piano = labels(MARKS, 9, 8);
    const guitar = labels(MARKS, 12, 12);
    for (const l of ["mf", "<---", "(--)", "."]) {
      expect(piano).toContain(l);
      expect(guitar).toContain(l);
    }
    expect(piano).toContain("Ped.");
    expect(piano).not.toContain("d");
    expect(guitar).toEqual(expect.arrayContaining(["d", "u", "P.M.---", "~~~~"]));
    expect(guitar).not.toContain("Ped.");
  });
});

describe("ordre de la liste sur une ligne @", () => {
  it("après un soufflet, propose d'abord le soufflet inverse", () => {
    const doc = MARKS.replace("0  |1  |3  |5  |8  ||\n@                   ", "0  |1  |3  |5  |8  ||\n@   <---            ");
    expect(labels(doc, 9, 12)[0]).toBe(">---");
    expect(labels(doc.replace("<---", ">---"), 9, 12)[0]).toBe("<---");
  });
  it("sur une portée à cordes, propose d'abord ses signes et l'arpège, puis les nuances", () => {
    const l = labels(MARKS, 12, 12);
    expect(l.slice(0, 6)).toEqual(["d", "u", "P.M.---", "~~~~", "/", "\\"]);
    expect(labels(MARKS, 9, 8)[0]).toBe("p");
  });
});

describe("écriture d'une indication sur une ligne @", () => {
  const lines = MARKS.split("\n");
  const sys = systemOf(lines, 9)!;
  const at = (k: number) => cases(lines[sys.ruler])[k].start;
  const written = (r: ReturnType<typeof writeMark>) => r.lines.get(9);
  it("écrit un mot au début de sa case, et un signe qui dure jusqu'à la case suivante", () => {
    expect(written(writeMark(lines, sys, 9, at(1), 0, { head: "mf" }))).toBe("@       mf");
    expect(written(writeMark(lines, sys, 9, at(0), 0, { head: "<", fill: "-" }))).toBe("@   <-----");
    expect(written(writeMark(lines, sys, 9, at(0), 0, { head: "(", fill: "-", tail: ")" }))).toBe("@   (---)");
  });
  it("déborde sur les cases libres de sa ligne, et n'élargit le système que pour ne pas toucher l'indication suivante", () => {
    expect(writeMark(lines, sys, 9, at(0), 0, { head: "a tempo" }).lines.size).toBe(1);
    expect(written(writeMark(lines, sys, 9, at(0), 0, { head: "a tempo" }))).toBe("@   a tempo");
    const withP = [...lines];
    withP[9] = "@       p";
    const r = writeMark(withP, sys, 9, at(0), 0, { head: "dolce" });
    expect(r.lines.get(9)).toBe("@   dolce p");
    expect(r.lines.get(sys.ruler)).toBe("m1 |1    |2  |3  |4  ||");
  });

  it("ne recouvre pas l'indication suivante, et remplace celle de sa case", () => {
    const withF = [...lines];
    withF[9] = "@           f";
    expect(writeMark(withF, sys, 9, at(1), 0, { head: "<", fill: "-" }).lines.get(9)).toBe("@       <-- f");
    expect(writeMark(withF, sys, 9, at(2), 1, { head: "pp" }).lines.get(9)).toBe("@           pp");
  });
});

describe("complétion de parts:", () => {
  const doc = (parts: string) => `---\nformat: 1\nparts: ${parts}\n---\n`;
  it("propose pour une guitare ses accordages, les capos usuels, puis les instruments", () => {
    const l = labels(doc("Guitare ("), 2, 16);
    expect(l.slice(0, 5)).toEqual(["standard", "drop-d", "dadgad", "open-g", "open-d"]);
    expect(l).toEqual(expect.arrayContaining(["capo 1", "capo 7", "piano"]));
    expect(labels(doc("Guitare (drop-d, "), 2, 24)).toEqual(["capo 1", "capo 2", "capo 3", "capo 4", "capo 5", "capo 6", "capo 7"]);
  });
  it("propose des parties toutes faites, Piano et Guitare en tête, sans celles déjà écrites", () => {
    expect(labels(doc(""), 2, 7).slice(0, 2)).toEqual(["Piano", "Guitare"]);
    expect(labels(doc("Piano, "), 2, 14)).not.toContain("Piano");
  });
});

