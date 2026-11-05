import { describe, expect, it } from "vitest";
import { importMusicXml, parsePrisma, TICKS_PER_BEAT } from "../index.ts";
import { C4, musicXml, QUARTER } from "../../../tests/support/musicxml.ts";
import { notesKey, roundTrip } from "../../../tests/support/round-trip.ts";
import type { Score } from "../index.ts";

describe("petites notes", () => {
  const gk = (score: Score) => score.graces.map((grace) => `${grace.staff}:${grace.midi}@${grace.t / TICKS_PER_BEAT}#${grace.slot}`).join(" ");
  const piece = [
    "m1 |1        |2  |3        |4  ||",
    "+1 |3'       |   |         |   ||",
    "0  |   7'9'5 |-  |10'12'7  |1  ||",
    "---",
    "-1 |1        |8  |5'5'5    |1  ||",
    "",
  ].join("\n");

  it("lit les petites notes de gauche à droite dans la case, chacune dans son octave", () => {
    const s = parsePrisma(piece);
    expect(gk(s)).toBe("0:74@0#0 0:66@0#1 0:68@0#2 0:69@2#0 0:71@2#1 1:52@2#0 1:52@2#1");
    // les petites notes ne comptent pas dans le temps
    expect(notesKey(s)).toBe("0:64@0-5760 1:48@0-2880 1:55@2880-5760 0:66@5760-8640 1:52@5760-8640 0:60@8640-11520 1:48@8640-11520");
  });

  it("joue ensemble deux petites notes alignées", () => {
    const s = parsePrisma("m1 |1     |2  ||\n+1 |3'    |   ||\n0  |7'5   |   ||\n---\n");
    expect(gk(s)).toBe("0:74@0#0 0:66@0#0");
  });

  it("refuse une petite note placée après la note de sa case", () => {
    expect(() => parsePrisma("m1 |1     |2  ||\n0  |5 3'  |   ||\n---\n")).toThrow(/avant la note de sa case/);
  });

  it("garde les petites notes à l'aller-retour, en alignant les notes de la case", () => {
    const s = parsePrisma(piece);
    const { text, back } = roundTrip(s);
    expect(gk(back)).toBe(gk(s));
    expect(text).toContain("|3'      ");
    expect(text).toMatch(/^0  \|  7'9'5  \|/m);
  });

  it("importe les petites notes du MusicXML, barrées ou non, et les accords de petites notes", () => {
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4 + 2], duration: 0, grace: "slash" },
            { midi: [C4 + 4], duration: 0, grace: true },
            { midi: [C4], duration: 2 * QUARTER },
            { midi: [C4 + 7, C4 + 11], duration: 0, grace: true },
            { midi: [C4 + 12], duration: 2 * QUARTER },
          ],
          [{ midi: [48], duration: 4 * QUARTER, staff: 2 }],
        ],
      },
    ]);
    const s = importMusicXml(xml);
    expect(gk(s)).toBe("0:62@0#0 0:64@0#1 0:71@2#0 0:67@2#0");
    expect(notesKey(s)).toBe("0:60@0-5760 1:48@0-11520 0:72@5760-11520");
    expect(gk(roundTrip(s).back)).toBe(gk(s));
  });
});

