import { describe, expect, it } from "vitest";
import { beatActions, beatAt, cellWidth, mergeBeat, splitAt, splitBeat } from "../beat.ts";
import { systemOf } from "../complete.ts";
import type { Rewrite } from "../complete.ts";
import { TICKS_PER_BEAT as BEAT, parsePrisma } from "../../../core/index.ts";

const apply = (lines: string[], rewrite: Rewrite | undefined) => lines.map((line, index) => rewrite?.lines.get(index) ?? line);
const piece = (lines: string[]) => ["---", "format: 1", "---", "", ...lines].join("\n");
/** Les notes du morceau : instant de début, de fin et hauteur, pour vérifier que rien ne change à l'écoute. */
const notes = (lines: string[]) => parsePrisma(piece(lines)).notes.map((note) => [note.start, note.end, note.midi]);

const sys = [
  "@   p      <-----",
  "m1 |1  |2  *  ||",
  "───┼───┼──────┼┼",
  "0  |5  |7  9  ||",
  "@l  la  li lo",
  "───┼───┼──────┼┼",
  "-1 |1  |8  -  ||",
];
const system = systemOf(sys, 1)!;

describe("diviser un temps", () => {
  it("trouve le temps d'une colonne, son nombre de cases et son découpage", () => {
    expect(beatAt(sys[1], 5)).toMatchObject({ count: 1, base: 2 });
    expect(beatAt(sys[1], 11)).toMatchObject({ count: 2, base: 2 });
    expect(beatAt("m1 |1  *  *  ||", 8)).toMatchObject({ count: 3, base: 3 });
    expect(beatAt(sys[1], 1)).toBeUndefined();
  });

  it("divise un temps d'une case en 2 : la note se prolonge, les autres lignes suivent", () => {
    const out = apply(sys, splitBeat(sys, system, 4, 2, 3));
    expect(out).toEqual([
      "@   p         <-----",
      "m1 |1  *  |2  *  ||",
      "───┼──────┼──────┼┼",
      "0  |5  -  |7  9  ||",
      "@l  la     li lo",
      "───┼──────┼──────┼┼",
      "-1 |1  -  |8  -  ||",
    ]);
    expect(notes(out)).toEqual(notes(sys));
  });

  it("coupe en 3, et un temps vide reste vide", () => {
    const lines = ["m1 |1  |2  ||", "0  |   |5  ||"];
    const out = apply(lines, splitBeat(lines, systemOf(lines, 0)!, 4, 3, 3));
    expect(out).toEqual(["m1 |1  *  *  |2  ||", "0  |         |5  ||"]);
    expect(notes(out)).toEqual(notes(lines));
  });

  it("divise encore un temps déjà divisé : les étiquettes écrites gardent leur sens", () => {
    const out = apply(sys, splitBeat(sys, system, 9, 2, 3));
    expect(out[1]).toBe("m1 |1  |2  .  *  .  ||");
    expect(out[3]).toBe("0  |5  |7  -  9  -  ||");
    expect(out[6]).toBe("-1 |1  |8  -  -  -  ||");
    expect(notes(out)).toEqual(notes(sys));
    const ternary = ["m1 |1  *  *  ||", "0  |5  7  9  ||"];
    expect(apply(ternary, splitBeat(ternary, systemOf(ternary, 0)!, 4, 2, 3))[0]).toBe("m1 |1  .  *  .  *  .  ||");
  });

  it("prend la largeur des cases de l'en-tête", () => {
    expect(cellWidth("---\nformat: 1\ncell: 4\n---\n")).toBe(4);
    expect(cellWidth("m1 |1  ||")).toBe(3);
  });
});

describe("refermer un temps", () => {
  it("referme ce qui a été coupé, et retrouve le texte de départ", () => {
    const split = apply(sys, splitBeat(sys, system, 4, 2, 3));
    expect(apply(split, mergeBeat(split, systemOf(split, 1)!, 4))).toEqual(sys);
    const resplit = apply(sys, splitBeat(sys, system, 9, 2, 3));
    expect(apply(resplit, mergeBeat(resplit, systemOf(resplit, 1)!, 9))).toEqual(sys);
  });

  it("refuse quand une note commencerait ou s'arrêterait sur une case refermée", () => {
    for (const notesLine of ["0  |5  7  ||", "0  |5     ||"]) {
      const lines = ["m1 |1  *  ||", notesLine];
      expect(mergeBeat(lines, systemOf(lines, 0)!, 4)).toBeUndefined();
      expect(beatActions(lines, systemOf(lines, 0)!, 4)).toContainEqual({
        kind: "merge",
        factor: 2,
        label: "Refermer",
        blocked: "une note commence ou s'arrête sur une case à refermer",
      });
    }
  });

  it("refuse quand une indication commence sur une case refermée", () => {
    const lines = ["m1 |1  *  ||", "0  |5  -  ||", "@      p"];
    expect(beatActions(lines, systemOf(lines, 0)!, 4)).toContainEqual(
      expect.objectContaining({ kind: "merge", blocked: "une indication commence sur une case à refermer" }),
    );
    expect(mergeBeat(sys, system, 9)).toBeUndefined();
  });

  it("garde la largeur d'une case quand un texte la traverse", () => {
    const lines = ["@   cresc.", "m1 |1  *  |2  ||", "0  |5  -  |   ||"];
    const out = apply(lines, mergeBeat(lines, systemOf(lines, 1)!, 4));
    expect(out).toEqual(["@   cresc.", "m1 |1     |2  ||", "0  |5     |   ||"]);
    expect(notes(out)).toEqual(notes(lines));
  });
});

