import { describe, expect, it } from "vitest";
import { importMusicXml, layout, parsePrisma, TICKS_PER_BEAT as T, writePrisma } from "../index.ts";
import { C4, musicXml, q } from "../../../tests/support/musicxml.ts";
import { roundTrip } from "../../../tests/support/round-trip.ts";
import type { Score } from "../index.ts";

describe("nuances et soufflets", () => {
  const expr = (s: Score) => s.expressions.map((e) => `${e.staff}:${e.kind}:${e.text}@${e.t / T}`).join(" ");
  const pins = (s: Score) => s.hairpins.map((h) => `${h.staff}:${h.kind}${h.start / T}-${h.end / T}`).join(" ");
  const piece = [
    "m1 |1  |2  |3  |4  ||",
    "0  |1  |3  |5  |-  ||",
    "@   p   <------",
    "---",
    "-1 |1  |   |   |   ||",
    "@   mf      >--",
    "",
  ].join("\n");

  it("lit les lignes @ sous chaque portée", () => {
    const s = parsePrisma(piece);
    expect(expr(s)).toBe("0:dynamic:p@0 1:dynamic:mf@0");
    // le soufflet finit avec la case qui contient son dernier caractère
    expect(pins(s)).toBe("0:<1-3 1:>2-3");
  });

  it("écrit nuances et soufflets sous leur portée, et les relit à l'identique", () => {
    const s = parsePrisma(piece);
    const text = writePrisma(s);
    const lines = text.split("\n");
    const sep = lines.findIndex((l, i) => i > 2 && /^─/.test(l) && lines[i - 1].startsWith("@"));
    expect(lines[sep - 1]).toMatch(/^@ +p +<-+$/);
    expect(lines.filter((l) => l.startsWith("@")).pop()).toMatch(/^@ +mf +>-+$/);
    const back = parsePrisma(text);
    expect(expr(back)).toBe(expr(s));
    expect(pins(back)).toBe(pins(s));
  });

  it("garde un soufflet qui passe d'un système au suivant", () => {
    const bars = Array.from({ length: 8 }, () => "1  |2  |3  ||").join("");
    const notes = Array.from({ length: 8 }, () => "1  |   |   ||").join("");
    const s = parsePrisma(`m1 |${bars}\n0  |${notes}\n@   <\n---\n`);
    s.hairpins[0].end = 20 * T; // de la mesure 1 au milieu de la mesure 7
    const text = writePrisma(s, { width: 40 });
    expect(text.split("\n").filter((l) => /^@ +<-*$/.test(l)).length).toBeGreaterThan(1);
    const back = parsePrisma(text);
    expect(pins(back)).toBe("0:<0-20");
    // un soufflet coupé reste ouvert au point de coupure
    const spans = layout(back, { width: 40, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 }).flatMap((x) => x.staves[0].voice.hairpins);
    expect(spans[0].from).toBe(0);
    expect(spans[0].to).toBeGreaterThan(0);
    expect(spans[spans.length - 1].to).toBe(1);
  });

  it("garde « più f » comme un seul texte", () => {
    const s = parsePrisma("m1 |1  |2  ||\n0  |1  |   ||\n@   più f\n---\n");
    expect(expr(s)).toBe("0:text:più f@0");
  });

  it("refuse une ligne de notes sous la ligne @ de sa portée", () => {
    expect(() => parsePrisma("m1 |1  ||\n0  |1  ||\n@   p\n   |3  ||\n---\n")).toThrow(/sous une ligne @/);
  });

  it("refuse une nuance qui ne commence pas sur une case", () => {
    expect(() => parsePrisma("m1 |1  |2  ||\n0  |1  |   ||\n@    p\n---\n")).toThrow(/doit commencer exactement sur une case/);
  });

  it("importe nuances, soufflets et textes du MusicXML", () => {
    const dir = (staff: number, inner: string) => `<direction><direction-type>${inner}</direction-type><staff>${staff}</staff></direction>`;
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4], dur: q, before: dir(1, "<dynamics><p/></dynamics>") + dir(1, "<words>rit.</words>") },
            { midi: [C4 + 2], dur: q, before: dir(1, '<wedge type="crescendo"/>') },
            { midi: [C4 + 4], dur: q },
            { midi: [C4 + 5], dur: q, before: dir(1, '<wedge type="stop"/>') + dir(1, "<dynamics><f/></dynamics>") },
          ],
          [{ midi: [48], dur: 4 * q, staff: 2, before: dir(2, "<words>dolce</words>") }],
        ],
      },
    ]);
    const s = importMusicXml(xml);
    expect(s.texts).toEqual([{ t: 0, text: "rit." }]);
    expect(expr(s)).toBe("0:dynamic:p@0 1:text:dolce@0 0:dynamic:f@3");
    expect(pins(s)).toBe("0:<1-3");
    roundTrip(s);
    expect(expr(parsePrisma(writePrisma(s)))).toBe("0:dynamic:p@0 1:text:dolce@0 0:dynamic:f@3");
  });
});

