import { describe, expect, it } from "vitest";
import { TICKS_PER_BEAT as T, parsePrisma } from "../src/core/index.ts";
import { cellOf, durationOf, holdChoices, holdIn, resize, retouch } from "../src/app/retouch.ts";

const text = ["m1 |1  |2  ||", "───┼───┼───┼┼", "+1 |3  |   ||", "-1 |1  |-  ||", "───┼───┼───┼┼", "-2 |8  |   ||", "@   p"].join("\n");

describe("retouche sur place", () => {
  it("réécrit la note d'une case", () => {
    const r = retouch(text, { t: 0, staff: 0, octave: 5, content: "3" }, "5")!;
    expect(r.text.split("\n")[2]).toBe("+1 |5  |   ||");
    expect(r).toMatchObject({ line: 3, column: 5 });
    expect(retouch(text, { t: T, staff: 1, octave: 2, content: "" }, "10_2")!.text.split("\n")[5]).toBe("-2 |8  |10_2 ||");
    expect(() => parsePrisma(retouch(text, { t: T, staff: 1, octave: 2, content: "" }, "10_2")!.text)).not.toThrow();
  });

  it("vide une case", () => {
    expect(retouch(text, { t: T, staff: 0, octave: 3, content: "-" }, "")!.text.split("\n")[3]).toBe("-1 |1  |   ||");
  });

  it("ouvre la ligne d'une octave absente, à sa place dans la portée", () => {
    const r = retouch(text, { t: T, staff: 0, octave: 4, content: "" }, "8")!;
    expect(r.text.split("\n").slice(2, 5)).toEqual(["+1 |3  |   ||", "0  |   |8  ||", "-1 |1  |-  ||"]);
    expect(r).toMatchObject({ line: 4, column: 9 });
    const low = retouch(text, { t: 0, staff: 1, octave: 1, content: "" }, "1")!.text.split("\n");
    expect(low.slice(5, 8)).toEqual(["-2 |8  |   ||", "-3 |1  |   ||", "@   p"]);
    expect(() => parsePrisma(r.text)).not.toThrow();
  });

  it("dit ce que contient la case, et si une tenue peut s'y écrire", () => {
    expect(cellOf(text, { t: T, staff: 0, octave: 3, content: "-" })).toEqual({ content: "-", canHold: true, exact: true });
    expect(cellOf(text, { t: 0, staff: 0, octave: 5, content: "3" })).toEqual({ content: "3", canHold: false, exact: true });
    expect(cellOf(text, { t: T, staff: 0, octave: 4, content: "" })).toEqual({ content: "", canHold: false, exact: false });
  });

  it("une note à la place d'une tenue : la note d'avant s'arrête là, ses tenues suivantes s'effacent", () => {
    const t = ["m1 |1  |2  |3  ||", "0  |5  |-  |-  ||", "   |3  |-  |   ||", "", "m2 |1  |2  ||", "0  |-5 |-  ||", "   |   |   ||"].join("\n");
    // la tenue du 5 (et non celle du 3, sur l'autre ligne)
    const r = retouch(t, { t: T, staff: 0, octave: 4, content: "-5" }, "8")!.text.split("\n");
    expect(r[1]).toBe("0  |5  |8  |   ||");
    expect(r[2]).toBe("   |3  |-  |   ||");
    // la tenue continuait dans le système suivant : elle s'efface aussi
    expect(r[5]).toBe("0  |   |   ||");
    expect(() => parsePrisma(r.join("\n"))).not.toThrow();
    // la tenue du 3 : sur sa ligne
    const r3 = retouch(t, { t: T, staff: 0, octave: 4, content: "-3" }, "")!.text.split("\n");
    expect(r3.slice(1, 3)).toEqual(["0  |5  |-  |-  ||", "   |3  |   |   ||"]);
    // une note changée garde ses tenues
    expect(retouch(t, { t: 0, staff: 0, octave: 4, content: "5" }, "7")!.text.split("\n")[1]).toBe("0  |7  |-  |-  ||");
  });

  it("allonge et raccourcit une note depuis elle-même, jusque dans le système suivant", () => {
    const t = ["m1 |1  |2  |3  ||", "0  |5  |-  |   ||", "   |3  |4  |   ||", "", "m2 |1  |2  ||", "0  |   |   ||"].join("\n");
    const five = { t: 0, staff: 0, octave: 4, content: "5" };
    expect(durationOf(t, five)).toMatchObject({ note: "5", count: 2, longer: true, shorter: true, attack: { t: 0, content: "5" } });
    // depuis sa tenue aussi
    expect(durationOf(t, { t: T, staff: 0, octave: 4, content: "-5" })).toMatchObject({ count: 2 });
    const a = resize(t, five, 1)!;
    expect(a.text.split("\n")[1]).toBe("0  |5  |-  |-  ||");
    // au bout du système : la tenue passe au suivant, et nomme sa note
    const b = resize(a.text, five, 1)!;
    expect(b.text.split("\n")[5]).toBe("0  |-5 |   ||");
    expect(durationOf(b.text, five)).toMatchObject({ count: 4 });
    expect(() => parsePrisma(b.text)).not.toThrow();
    expect(resize(b.text, five, -1)!.text).toBe(a.text);
    // le 4 suit le 3 sur sa ligne : le 3 passe sur une ligne de plus de son octave pour s'allonger
    const three = { t: 0, staff: 0, octave: 4, content: "3" };
    expect(durationOf(t, three)).toMatchObject({ count: 1, longer: true, shorter: false });
    const c = resize(t, three, 1)!;
    expect(c.text.split("\n").slice(1, 4)).toEqual(["0  |5  |-  |   ||", "   |   |4  |   ||", "   |3  |-  |   ||"]);
    expect(() => parsePrisma(c.text)).not.toThrow();
    // ou sur une ligne de son octave déjà libre
    const u = ["m1 |1  |2  ||", "0  |3  |4  ||", "   |   |   ||"].join("\n");
    expect(resize(u, { t: 0, staff: 0, octave: 4, content: "3" }, 1)!.text.split("\n").slice(1)).toEqual(["0  |   |4  ||", "   |3  |-  ||"]);
  });

  it("tient, dans une case vide, une note de son couloir qui s'arrête juste avant", () => {
    const t = ["m1 |1  |2  |3  ||", "0  |5  |-  |   ||", "   |3  |4  |   ||"].join("\n");
    const empty = { t: 2 * T, staff: 0, octave: 4, content: "" };
    expect(holdChoices(t, empty)).toEqual(["5", "4"]);
    expect(holdIn(t, empty, "4")!.text.split("\n")[2]).toBe("   |3  |4  |-  ||");
    expect(holdIn(t, empty, "5")!.text.split("\n")[1]).toBe("0  |5  |-  |-  ||");
  });

  it("tient une note jusqu'à une case vide plus loin, sans note entre elles", () => {
    const t = ["m1 |1  |2  |3  |4  ||", "0  |5  |   |   |   ||", "   |3  |4  |   |   ||", "", "m2 |1  |2  ||", "0  |   |   ||"].join("\n");
    const far = { t: 3 * T, staff: 0, octave: 4, content: "" };
    expect(holdChoices(t, far)).toEqual(["4", "5"]);
    expect(holdIn(t, far, "5")!.text.split("\n")[1]).toBe("0  |5  |-  |-  |-  ||");
    // jusque dans le système suivant
    const next = { t: 5 * T, staff: 0, octave: 4, content: "" };
    const r = holdIn(holdIn(t, far, "5")!.text, next, "5")!;
    expect(r.text.split("\n")[5]).toBe("0  |-5 |-  ||");
    expect(() => parsePrisma(r.text)).not.toThrow();
  });
});
