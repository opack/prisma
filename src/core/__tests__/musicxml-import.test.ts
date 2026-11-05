import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { importMusicXml, parsePrisma, TICKS_PER_BEAT as T } from "../index.ts";
import { playOrder, sectionsOf } from "../musicxml.ts";
import { C4, musicXml, q } from "../../../tests/support/musicxml.ts";
import { roundTrip } from "../../../tests/support/round-trip.ts";

describe("Gymnopédie n°1", () => {
  const score = importMusicXml(readFileSync(new URL("../../../tests/fixtures/gymnopedie1.musicxml", import.meta.url), "utf8"));

  it("importe 78 mesures de 3 temps", () => {
    expect(new Set(score.beats.map((b) => b.barIndex)).size).toBe(78);
    expect(score.beats.length).toBe(78 * 3);
  });

  it("fusionne la tenue du fa♯ des mesures 9 à 12", () => {
    const fa = score.notes.find((n) => n.staff === 0 && n.midi === 66 && n.start === 8 * 3 * T);
    expect(fa?.end).toBe(12 * 3 * T);
  });

  it.each([40, 60, 96, 140])("survit à l'aller-retour à %i caractères", (w) => {
    const { text } = roundTrip(score, w);
    for (const line of text.split("\n")) if (line.startsWith("m")) expect(line.length).toBeLessThanOrEqual(w);
  });
});

describe("ordre de jeu du MusicXML", () => {
  const m = { startRepeat: false, endRepeat: false, times: 2 };
  const st = (kind: string, at = 1) => ({ structure: [{ kind, id: "", at } as never], length: 4 });

  it("déroule une reprise simple", () => {
    expect(playOrder([m, { ...m, startRepeat: true }, { ...m, endRepeat: true }, m])).toEqual([0, 1, 2, 1, 2, 3]);
  });

  it("déroule les cases 1 et 2", () => {
    expect(playOrder([m, m, { ...m, endRepeat: true, endings: [1] }, { ...m, endings: [2] }, m])).toEqual([0, 1, 2, 0, 1, 3, 4]);
  });

  it("joue la case 2 placée après la mesure de la reprise, hors de la case 1", () => {
    // case 1 (mesure 1), mesure 2 commune aux deux passages qui termine la reprise, case 2 (mesure 3)
    const ms = [m, { ...m, endings: [1] }, { ...m, endRepeat: true }, { ...m, endings: [2] }, m];
    expect(playOrder(ms)).toEqual([0, 1, 2, 0, 2, 3, 4]);
  });

  it("déroule un D.C. al Fine, sans refaire les reprises", () => {
    const ms = [m, { ...m, endRepeat: true, ...st("fine") }, m, { ...m, ...st("dacapo") }];
    expect(playOrder(ms)).toEqual([0, 1, 0, 1, 2, 3, 0, 1]);
  });

  it("déroule un D.S. al Coda", () => {
    const ms = [m, { ...m, ...st("segno", 0) }, { ...m, ...st("tocoda") }, { ...m, ...st("dalsegno") }, { ...m, ...st("coda", 0) }];
    expect(playOrder(ms)).toEqual([0, 1, 2, 3, 1, 2, 4]);
  });

  it("découpe en sections : un corps, puis deux fins", () => {
    // reprise à cases : corps (0), case 1 (1), case 2 (2)
    const s = sectionsOf([0, 1, 0, 2], 3);
    expect(s.markers.map((x) => `${x.label}@${x.barIndex}`)).toEqual(["A@0", "B@1", "C@2"]);
    expect(s.order).toEqual(["A", "B", "A", "C"]);
    expect(s.repeats).toEqual([]);
  });

  it("garde en reprise simple une section toujours jouée deux fois de suite", () => {
    // mesures 1 et 2 répétées au milieu d'un morceau joué d'un bout à l'autre
    const s = sectionsOf([0, 1, 2, 1, 2, 3], 4);
    expect(s.markers).toEqual([]);
    expect(s.repeats).toEqual([{ barIndex: 1, start: true }, { barIndex: 2, end: true }]);
  });

  it("garde chaque reprise à sa place quand des reprises qui se suivent forment une seule section", () => {
    // ||: 0 1 :||: 2 :|| 3, comme le début de la Marche turque
    const s = sectionsOf([0, 1, 0, 1, 2, 2, 3], 4);
    expect(s.markers).toEqual([]);
    expect(s.repeats).toEqual([{ barIndex: 0, start: true }, { barIndex: 1, end: true }, { barIndex: 2, start: true, end: true }]);
  });

  it("ne fait pas une reprise d'une section rejouée seule après un D.C.", () => {
    const s = sectionsOf([0, 0, 1, 0], 2);
    expect(s.order).toEqual(["A", "A", "B", "A"]);
    expect(s.repeats).toEqual([]);
  });

  it("importe une structure avec reprises, cases et D.C. al Fine", () => {
    const words = (w: string) => `<direction><direction-type><words>${w}</words></direction-type><staff>1</staff></direction>`;
    const bar = (extra: object = {}, end?: string) => ({ notes: [[{ midi: [C4], dur: 2 * q }, { midi: [C4], dur: 2 * q, before: end }]], ...extra });
    const xml = musicXml([
      bar(),
      bar({ barline: `<repeat direction="backward"/>` }, words("Fine")),
      bar({ barlineLeft: `<repeat direction="forward"/>` }),
      bar({ barlineLeft: `<ending number="1" type="start"/>`, barline: `<ending number="1" type="stop"/><repeat direction="backward"/>` }),
      bar({ barlineLeft: `<ending number="2" type="start"/>`, barline: `<ending number="2" type="stop"/>` }, words("D.C. al Fine")),
    ]);
    const s = importMusicXml(xml);
    expect(s.markers.map((x) => `${x.label}@${x.barIndex}`)).toEqual(["A@0", "B@2", "C@3", "D@4"]);
    expect(s.order.join(" ")).toBe("A A B C B D A");
    expect(s.texts).toEqual([]);
    const { text } = roundTrip(s);
    expect(text).toContain("order: A A B C B D A");
    expect(parsePrisma(text).order).toEqual(s.order);
  });

  it("ferme à la reprise suivante une 2e case restée ouverte", () => {
    const bar = (extra: object = {}) => ({ notes: [[{ midi: [C4], dur: 4 * q }]], ...extra });
    // ||: 1 | 1re case :|| 2e case (jamais fermée) ||: 4 | 1re case :|| 2e case | 7
    const xml = musicXml([
      bar(),
      bar({ barlineLeft: `<ending number="1" type="start"/>`, barline: `<ending number="1" type="stop"/><repeat direction="backward"/>` }),
      bar({ barlineLeft: `<ending number="2" type="start"/>` }),
      bar({ barlineLeft: `<repeat direction="forward"/>` }),
      bar({ barlineLeft: `<ending number="1" type="start"/>`, barline: `<ending number="1" type="stop"/><repeat direction="backward"/>` }),
      bar({ barlineLeft: `<ending number="2" type="start"/>`, barline: `<ending number="2" type="discontinue"/>` }),
      bar(),
    ]);
    const s = importMusicXml(xml);
    expect(s.markers.map((x) => `${x.label}@${x.barIndex}`)).toEqual(["A@0", "B@1", "C@2", "D@3", "E@4", "F@5"]);
    expect(s.order.join(" ")).toBe("A B A C D E D F");
  });
});

