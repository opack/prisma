import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { exportMusicXml, importMusicXml, parsePrisma, writePrisma } from "../src/core/index.ts";
import type { Score } from "../src/core/index.ts";

const notes = (ns: { staff: number; midi: number; start: number; end: number }[]) =>
  ns.map((n) => `${n.staff}:${n.midi}@${n.start}-${n.end}`).sort().join(" ");
const again = (s: Score) => importMusicXml(exportMusicXml(s));

/** Exemples ```prisma de la référence. */
function examples(markdown: string): string[] {
  const out: string[] = [];
  const re = /^( *)```prisma\n([\s\S]*?)^\1```/gm;
  for (let m = re.exec(markdown); m; m = re.exec(markdown)) out.push(m[2].split("\n").map((l) => l.slice(m![1].length)).join("\n"));
  return out;
}

describe("export MusicXML", () => {
  it("redonne la Gymnopédie n° 1 à l'import, note pour note", () => {
    const score = parsePrisma(writePrisma(importMusicXml(readFileSync(new URL("./fixtures/gymnopedie1.musicxml", import.meta.url), "utf8"))));
    const back = again(score);
    expect(notes(back.notes)).toBe(notes(score.notes));
    expect(back.beats.length).toBe(score.beats.length);
    expect(back.meta.key).toBe(score.meta.key);
  });

  it.each(examples(readFileSync(new URL("../REFERENCE.md", import.meta.url), "utf8")).map((t, i) => [i + 1, t]))(
    "redonne l'exemple %i de la référence à l'import, indications comprises",
    (_, text) => {
      const score = parsePrisma(text as string);
      const back = again(score);
      // un ordre de jeu est déroulé à l'export, puis retrouvé à l'import par ses repères
      expect(notes(back.notes)).toBe(notes(score.notes));
      for (const k of ["order", "markers", "graces", "chords", "lyrics", "expressions", "hairpins", "slurs", "pedals", "articulations", "fermatas", "arpeggios", "repeats"] as const) expect(back[k]).toEqual(score[k]);
      expect(back.notes.map((n) => [n.trill, n.finger])).toEqual(score.notes.map((n) => [n.trill, n.finger]));
    },
  );

  it("nomme les notes d'après la tonalité : fa♯ en sol majeur, si♭ en fa majeur, sol♯ en la mineur", () => {
    const step = (key: string, n: number) => {
      const xml = exportMusicXml(parsePrisma(`---\nkey: ${key}\n---\n\nm1 |1  ||\n0  |${String(n).padEnd(3)}||\n`));
      return xml.match(/<step>(\w)<\/step>(?:<alter>(-?1)<\/alter>)?/)!.slice(1).join("");
    };
    expect(step("8", 7)).toBe("F1");
    expect(step("6", 11)).toBe("B-1");
    expect(step("10:m", 9)).toBe("G1");
    expect(exportMusicXml(parsePrisma("---\nkey: 6\n---\n\nm1 |1  ||\n0  |1  ||\n"))).toContain("<fifths>-1</fifths>");
  });

  it("écrit un temps coupé en 3 en triolet, et un 6/8 en noires pointées", () => {
    const triplet = exportMusicXml(parsePrisma("m1 |1  *  *  |2  ||\n0  |1  3  5  |6  ||\n"));
    expect(triplet).toContain("<actual-notes>3</actual-notes><normal-notes>2</normal-notes>");
    expect(triplet.match(/<tuplet type="start"/g)).toHaveLength(1);
    const six = exportMusicXml(parsePrisma("---\ndivision: 3\n---\n\nm1 |1  *  *  |2  *  *  ||\n0  |1  3  5  |6  8  6  ||\n"));
    expect(six).toContain("<beats>6</beats><beat-type>8</beat-type>");
    expect(six).not.toContain("time-modification");
  });

  it("lie une note qui passe la barre, et sépare les voix d'une portée", () => {
    const tied = exportMusicXml(parsePrisma("m1 |1  |2  ||1  |2  ||\n0  |   |8  ||-  |   ||\n"));
    expect(tied.match(/<tie type="start"\/>/g)).toHaveLength(1);
    const voices = exportMusicXml(parsePrisma("m1 |1  |2  ||\n0  |8  |-  ||\n   |5  |3  ||\n"));
    expect(voices).toContain("<voice>2</voice>");
  });

  it("retrouve à l'import les sections, l'ordre de jeu, les reprises et la numérotation", () => {
    const text = `---
key: 1
order: A B A
---

@  [A]
m1 |3  |4  ||:1  |2  |3  |4  :||
0  |5  |3  ||:1  |-  |8  |-  :||

@  [B]
m3 |1  |2  |3  |4  ||
0  |10 |-  |8  |-  ||
`;
    const score = parsePrisma(text);
    expect(writePrisma(again(score))).toBe(writePrisma(score));
  });

  it("écrit en option un ordre de jeu en reprises et en cases, que l'import relit", () => {
    const section = (label: string, bar: number, note: number) => `@  [${label}]\nm${bar} |1  |2  ||\n0  |${String(note).padEnd(3)}|-  ||\n`;
    const text = `---\nkey: 1\norder: A A B C B D E\n---\n\n${section("A", 1, 1)}\n${section("B", 2, 3)}\n${section("C", 3, 5)}\n${section("D", 4, 6)}\n${section("E", 5, 8)}`;
    const score = parsePrisma(text);
    const xml = exportMusicXml(score, { repeats: "traditional" });
    // A reprise ; B, puis C en case 1, B à nouveau, D en case 2 ; E à la suite : chaque section écrite une fois
    expect(xml.match(/<measure /g)).toHaveLength(5);
    expect(xml.match(/<repeat direction="forward"\/>/g)).toHaveLength(2);
    expect(xml).toContain('<ending number="1" type="start">1.</ending>');
    expect(xml).toContain('<ending number="2" type="discontinue"/>');
    // relu comme l'export des sections (où A A devient, à l'import, une reprise de A)
    expect(writePrisma(importMusicXml(xml))).toBe(writePrisma(again(score)));
    // un ordre qui ne se ramène pas à des reprises se déroule
    const free = parsePrisma(text.replace("order: A A B C B D E", "order: A B C A D E"));
    expect(exportMusicXml(free, { repeats: "traditional" }).match(/<measure /g)).toHaveLength(6);
    expect(writePrisma(importMusicXml(exportMusicXml(free, { repeats: "traditional" })))).toBe(writePrisma(again(free)));
    // sans les lettres des sections, en option
    expect(xml).toContain("<rehearsal>A</rehearsal>");
    expect(exportMusicXml(score, { repeats: "traditional", letters: false })).not.toContain("<rehearsal>");
    // par défaut, les sections de Prisma, déroulées
    expect(exportMusicXml(score).match(/<measure /g)).toHaveLength(7);
  });

  it("lie les deux portées d'une partie sans confondre leurs liaisons", () => {
    const score = parsePrisma(`m1 |1  |2  |3  |4  ||
0  |1  |3  |5  |6  ||
@       (---)
---
-1 |1  |5  |8  |5  ||
@   (-----------)
`);
    expect(again(score).slurs).toEqual(score.slurs);
  });

  it("garde le tempo, la tonalité et l'en-tête", () => {
    const xml = exportMusicXml(parsePrisma("---\ntitle: Essai\ncomposer: Moi\nbpm: 90\nkey: 5:m\n---\n\nm1 |1  ||\n0  |5  ||\n"));
    const back = importMusicXml(xml);
    expect(back.meta).toMatchObject({ title: "Essai", composer: "Moi", bpm: 90, key: "5:m" });
  });
});
