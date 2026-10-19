import { describe, expect, it } from "vitest";
import { parseErrors } from "../src/core/index.ts";

const sys = (bar: number, notes: string) => [`m${bar} |1  |2  ||`, "───┼───┼───┼┼", `0  |${notes}||`, "───┼───┼───┼┼", "-1 |1  |   ||"].join("\n");
const text = (...systems: string[]) => ["---", "format: 1", "---", "", systems.join("\n\n"), ""].join("\n");
const at = (errs: ReturnType<typeof parseErrors>) => errs.map((e) => `${e.line}:${e.reason.slice(0, 20)}`);

describe("toutes les erreurs en une passe", () => {
  it("rien quand le texte se lit", () => {
    expect(parseErrors(text(sys(1, "1  |3  "), sys(2, "5  |   ")))).toEqual([]);
  });

  it("une erreur par système fautif, dans l'ordre du texte", () => {
    const errs = parseErrors(text(sys(1, "13 |3  "), sys(2, "5  |   "), sys(3, "5  |9q "), sys(4, "1  |   ")));
    expect(at(errs)).toEqual(["7:case invalide « 13 »", "19:case invalide « 9q »"]);
  });

  it("pas d'erreur en cascade autour d'un système mis de côté", () => {
    // la tenue du 5 continue dans le système suivant (« -5 ») : sans lui, elle n'aurait plus d'origine
    const a = [`m1 |1  |2  ||`, "───┼───┼───┼┼", `0  |5  |-  ||`, "───┼───┼───┼┼", "-1 |1  |13 ||"].join("\n");
    const b = [`m2 |1  |2  ||`, "───┼───┼───┼┼", `0  |-5 |-  ||`, "───┼───┼───┼┼", "-1 |1  |   ||"].join("\n");
    expect(at(parseErrors(text(a, b)))).toEqual(["9:case invalide « 13 »"]);
    // une mesure à finir, dans le système suivant d'un système mis de côté : rien de plus
    const c = [`m1 |1  ||1  |`, "───┼───┼┼───┼", `0  |13 ||   |`, "───┼───┼┼───┼", "-1 |1  ||   |"].join("\n");
    const d = [`m2 |2  ||`, "───┼───┼┼", `0  |5  ||`, "───┼───┼┼", "-1 |   ||"].join("\n");
    expect(at(parseErrors(text(c, d)))).toEqual(["7:case invalide « 13 »"]);
  });

  it("une erreur de l'en-tête arrête tout", () => {
    expect(parseErrors("---\nformat: x\n---\n" + sys(1, "13 |   "))).toHaveLength(1);
  });
});
