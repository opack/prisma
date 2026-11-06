import { describe, expect, it } from "vitest";
import { TICKS_PER_BEAT, parsePrisma } from "../../../core/index.ts";
import {
  cellOf,
  durationOf,
  holdChoices,
  holdIn,
  joinCell,
  freeStrings,
  moveOctave,
  placeOnString,
  resize,
  retouch,
  splitCell,
} from "../retouch.ts";

const text = ["m1 |1  |2  ||", "───┼───┼───┼┼", "+1 |3  |   ||", "-1 |1  |-  ||", "───┼───┼───┼┼", "-2 |8  |   ||", "@   p"].join("\n");

describe("retouche sur place", () => {
  it("réécrit la note d'une case", () => {
    const result = retouch(text, { t: 0, staff: 0, octave: 5, content: "3" }, "5")!;
    expect(result.text.split("\n")[2]).toBe("+1 |5  |   ||");
    expect(result).toMatchObject({ line: 3, column: 5 });
    expect(retouch(text, { t: TICKS_PER_BEAT, staff: 1, octave: 2, content: "" }, "10_2")!.text.split("\n")[5]).toBe("-2 |8  |10_2 ||");
    expect(() => parsePrisma(retouch(text, { t: TICKS_PER_BEAT, staff: 1, octave: 2, content: "" }, "10_2")!.text)).not.toThrow();
  });

  it("vide une case", () => {
    expect(retouch(text, { t: TICKS_PER_BEAT, staff: 0, octave: 3, content: "-" }, "")!.text.split("\n")[3]).toBe("-1 |1  |   ||");
  });

  it("ouvre la ligne d'une octave absente, à sa place dans la portée", () => {
    const result = retouch(text, { t: TICKS_PER_BEAT, staff: 0, octave: 4, content: "" }, "8")!;
    expect(result.text.split("\n").slice(2, 5)).toEqual(["+1 |3  |   ||", "0  |   |8  ||", "-1 |1  |-  ||"]);
    expect(result).toMatchObject({ line: 4, column: 9 });
    const low = retouch(text, { t: 0, staff: 1, octave: 1, content: "" }, "1")!.text.split("\n");
    expect(low.slice(5, 8)).toEqual(["-2 |8  |   ||", "-3 |1  |   ||", "@   p"]);
    expect(() => parsePrisma(result.text)).not.toThrow();
  });

  it("dit ce que contient la case, et si une tenue peut s'y écrire", () => {
    expect(cellOf(text, { t: TICKS_PER_BEAT, staff: 0, octave: 3, content: "-" })).toEqual({ content: "-", canHold: true, exact: true });
    expect(cellOf(text, { t: 0, staff: 0, octave: 5, content: "3" })).toEqual({ content: "3", canHold: false, exact: true });
    expect(cellOf(text, { t: TICKS_PER_BEAT, staff: 0, octave: 4, content: "" })).toEqual({ content: "", canHold: false, exact: false });
  });

  it("une note à la place d'une tenue : la note d'avant s'arrête là, ses tenues suivantes s'effacent", () => {
    const piece = [
      "m1 |1  |2  |3  ||",
      "0  |5  |-  |-  ||",
      "   |3  |-  |   ||",
      "",
      "m2 |1  |2  ||",
      "0  |-5 |-  ||",
      "   |   |   ||",
    ].join("\n");
    // la tenue du 5 (et non celle du 3, sur l'autre ligne)
    const result = retouch(piece, { t: TICKS_PER_BEAT, staff: 0, octave: 4, content: "-5" }, "8")!.text.split("\n");
    expect(result[1]).toBe("0  |5  |8  |   ||");
    expect(result[2]).toBe("   |3  |-  |   ||");
    // la tenue continuait dans le système suivant : elle s'efface aussi
    expect(result[5]).toBe("0  |   |   ||");
    expect(() => parsePrisma(result.join("\n"))).not.toThrow();
    // la tenue du 3 : sur sa ligne
    const r3 = retouch(piece, { t: TICKS_PER_BEAT, staff: 0, octave: 4, content: "-3" }, "")!.text.split("\n");
    expect(r3.slice(1, 3)).toEqual(["0  |5  |-  |-  ||", "   |3  |   |   ||"]);
    // une note changée garde ses tenues
    expect(retouch(piece, { t: 0, staff: 0, octave: 4, content: "5" }, "7")!.text.split("\n")[1]).toBe("0  |7  |-  |-  ||");
  });

  it("allonge et raccourcit une note depuis elle-même, jusque dans le système suivant", () => {
    const piece = ["m1 |1  |2  |3  ||", "0  |5  |-  |   ||", "   |3  |4  |   ||", "", "m2 |1  |2  ||", "0  |   |   ||"].join("\n");
    const five = { t: 0, staff: 0, octave: 4, content: "5" };
    expect(durationOf(piece, five)).toMatchObject({ note: "5", count: 2, longer: true, shorter: true, attack: { t: 0, content: "5" } });
    // depuis sa tenue aussi
    expect(durationOf(piece, { t: TICKS_PER_BEAT, staff: 0, octave: 4, content: "-5" })).toMatchObject({ count: 2 });
    const done = resize(piece, five, 1)!;
    expect(done.text.split("\n")[1]).toBe("0  |5  |-  |-  ||");
    // au bout du système : la tenue passe au suivant, et nomme sa note
    const longer = resize(done.text, five, 1)!;
    expect(longer.text.split("\n")[5]).toBe("0  |-5 |   ||");
    expect(durationOf(longer.text, five)).toMatchObject({ count: 4 });
    expect(() => parsePrisma(longer.text)).not.toThrow();
    expect(resize(longer.text, five, -1)!.text).toBe(done.text);
    // le 4 suit le 3 sur sa ligne : le 3 passe sur une ligne de plus de son octave pour s'allonger
    const three = { t: 0, staff: 0, octave: 4, content: "3" };
    expect(durationOf(piece, three)).toMatchObject({ count: 1, longer: true, shorter: false });
    const moved = resize(piece, three, 1)!;
    expect(moved.text.split("\n").slice(1, 4)).toEqual(["0  |5  |-  |   ||", "   |   |4  |   ||", "   |3  |-  |   ||"]);
    expect(() => parsePrisma(moved.text)).not.toThrow();
    // ou sur une ligne de son octave déjà libre
    const free = ["m1 |1  |2  ||", "0  |3  |4  ||", "   |   |   ||"].join("\n");
    expect(resize(free, { t: 0, staff: 0, octave: 4, content: "3" }, 1)!.text.split("\n").slice(1)).toEqual([
      "0  |   |4  ||",
      "   |3  |-  ||",
    ]);
  });

  it("tient, dans une case vide, une note de son couloir qui s'arrête juste avant", () => {
    const piece = ["m1 |1  |2  |3  ||", "0  |5  |-  |   ||", "   |3  |4  |   ||"].join("\n");
    const empty = { t: 2 * TICKS_PER_BEAT, staff: 0, octave: 4, content: "" };
    expect(holdChoices(piece, empty)).toEqual(["5", "4"]);
    expect(holdIn(piece, empty, "4")!.text.split("\n")[2]).toBe("   |3  |4  |-  ||");
    expect(holdIn(piece, empty, "5")!.text.split("\n")[1]).toBe("0  |5  |-  |-  ||");
  });

  it("tient une note jusqu'à une case vide plus loin, sans note entre elles", () => {
    const piece = ["m1 |1  |2  |3  |4  ||", "0  |5  |   |   |   ||", "   |3  |4  |   |   ||", "", "m2 |1  |2  ||", "0  |   |   ||"].join(
      "\n",
    );
    const far = { t: 3 * TICKS_PER_BEAT, staff: 0, octave: 4, content: "" };
    expect(holdChoices(piece, far)).toEqual(["4", "5"]);
    expect(holdIn(piece, far, "5")!.text.split("\n")[1]).toBe("0  |5  |-  |-  |-  ||");
    // jusque dans le système suivant
    const next = { t: 5 * TICKS_PER_BEAT, staff: 0, octave: 4, content: "" };
    const done = holdIn(holdIn(piece, far, "5")!.text, next, "5")!;
    expect(done.text.split("\n")[5]).toBe("0  |-5 |-  ||");
    expect(() => parsePrisma(done.text)).not.toThrow();
  });

  it("découpe et recompose une case : petites notes, note, trille, doigté", () => {
    expect(splitCell("3'4'5~7_2")).toEqual({ graces: ["3", "4"], note: "5", trill: "7", finger: "2" });
    expect(splitCell("12")).toEqual({ graces: [], note: "12", trill: undefined, finger: undefined });
    expect(splitCell("-")).toBeUndefined();
    expect(joinCell({ graces: ["6"], note: "5", finger: "3" })).toBe("6'5_3");
    for (const cell of ["5", "3'5", "5~7", "5_1", "10'12'7~9_4"]) expect(joinCell(splitCell(cell)!)).toBe(cell);
  });

  it("change l'octave d'une note, avec ses tenues, jusque dans le système suivant", () => {
    const piece = [
      "m1 |1  |2  |3  ||",
      "+1 |   |   |   ||",
      "0  |5  |-  |-  ||",
      "   |3  |   |   ||",
      "",
      "m2 |1  |2  ||",
      "0  |-5 |   ||",
    ].join("\n");
    const up = moveOctave(piece, { t: 0, staff: 0, octave: 4, content: "5" }, 1)!;
    // les lignes restées vides disparaissent : le 3 prend le numéro de l'octave 0
    expect(up.text.split("\n")).toEqual([
      "m1 |1  |2  |3  ||",
      "+1 |5  |-  |-  ||",
      "0  |3  |   |   ||",
      "",
      "m2 |1  |2  ||",
      "+1 |-5 |   ||",
    ]);
    expect(up).toMatchObject({ octave: 5, line: 2, column: 5 });
    expect(() => parsePrisma(up.text)).not.toThrow();
    // vers une octave que le système n'a pas encore : sa ligne s'ouvre sous les autres
    const down = moveOctave(piece, { t: 0, staff: 0, octave: 4, content: "3" }, -1)!;
    expect(down.text.split("\n").slice(1, 4)).toEqual(["+1 |   |   |   ||", "0  |5  |-  |-  ||", "-1 |3  |   |   ||"]);
    expect(() => parsePrisma(down.text)).not.toThrow();
  });

  it("une ligne restée vide disparaît, son numéro d'octave passe à la suivante", () => {
    const piece = ["m1 |1  |2  ||", "+1 |5  |-  ||", "0  |   |   ||", "   |3  |   ||"].join("\n");
    const down = moveOctave(piece, { t: 0, staff: 0, octave: 5, content: "5" }, -1)!;
    expect(down.text.split("\n")).toEqual(["m1 |1  |2  ||", "0  |5  |-  ||", "   |3  |   ||"]);
    expect(down).toMatchObject({ line: 2 });
    const t2 = ["m1 |1  |2  ||", "0  |   |   ||", "   |5  |-  ||", "-1 |1  |   ||"].join("\n");
    expect(moveOctave(t2, { t: 0, staff: 0, octave: 4, content: "5" }, 1)!.text.split("\n")).toEqual([
      "m1 |1  |2  ||",
      "+1 |5  |-  ||",
      "0  |   |   ||",
      "-1 |1  |   ||",
    ]);
  });
});