describe("les actions d'un temps", () => {
  it("diviser en 2 ou en 3 un temps d'une case ; diviser encore et refermer un temps divisé", () => {
    expect(beatActions(sys, system, 4).map((action) => action.label)).toEqual(["Diviser en 2", "Diviser en 3"]);
    const lines = ["m1 |1  *  ||", "0  |5  -  ||"];
    expect(beatActions(lines, systemOf(lines, 0)!, 4)).toEqual([
      { kind: "split", factor: 2, label: "Diviser en 2" },
      { kind: "merge", factor: 2, label: "Refermer" },
    ]);
  });

  it("ne divise pas au-delà de la virgule", () => {
    const ruler = "m1 |1  ,  .  ,  *  ,  .  ,  ||";
    expect(beatActions([ruler, "0  |5"], systemOf([ruler, "0  |5"], 0)!, 4).map((action) => action.label)).toEqual([
      "Diviser en 2",
      "Refermer",
    ]);
    const sixteen = apply([ruler, "0  |5"], splitBeat([ruler, "0  |5"], systemOf([ruler, "0  |5"], 0)!, 4, 2, 3));
    expect(beatActions(sixteen, systemOf(sixteen, 0)!, 4).map((action) => action.label)).toEqual(["Refermer"]);
  });
});

describe("détailler pour une case de la règle détaillée", () => {
  const text = piece(["m1 |1  |2  *  ||", "0  |5  |7  9  ||"]);
  const ruler = (rewritten?: string) => rewritten?.split("\n")[4];

  it("divise le temps juste assez pour qu'une case commence à l'instant voulu", () => {
    expect(ruler(splitAt(text, BEAT / 2))).toBe("m1 |1  *  |2  *  ||");
    expect(ruler(splitAt(text, BEAT / 4))).toBe("m1 |1  .  *  .  |2  *  ||");
    expect(ruler(splitAt(text, BEAT / 3))).toBe("m1 |1  *  *  |2  *  ||");
    expect(ruler(splitAt(text, BEAT + BEAT / 4))).toBe("m1 |1  |2  .  *  .  ||");
  });

  it("ne touche à rien quand la case existe, ni pour mêler demis et tiers", () => {
    expect(splitAt(text, BEAT + BEAT / 2)).toBeUndefined();
    expect(splitAt(text, BEAT + BEAT / 3)).toBeUndefined();
  });

  it("garde les notes telles qu'elles sonnent", () => {
    const lines = splitAt(text, BEAT / 4)!
      .split("\n")
      .slice(4);
    expect(notes(lines)).toEqual(notes(text.split("\n").slice(4)));
  });
});

describe("refermer tous les niveaux superflus", () => {
  it("compresse un temps divisé plusieurs fois dont les niveaux fins ne servent pas", () => {
    const lines = ["m1 |1  .  *  .  |2  ||", "0  |5  -  7  -  |   ||"];
    const out = apply(lines, mergeBeat(lines, systemOf(lines, 0)!, 4));
    expect(out).toEqual(["m1 |1  *  |2  ||", "0  |5  7  |   ||"]);
    expect(notes(out)).toEqual(notes(lines));
  });

  it("va jusqu'à une seule case quand rien ne commence dans le temps", () => {
    const lines = ["m1 |1  .  *  .  |2  ||", "0  |5  -  -  -  |   ||"];
    expect(apply(lines, mergeBeat(lines, systemOf(lines, 0)!, 4))).toEqual(["m1 |1  |2  ||", "0  |5  |   ||"]);
  });

  it("s'arrête au niveau où une note commence, après avoir divisé un temps en 3 puis en 2", () => {
    // un temps en 3, une note sur sa 2ᵉ case ; divisé encore, la note est sur la 3ᵉ case de 6
    const lines = ["m1 |1  *  *  |2  ||", "0  |5  7  -  |   ||"];
    const divided = apply(lines, splitBeat(lines, systemOf(lines, 0)!, 4, 2, 3));
    expect(apply(divided, mergeBeat(divided, systemOf(divided, 0)!, 4))).toEqual(lines);
  });
});