describe("liaisons d'expression", () => {
  const sk = (s: Score) => s.slurs.map((x) => `${x.staff}:${x.start / T}-${x.end / T}`).join(" ");
  const ruler = "m1 |1  |2  |3  |4  ||1  |2  |3  |4  ||";
  const rh = "0  |5  |7  |8  |10 ||8  |7  |5  |3  ||";
  const piece = (slurLine: string) => [ruler, rh, slurLine, "---", ""].join("\n");

  it("lit une liaison de la case de sa première note à celle de sa dernière", () => {
    const s = parsePrisma(piece("@   (-------)   (-------------)"));
    expect(sk(s)).toBe("0:0-2 0:3-6");
    expect(s.expressions).toEqual([]);
  });

  it("garde les liaisons imbriquées, coupées et reprises à l'aller-retour", () => {
    const s = parsePrisma(piece("@   (-------------------------)\n@       (---)        (---)"));
    expect(sk(s)).toBe("0:0-6 0:1-2 0:4-5");
    // un système par mesure : la grande liaison est coupée puis reprise
    const text = writePrisma(s, { width: 24 });
    expect(text).toMatch(/^@ +\(-+$/m);
    expect(text).toMatch(/^@ +-+\)/m);
    expect(sk(parsePrisma(text))).toBe(sk(s));
  });

  it("range les liaisons imbriquées par étages, la plus courte au plus près des notes", () => {
    const s = parsePrisma(piece("@   (-------------------------)\n@       (---)        (---)"));
    const v = layout(s, { width: 999, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 })[0].staves[0].voice;
    expect(v.slurs.map((x) => `${x.fromAnchor}-${x.toAnchor}:${x.level}`).sort()).toEqual(["0-6:1", "1-2:0", "4-5:0"]);
  });

  it("refuse une liaison jamais refermée, ou reprise sans avoir été ouverte", () => {
    expect(() => parsePrisma(piece("@   (-----"))).toThrow(/jamais refermée/);
    expect(() => parsePrisma(piece("@   ------)"))).toThrow(/sans liaison ouverte/);
  });

  it("importe les liaisons du MusicXML par numéro, même d'une voix à l'autre, sans les prolongations", () => {
    const slur = (type: string, n = "1") => `<slur type="${type}" number="${n}"/>`;
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4], dur: q, notations: slur("start") },
            { midi: [C4 + 2], dur: q, notations: slur("start", "2") },
            { midi: [C4 + 4], dur: q, notations: slur("stop", "2"), tie: ["start"] },
            { midi: [C4 + 4], dur: q, tie: ["stop"] },
          ],
          [{ dur: 3 * q, voice: 2 }, { midi: [55], dur: q, voice: 2, notations: slur("stop") }],
        ],
      },
      { notes: [[{ midi: [C4 + 5], dur: 4 * q }]] },
    ]);
    const s = importMusicXml(xml);
    // la liaison 1 part de la voix 1 et se termine sur la voix 2 : elle reste à la main où elle commence
    expect(sk(s)).toBe("0:0-3 0:1-2");
  });
});