describe("retouche sur une corde", () => {
  // une guitare : le mi4 sur la corde 1 à vide, le la2 tenu sur la corde 5 ; les autres cordes omises
  const tab = [
    "---",
    "parts: Guitare",
    "---",
    "",
    "m1 |1  |2  |3  ||",
    "───┼─ Guitare ─┼┼",
    "1  |0  |   |   ||",
    "5  |0  |-  |   ||",
    "",
  ].join("\n");
  const STRING_LANE = 100; // le couloir d'une corde : 100 plus son numéro
  const line = (piece: string, index: number) => piece.split("\n")[index];

  it("réécrit la case, et ouvre la ligne d'une corde omise à sa place", () => {
    expect(line(retouch(tab, { t: 0, staff: 0, octave: STRING_LANE + 1, content: "0" }, "3")!.text, 6)).toBe("1  |3  |   |   ||");
    const result = retouch(tab, { t: 2 * TICKS_PER_BEAT, staff: 0, octave: STRING_LANE + 3, content: "" }, "2")!.text;
    expect(result.split("\n").slice(6, 9)).toEqual(["1  |0  |   |   ||", "3  |   |   |2  ||", "5  |0  |-  |   ||"]);
    expect(parsePrisma(result).notes.find((note) => note.string === 3)).toMatchObject({ midi: 57, start: 2 * TICKS_PER_BEAT });
  });

  it("n'allonge une note que si sa corde est libre", () => {
    expect(durationOf(tab, { t: 0, staff: 0, octave: STRING_LANE + 5, content: "0" })).toMatchObject({ count: 2, longer: true });
    const busy = retouch(tab, { t: 2 * TICKS_PER_BEAT, staff: 0, octave: STRING_LANE + 5, content: "" }, "2")!.text;
    expect(durationOf(busy, { t: 0, staff: 0, octave: STRING_LANE + 5, content: "0" })).toMatchObject({ count: 2, longer: false });
    expect(resize(busy, { t: 0, staff: 0, octave: STRING_LANE + 5, content: "0" }, 1)).toBeUndefined();
  });

  it("place la note sur une autre corde, à n'importe quelle case, avec sa tenue", () => {
    const la = { t: 0, staff: 0, octave: STRING_LANE + 5, content: "0" };
    // le la2 de la corde 5 à vide passe sur la corde 6 : au même son (case 5), ou une autre note (case 3)
    const same = placeOnString(tab, la, 6, 5)!;
    expect(same.octave).toBe(STRING_LANE + 6);
    expect(same.text.split("\n").slice(6, 8)).toEqual(["1  |0  |   |   ||", "6  |5  |-  |   ||"]);
    expect(parsePrisma(same.text).notes.map((note) => [note.string, note.midi])).toEqual([
      [1, 64],
      [6, 45],
    ]);
    expect(parsePrisma(placeOnString(tab, la, 6, 3)!.text).notes.map((note) => [note.string, note.midi])).toEqual([
      [1, 64],
      [6, 43],
    ]);
    // sur sa propre corde, la note change de case, sa tenue avec elle
    expect(line(placeOnString(tab, la, 5, 2)!.text, 7)).toBe("5  |2  |-  |   ||");
    // une case vide s'écrit sur la corde choisie
    expect(
      parsePrisma(placeOnString(tab, { t: TICKS_PER_BEAT, staff: 0, octave: STRING_LANE + 1, content: "" }, 2, 1)!.text).notes.find(
        (note) => note.start === TICKS_PER_BEAT,
      ),
    ).toMatchObject({ string: 2, midi: 60 });
    // la corde 1 joue déjà au premier temps : le la ne peut pas y passer
    expect(placeOnString(tab, la, 1, 5)).toBeUndefined();
    expect(freeStrings(tab, la, 6)).toEqual([false, true, true, true, true, true]);
    expect(moveOctave(tab, { t: 0, staff: 0, octave: STRING_LANE + 1, content: "0" }, 1)).toBeUndefined();
  });

  it("comme sur l'instrument : coupe la note qui sonnait sur la corde, s'arrête à la suivante", () => {
    // le la2 (corde 5) tenu trois temps ; le sol2 (corde 6, case 3) attaqué avant et tenu ; le fa2 attaqué au temps 3
    const piece = [
      "---",
      "parts: Guitare",
      "---",
      "",
      "m1 |1  |2  |3  |4  ||",
      "───┼─ Guitare ─┼┼───┼┼",
      "5  |   |0  |-  |-  ||",
      "6  |3  |-  |1  |   ||",
      "",
    ].join("\n");
    const result = placeOnString(piece, { t: TICKS_PER_BEAT, staff: 0, octave: STRING_LANE + 5, content: "0" }, 6, 5)!.text;
    // le sol s'arrête au temps 2, où le la le remplace ; le la s'arrête au fa du temps 3
    expect(result.split("\n").slice(6)).toEqual(["6  |3  |5  |1  |   ||", ""]);
    expect(parsePrisma(result).notes.map((note) => [note.start / TICKS_PER_BEAT, note.end / TICKS_PER_BEAT, note.midi])).toEqual([
      [0, 1, 43],
      [1, 2, 45],
      [2, 3, 41],
    ]);
  });

  it("élargit une case sans couper le nom de la partie écrit sur le trait", () => {
    const piece = ["---", "parts: Guitare", "---", "", "m1 |1  |2  ||", "───┼─ Guitare ─┼┼", "6  |3  |   ||", ""].join("\n");
    const result = retouch(piece, { t: 0, staff: 0, octave: STRING_LANE + 6, content: "3" }, "12_2")!.text;
    expect(result.split("\n")[5]).toContain("─ Guitare ─");
    expect(parsePrisma(result).notes[0]).toMatchObject({ string: 6, midi: 52, finger: 2 });
  });
});