describe("instruments transpositeurs", () => {
  it("importe la hauteur qui sonne : une clarinette en si bémol écrite ré sonne do", () => {
    const xml = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Clarinette</part-name></score-part></part-list>
      <part id="P1"><measure number="1"><attributes><divisions>1</divisions><key><fifths>2</fifths></key><time><beats>2</beats><beat-type>4</beat-type></time>
      <transpose><diatonic>-1</diatonic><chromatic>-2</chromatic></transpose></attributes>
      <note><pitch><step>D</step><octave>4</octave></pitch><duration>1</duration><notations><ornaments><trill-mark/></ornaments></notations></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
    const s = importMusicXml(xml);
    // ré écrit → do ; sa voisine de trille (mi écrit, dans l'armure de ré majeur) → ré
    expect(s.notes.map((n) => [n.midi, n.trill])).toEqual([
      [60, 62],
      [62, undefined],
    ]);
  });

  it("tient compte d'un changement d'octave (saxophone ténor : une neuvième plus bas)", () => {
    const xml = `<?xml version="1.0"?><score-partwise version="3.1"><part-list><score-part id="P1"><part-name>Sax</part-name></score-part></part-list>
      <part id="P1"><measure number="1"><attributes><divisions>1</divisions><time><beats>1</beats><beat-type>4</beat-type></time>
      <transpose><diatonic>-1</diatonic><chromatic>-2</chromatic><octave-change>-1</octave-change></transpose></attributes>
      <note><pitch><step>D</step><octave>5</octave></pitch><duration>1</duration></note></measure></part></score-partwise>`;
    expect(importMusicXml(xml).notes.map((n) => n.midi)).toEqual([60]);
  });
});