describe("articulations", () => {
  const piece = ["m1 |1  |2  |3  |4  ||", "0  |8  |10 |12 |8  ||", "   |5  |   |   |   ||", "@   .   .   !   !!", "---", "-1 |1  |-  |-  |-  ||", ""].join("\n");

  it("lit staccato, accent et marcato sur la ligne @ de la portée", () => {
    expect(parsePrisma(piece).articulations).toEqual([
      { staff: 0, t: 0, kind: "staccato" },
      { staff: 0, t: T, kind: "staccato" },
      { staff: 0, t: 2 * T, kind: "accent" },
      { staff: 0, t: 3 * T, kind: "marcato" },
    ]);
  });

  it("les réécrit telles quelles, et garde deux articulations d'une même case", () => {
    expect(writePrisma(parsePrisma(piece))).toContain("@   .   .   !   !!");
    const two = piece.replace("@   .   .   !   !!", "@   . !");
    const s = parsePrisma(two);
    expect(s.articulations.map((x) => x.kind)).toEqual(["staccato", "accent"]);
    expect(parsePrisma(writePrisma(s)).articulations).toEqual(s.articulations);
  });

  it("refuse une articulation au-dessus de la règle, ou deux fois la même", () => {
    expect(() => parsePrisma("@   .\n" + piece)).toThrow(/sous sa portée/);
    expect(() => parsePrisma(piece.replace("@   .   .   !   !!", "@   . ."))).toThrow(/deux fois/);
  });

  it("importe les articulations du MusicXML, une fois par accord, sans le tenuto", () => {
    const art = (inner: string) => `<articulations>${inner}</articulations>`;
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4, C4 + 4], dur: q, notations: art("<staccato/>") },
            { midi: [C4], dur: q, notations: art("<accent/>") },
            { midi: [C4], dur: q, notations: art("<strong-accent/>") },
            { midi: [C4], dur: q, notations: art("<tenuto/>") },
          ],
        ],
      },
    ]);
    expect(importMusicXml(xml).articulations).toEqual([
      { staff: 0, t: 0, kind: "staccato" },
      { staff: 0, t: T, kind: "accent" },
      { staff: 0, t: 2 * T, kind: "marcato" },
    ]);
  });
});

describe("point d'orgue", () => {
  it("lit « ^ » sur la ligne @ du haut, sans le coller à un texte voisin", () => {
    const s = parsePrisma("@   dolce ^\nm1 |1    |2    |3    |4    ||\n0  |1    |     |     |5    ||\n---\n");
    expect(s.fermatas).toEqual([T]);
    expect(s.texts).toEqual([{ t: 0, text: "dolce" }]);
  });

  it("importe le point d'orgue d'une note et d'un silence, une seule fois par instant", () => {
    const f = "<fermata/>";
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4], dur: 2 * q, notations: f },
            { dur: 2 * q, notations: f },
          ],
          [{ midi: [48], dur: 2 * q, staff: 2, notations: f }, { midi: [43], dur: 2 * q, staff: 2 }],
        ],
      },
    ]);
    const s = importMusicXml(xml);
    expect(s.fermatas).toEqual([0, 2 * T]);
    const { text, back } = roundTrip(s);
    expect(text).toMatch(/^@ +\^ +\^$/m);
    expect(back.fermatas).toEqual(s.fermatas);
  });

  it("ignore les indications d'octave, déjà portées par les notes", () => {
    const dir = (inner: string) => `<direction><direction-type>${inner}</direction-type><staff>1</staff></direction>`;
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4], dur: 2 * q, before: dir("<words>(sol 8vb)</words>") + dir("<words>dolce</words>") },
            { midi: [C4], dur: 2 * q, before: dir("<words>loco</words>") + dir("<words>8va</words>") },
          ],
        ],
      },
    ]);
    expect(importMusicXml(xml).expressions.map((e) => e.text)).toEqual(["dolce"]);
  });
});

describe("doigtés", () => {
  const fk = (s: Score) => s.notes.filter((n) => n.finger).map((n) => `${n.midi}_${n.finger}`).join(" ");
  const ruler = "m1 |1      |2      |3  |4  ||";

  it("lit un doigté « 5_3 », seul ou avec une trille, et le garde à l'aller-retour", () => {
    const s = parsePrisma([ruler, "0  |5_1    |7~9_3  |8  |   ||", "   |1_5    |       |   |   ||", "---", ""].join("\n"));
    expect(fk(s)).toBe("64_1 60_5 66_3");
    expect(s.notes.find((n) => n.midi === 66)!.trill).toBe(68);
    const { text, back } = roundTrip(s);
    expect(fk(back)).toBe(fk(s));
    expect(text).toContain("7~9_3");
  });

  it("refuse un doigt hors de 1 à 5, ou posé sur une tenue", () => {
    expect(() => parsePrisma([ruler, "0  |5_6    |       |   |   ||", "---", ""].join("\n"))).toThrow(/doigt de 1 à 5/);
    expect(() => parsePrisma([ruler, "0  |5      |-_2    |   |   ||", "---", ""].join("\n"))).toThrow(/case invalide/);
  });

  it("importe les doigtés du MusicXML, le premier doigt d'une substitution", () => {
    const fing = (f: string) => `<technical><fingering>${f}</fingering></technical>`;
    const xml = musicXml([{ notes: [[{ midi: [C4], dur: 2 * q, notations: fing("1") }, { midi: [C4 + 4], dur: 2 * q, notations: fing("4-3") }]] }]);
    expect(fk(importMusicXml(xml))).toBe("60_1 64_4");
  });
});
