import { describe, expect, it } from "vitest";
import { convertToStrings, exportMusicXml, importMusicXml, inspect, parsePrisma, writePrisma } from "../src/core/index.ts";
import type { Note } from "../src/core/index.ts";

/** Un morceau d'une partie de guitare (ou d'une autre partie déclarée), ses lignes sous la règle. */
const piece = (parts: string, lines: string[], ruler = "m1 |1  *  |2  *  |3  *  |4  *  ||") => {
  const name = parts.split(",")[0].replace(/\s*\(.*$/, "");
  // le trait sous la règle, le nom de la partie dedans, juste après la colonne de gauche
  const rule: string[] = [...ruler].map((c) => (c === "|" ? "┼" : "─"));
  while (rule.length < name.length + 7) rule.push("─");
  rule.splice(4, name.length + 2, ...` ${name} `);
  return `---\nparts: ${parts}\n---\n\n${ruler}\n${rule.join("")}─\n${lines.join("\n")}\n`;
};

const ARPEGGIO = piece("Guitare", [
  "1  |      |      |0     |      ||",
  "2  |      |   1  |   1  |      ||",
  "3  |      |2     |      |2     ||",
  "4  |   2  |      |      |   2  ||",
  "5  |0  -  |-  -  |-  -  |      ||",
]);

describe("instruments à cordes", () => {
  it("lit chaque ligne comme une corde et chaque nombre comme une case", () => {
    const s = parsePrisma(ARPEGGIO);
    expect(s.parts[0].strings).toMatchObject({ tuning: "standard", capo: 0 });
    // la, mi, la, do, mi, do, la, mi : la corde à vide plus la case
    expect(s.notes.map((n) => [n.string, n.midi])).toEqual([[5, 45], [4, 52], [3, 57], [2, 60], [1, 64], [2, 60], [3, 57], [4, 52]]);
    expect(s.notes[0].end).toBe(3 * 2880);
  });

  it("se réécrit tel quel", () => {
    const text = writePrisma(parsePrisma(ARPEGGIO));
    expect(text).toContain("5  |0  -  |-  -  |-  -  |      ||");
    expect(writePrisma(parsePrisma(text))).toBe(text);
  });

  it("prend l'accordage et le capo de la partie, et les réécrit", () => {
    const s = parsePrisma(piece("Guitare (drop-d, capo 2)", ["6  |0  |   |   |   ||"], "m1 |1  |2  |3  |4  ||"));
    expect(s.parts[0].strings).toMatchObject({ tuning: "drop-d", capo: 2 });
    expect(s.notes[0].midi).toBe(38 + 2); // ré grave, plus le capo
    expect(writePrisma(s)).toContain("parts: Guitare (drop-d, capo 2)");
    const bass = parsePrisma(piece("Basse (electric-bass)", ["4  |0  |   |   |   ||"], "m1 |1  |2  |3  |4  ||"));
    expect(bass.parts[0].strings!.open).toHaveLength(4);
    expect(bass.notes[0].midi).toBe(28);
  });

  it("garde les petites notes, les trilles et les doigtés sur leur corde", () => {
    const s = parsePrisma(piece("Guitare", ["3  |2'4  |5~7_1 |   |   ||"], "m1 |1    |2     |3  |4  ||"));
    expect(s.graces).toEqual([{ staff: 0, midi: 57, t: 0, slot: 0, string: 3 }]);
    expect(s.notes[1]).toMatchObject({ string: 3, midi: 60, trill: 62, finger: 1 });
  });

  it("refuse une corde qui n'existe pas, des cordes en désordre ou une corde écrite deux fois", () => {
    const err = (lines: string[], parts = "Guitare") => {
      try {
        parsePrisma(piece(parts, lines, "m1 |1  |2  ||"));
        return "";
      } catch (e) {
        return (e as Error).message;
      }
    };
    expect(err(["7  |0  |   ||"])).toContain("corde invalide");
    expect(err(["3  |0  |   ||", "2  |0  |   ||"])).toContain("sous la corde");
    expect(err(["3  |0  |   ||", "3  |   |0  ||"])).toContain("écrite deux fois");
    expect(err(["3  |0  |   ||", "   |   |0  ||"])).toContain("une ligne par corde");
    expect(err(["3  |25 |   ||"])).toContain("une case de 0 à 24");
    expect(err(["0  |1  |   ||"], "Piano (piano, capo 2)")).toContain("pas un instrument à cordes");
    expect(err(["3  |0  |   ||"], "Guitare (open-z)")).toContain("ni un accordage");
  });

  it("mêle une partie à cordes et une partie en octaves", () => {
    const s = parsePrisma(`---
parts: Chant, Guitare (guitar, capo 3)
---

m1 |1  |2  ||
───┼─ Chant ─┼┼
0  |5  |8  ||
═══╪═ Guitare ═╪╪
2  |1  |   ||
`);
    expect(s.notes.map((n) => [n.staff, n.string, n.midi])).toEqual([[0, undefined, 64], [1, 2, 63], [0, undefined, 67]]);
  });

  it("exporte une tablature, que l'import relit telle quelle", () => {
    // mi4 sur la 2ᵉ corde (case 3 au capo 2) plutôt qu'à vide sur la 1ʳᵉ : le choix de l'arrangeur revient
    const text = writePrisma(parsePrisma(piece("Guitare (drop-d, capo 2)", ["1  |      |      |0     |      ||", "2  |      |   3  |      |      ||", "6  |0  -  |-  -  |      |      ||"])));
    const xml = exportMusicXml(parsePrisma(text));
    expect(xml).toContain("<sign>TAB</sign>");
    expect(xml).toContain("<capo>2</capo>");
    expect(xml).toContain("<technical><string>2</string><fret>3</fret></technical>");
    // la tonalité, devinée à l'export, revient en plus
    expect(writePrisma(importMusicXml(xml)).replace(/^key: .*\n/m, "")).toBe(text);
  });

  it("met sur des cordes les notes d'une partie de guitare importée sans tablature", () => {
    // les mêmes notes en octaves, dans une partie qui ne dit son instrument qu'à l'import
    const s = parsePrisma(`m1 |1  *  |2  *  |3  *  |4  *  ||
───┼──────┼──────┼──────┼──────┼┼
0  |      |   1  |5  1  |      ||
-1 |   5  |10    |      |10 5  ||
-2 |10    |      |      |      ||
`);
    const back = importMusicXml(exportMusicXml(s).replace("<part-name>Piano</part-name>", "<part-name>Guitare</part-name>").replace(/<midi-program>\d+</, "<midi-program>25<"));
    expect(back.parts[0].strings).toBeDefined();
    expect(back.notes.every((n) => n.string !== undefined)).toBe(true);
    expect(back.notes.map((n) => n.midi)).toEqual(s.notes.map((n) => n.midi));
    // deux notes qui sonnent ensemble ne partagent jamais une corde
    for (const a of back.notes) for (const b of back.notes) if (a !== b && a.string === b.string) expect(a.end <= b.start || b.end <= a.start).toBe(true);
    expect(writePrisma(back)).toMatch(/^1 {2}\|/m);
  });

  it("lit une tablature MusicXML : ses cordes, sans la partition qui la double", () => {
    // mi4 joué sur la 2ᵉ corde, case 5 (et non sur la 1ʳᵉ à vide), puis la2 à vide ; accordage drop-d, capo 2
    const tuning = [["D", 2], ["A", 2], ["D", 3], ["G", 3], ["B", 3], ["E", 4]]
      .map(([step, octave], i) => `<staff-tuning line="${i + 1}"><tuning-step>${step}</tuning-step><tuning-octave>${octave}</tuning-octave></staff-tuning>`)
      .join("");
    const note = (staff: number, step: string, octave: number, tab = "") =>
      `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>1</duration><voice>${staff}</voice><type>quarter</type><staff>${staff}</staff>${tab}</note>`;
    const tech = (string: number, fret: number) => `<notations><technical><string>${string}</string><fret>${fret}</fret></technical></notations>`;
    const xml = `<?xml version="1.0"?><score-partwise version="4.0"><part-list><score-part id="P1"><part-name>Guitare</part-name></score-part></part-list>
<part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>2</beats><beat-type>4</beat-type></time><staves>2</staves>
<clef number="1"><sign>G</sign><line>2</line></clef><clef number="2"><sign>TAB</sign></clef>
<staff-details number="2"><staff-lines>6</staff-lines>${tuning}<capo>2</capo></staff-details></attributes>
${note(1, "F", 4)}${note(1, "B", 2)}<backup><duration>2</duration></backup>${note(2, "F", 4, tech(2, 4))}${note(2, "B", 2, tech(5, 0))}</measure></part></score-partwise>`;
    const s = importMusicXml(xml);
    expect(s.parts).toEqual([{ name: "Guitare", staves: 1, strings: { tuning: "drop-d", open: [64, 59, 55, 50, 45, 38], capo: 2 } }]);
    expect(s.notes.map((n) => [n.string, n.midi])).toEqual([[2, 65], [5, 47]]);
    expect(writePrisma(s)).toContain("parts: Guitare (drop-d, capo 2)");
  });

  it("dit dans la barre de statut la corde et la note d'une case", () => {
    const at = (line: number, column: number) => {
      const lines = ARPEGGIO.split("\n");
      const pos = lines.slice(0, line - 1).reduce((n, l) => n + l.length + 1, 0) + column - 1;
      return inspect(ARPEGGIO, pos, "latin");
    };
    expect(at(11, 1).symbol?.meaning).toBe("corde 5 : la1 à vide");
    expect(at(10, 8).symbol?.meaning).toContain("case 2 : mi2");
    expect(at(10, 8).string).toBe(4);
  });

  describe("conversion", () => {
    const DUO = `---
parts: Piano, Chant
---

m1 |1  |2  |3  |4  ||
───┼─ Piano ─┼───┼┼
0  |5  |8  |12 |-  ||
───┼───┼───┼───┼───┼┼
-1 |1  |-  |8  |-  ||
@   Ped.        *
═══╪═ Chant ═╪═══╪╪
0  |5  |6  |8  |   ||
`;
    // deux notes qui sonnent ensemble ne partagent jamais une corde
    const apart = (notes: Note[]) => notes.every((a) => notes.every((b) => a === b || a.string !== b.string || a.end <= b.start || b.end <= a.start));

    it("réunit les portées d'une partie en une partie de guitare, sur des cordes", () => {
      const { score, report } = convertToStrings(parsePrisma(DUO), 0, { instrument: "guitar", octave: 0 });
      expect(score.parts).toMatchObject([{ name: "Guitare", staves: 1, strings: { tuning: "standard", capo: 0 } }, { name: "Chant", staves: 1 }]);
      const guitar = score.notes.filter((n) => n.staff === 0);
      expect(guitar.map((n) => n.midi).sort()).toEqual([48, 55, 64, 67, 71]);
      expect(guitar.every((n) => n.string !== undefined)).toBe(true);
      expect(apart(guitar)).toBe(true);
      // le chant remonte d'une portée ; la pédale du piano disparaît
      expect(score.notes.filter((n) => n.staff === 1).map((n) => n.midi)).toEqual([64, 65, 67]);
      expect(score.pedals).toEqual([]);
      expect(report).toEqual({ octave: 0, moved: 0, dropped: 0, notes: 5 });
      // le texte converti se relit tel quel
      const text = writePrisma(score);
      expect(writePrisma(parsePrisma(text))).toBe(text);
    });

    it("rend jouable : octave voisine, unissons réunis, accords réduits à leur aigu et leur basse", () => {
      const s = parsePrisma(DUO);
      const at = (midi: number, staff = 0): Note => ({ staff, midi, start: 4 * 2880, end: 5 * 2880 });
      // un do grave hors de la guitare, et un accord de sept notes dont un unisson entre les mains
      s.beats.push(...[4, 5, 6, 7].map((i) => ({ ...s.beats[i % 4], barIndex: 1, bar: "2", label: (i % 4) + 1 })));
      s.notes.push(at(24, 1), ...[48, 52, 55, 60, 64, 67, 72].map((m) => at(m)), at(60, 1));
      const { score, report } = convertToStrings(s, 0, { instrument: "guitar", octave: 0 });
      const chord = score.notes.filter((n) => n.staff === 0 && n.start === 4 * 2880).map((n) => n.midi);
      expect(chord.length).toBeLessThanOrEqual(6);
      expect(chord).toContain(72);
      expect(chord).toContain(48);
      expect(Math.min(...chord)).toBe(48);
      expect(report.moved).toBe(1);
      expect(report.dropped).toBeGreaterThanOrEqual(2);
      expect(apart(score.notes.filter((n) => n.staff === 0))).toBe(true);
    });

    it("choisit l'octave : telle quelle ou, comme l'écriture de la guitare, une octave plus bas", () => {
      const s = parsePrisma(DUO);
      const low = convertToStrings(s, 0, { instrument: "guitar", octave: -1 });
      expect(low.score.notes.filter((n) => n.staff === 0).map((n) => n.midi).sort()).toEqual([43, 48, 52, 55, 59]);
      // le do2 descendu sous le mi grave remonte : une note déplacée
      expect(low.report).toMatchObject({ octave: -1, moved: 1 });
      expect([0, -1]).toContain(convertToStrings(s, 0, { instrument: "guitar" }).report.octave);
      const bass = convertToStrings(s, 0, { instrument: "electric-bass", octave: 0 });
      expect(bass.score.parts[0]).toMatchObject({ name: "Basse", instrument: "electric-bass" });
      expect(bass.score.parts[0].strings!.open).toHaveLength(4);
    });
  });
});
