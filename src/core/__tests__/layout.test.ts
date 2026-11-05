import { describe, expect, it } from "vitest";
import { layout, parsePrisma, writePrisma } from "../index.ts";
import type { Align } from "../index.ts";

describe("notes alignées", () => {
  const metrics = { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 };
  const rows = (text: string, align?: Align) => layout(parsePrisma(text), { ...metrics, align })[0].staves[0].rows.map((r) => r.cells);
  const piece = ["m1 |1  |2  |3  |4  ||", "0  |8  |   |8  |10 ||", "   |5  |5  |5  |5  ||", "   |1  |1  |   |   ||", "---", "-1 |1  |-  |-  |-  ||", ""].join("\n");

  it("range par défaut chaque accord depuis le haut du couloir", () => {
    expect(rows(piece)).toEqual([
      ["8", "5", "8", "10"],
      ["5", "1", "5", "5"],
      ["1", "", "", ""],
    ]);
  });

  it("garde sur sa ligne une note rejouée, l'aiguë toujours au-dessus de la grave", () => {
    expect(rows(piece, "replayed")).toEqual([
      ["8", "", "8", "10"],
      ["5", "5", "5", "5"],
      ["1", "1", "", ""],
    ]);
  });

  it("ne touche pas au texte .prisma", () => {
    expect(writePrisma(parsePrisma(piece))).toContain("0  |8  |5  |8  |10 ||");
  });

  it("ajoute une ligne quand des chaînes se croisent, et seulement alors", () => {
    // le 5 tient tout du long : le 8 au-dessus, puis le 3 au-dessous
    const cross = ["m1 |1  |2  ||", "0  |8  |5  ||", "   |5  |3  ||", "---", "-1 |   |   ||", ""].join("\n");
    expect(rows(cross, "replayed")).toEqual([
      ["8", ""],
      ["5", "5"],
      ["", "3"],
    ]);
  });

  it("une ligne par note : deux notes d'une même mesure sur deux lignes, l'aiguë au-dessus", () => {
    // un arpège 1 5 8 5 puis 3 5 8 5 : dans une même mesure, le 3 et le 1 ont chacun leur ligne
    const arp = ["m1 |1  .  .  .  |2  .  .  .  ||", "0  |1  5  8  5  |3  5  8  5  ||", "---", "-1 |            |            ||", ""].join("\n");
    expect(rows(arp, "replayed")).toEqual([["1", "5", "8", "5", "3", "5", "8", "5"]]);
    expect(rows(arp, "pitch")).toEqual([
      ["", "", "8", "", "", "", "8", ""],
      ["", "5", "", "5", "", "5", "", "5"],
      ["", "", "", "", "3", "", "", ""],
      ["1", "", "", "", "", "", "", ""],
    ]);
    // d'une mesure à l'autre, le 1 et le 3 peuvent partager la ligne du bas
    const bars = ["m1 |1  .  .  .  ||1  .  .  .  ||", "0  |1  5  8  5  ||3  5  8  5  ||", "---", "-1 |            ||            ||", ""].join("\n");
    expect(rows(bars, "pitch")).toEqual([
      ["", "", "8", "", "", "", "8", ""],
      ["", "5", "", "5", "", "5", "", "5"],
      ["1", "", "", "", "3", "", "", ""],
    ]);
  });
});