describe("ornements", () => {
  const gk = (score: Score) => score.graces.map((grace) => `${grace.staff}:${grace.midi}@${grace.t / TICKS_PER_BEAT}#${grace.slot}`).join(" ");
  const tk = (s: Score) => s.notes.filter((note) => note.trill !== undefined).map((n) => `${n.midi}~${n.trill}`).join(" ");
  const ruler = "m1 |1    |2    |3    |4    ||";

  it("lit une trille « 5~7 » : la note et sa voisine la plus proche", () => {
    const s = parsePrisma([ruler, "0  |5~7  |-    |12~1 |-    ||", "---", ""].join("\n"));
    expect(tk(s)).toBe("64~66 71~72");
    expect(notesKey(s)).toBe(`0:64@0-${2 * TICKS_PER_BEAT} 0:71@${2 * TICKS_PER_BEAT}-${4 * TICKS_PER_BEAT}`);
    const { text, back } = roundTrip(s);
    expect(tk(back)).toBe(tk(s));
    expect(text).toContain("|5~7 ");
  });

  it("refuse une trille sur une tenue ou sans voisine", () => {
    expect(() => parsePrisma([ruler, "0  |5    |-5~7 |     |     ||", "---", ""].join("\n"))).toThrow(/case invalide/);
    expect(() => parsePrisma([ruler, "0  |5~5  |     |     |     ||", "---", ""].join("\n"))).toThrow(/autre note/);
  });

  it("lit les arpèges : d'une portée sur sa ligne @, de toutes sur celle du haut", () => {
    const s = parsePrisma(
      ["@         \\", ruler, "0  |5    |5    |     |     ||", "   |1    |1    |     |     ||", "@   /", "---", "-1 |1    |1    |     |     ||", ""].join("\n"),
    );
    expect(s.arpeggios).toEqual([{ t: 0, staff: 0 }, { t: TICKS_PER_BEAT, down: true }]);
    expect(s.expressions).toEqual([]);
    const { back } = roundTrip(s);
    expect(back.arpeggios).toEqual(s.arpeggios);
  });

  it("refuse deux arpèges sur un même accord", () => {
    expect(() => parsePrisma(["@   /", ruler, "0  |5    |     |     |     ||", "@   /", "---", ""].join("\n"))).toThrow(/un seul arpège/);
  });

  it("importe trilles, mordants et gruppettos avec les voisines de la gamme", () => {
    const orn = (inner: string) => `<ornaments>${inner}</ornaments>`;
    const xml = musicXml([
      {
        key: -3, // mi bémol majeur : si, mi et la bémols
        notes: [
          [
            { midi: [65], duration: QUARTER, notations: orn("<trill-mark/>") }, // fa : trille avec sol
            { midi: [62], duration: QUARTER, notations: orn("<inverted-mordent/>") }, // ré : note, mi bémol (armure), note
            { midi: [72], duration: QUARTER, notations: orn('<turn/><accidental-mark placement="above">natural</accidental-mark>') }, // do : ré, do, si bémol
            { midi: [67], duration: QUARTER, notations: orn("<mordent/>") }, // sol : note, fa, note
          ],
        ],
      },
    ]);
    const s = importMusicXml(xml);
    expect(tk(s)).toBe("65~67");
    expect(gk(s)).toBe(`0:62@1#0 0:63@1#1 0:74@2#0 0:72@2#1 0:70@2#2 0:67@3#0 0:65@3#1`);
    expect(gk(roundTrip(s).back)).toBe(gk(s));
  });

  it("joue un gruppetto placé après la note juste avant la note suivante", () => {
    const orn = `<ornaments><delayed-turn/></ornaments>`;
    const s = importMusicXml(musicXml([{ notes: [[{ midi: [64], duration: 2 * QUARTER, notations: orn }, { midi: [65], duration: 2 * QUARTER }]] }]));
    expect(gk(s)).toBe("0:65@2#0 0:64@2#1 0:62@2#2 0:64@2#3");
  });

  it("importe les arpèges : par portée, ou d'un seul geste quand les deux portées partagent leur numéro", () => {
    const arp = (number: string) => `<arpeggiate number="${number}"/>`;
    const xml = musicXml([
      {
        notes: [
          [{ midi: [64, 67], duration: 2 * QUARTER, notations: arp("1") }, { midi: [64, 67], duration: 2 * QUARTER, notations: arp("2") }],
          [{ midi: [48, 55], duration: 2 * QUARTER, staff: 2, notations: arp("1") }, { midi: [48, 55], duration: 2 * QUARTER, staff: 2, notations: arp("3") }],
        ],
      },
    ]);
    expect(importMusicXml(xml).arpeggios).toEqual([{ t: 0 }, { t: 2 * TICKS_PER_BEAT, staff: 0 }, { t: 2 * TICKS_PER_BEAT, staff: 1 }]);
  });
});
