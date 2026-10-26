import { readFileSync } from "node:fs";
import { beforeAll, describe, expect, it } from "vitest";
import { FORMAT_VERSION, TICKS_PER_BEAT as T, guessKey, importMusicXml, keyName, keysOfSignature, layout, parseKey, parsePrisma, prismaKey, writePrisma } from "../src/core/index.ts";
import type { Align, Score } from "../src/core/index.ts";
import { playOrder, sectionsOf } from "../src/core/musicxml.ts";
import { chordName, chordNameNotes, chordNotes, chordPrismaName } from "../src/core/chords.ts";
import { splitChord } from "../src/app/score/engrave.ts";
import { musicXml, q } from "./helpers.ts";

const C4 = 60;
const notesKey = (s: Score) => s.notes.map((n) => `${n.staff}:${n.midi}@${n.start}-${n.end}`).join(" ");
const beatsKey = (s: Score) => s.beats.map((b) => `${b.bar}.${b.label}`).join(" ");

/** L'aller-retour .prisma doit retrouver exactement les mêmes notes et les mêmes temps. */
function roundTrip(score: Score, width = 96) {
  const text = writePrisma(score, { width });
  const back = parsePrisma(text);
  expect(notesKey(back)).toBe(notesKey(score));
  expect(beatsKey(back)).toBe(beatsKey(score));
  return { text, back };
}

describe("Gymnopédie n°1", () => {
  const score = importMusicXml(readFileSync(new URL("./fixtures/gymnopedie1.musicxml", import.meta.url), "utf8"));

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

describe("règles du format", () => {
  it("rappelle la note tenue en début de système avec « -N »", () => {
    // une ronde de do sur deux mesures liées, à 24 caractères par ligne : une mesure par système
    const xml = musicXml([
      { notes: [[{ midi: [C4], dur: 4 * q, tie: ["start"] }]] },
      { notes: [[{ midi: [C4], dur: 4 * q, tie: ["stop"] }]] },
    ]);
    const score = importMusicXml(xml);
    expect(score.notes).toHaveLength(1);
    const { text } = roundTrip(score, 24);
    const rows = text.split("\n").filter((l) => l.startsWith("0 "));
    expect(rows[0]).toMatch(/^0\s+\|1 /);
    expect(rows[1]).toMatch(/^0\s+\|-1 /);
  });

  it("commence une anacrouse au bon temps", () => {
    const xml = musicXml([
      { time: [3, 4], implicit: true, notes: [[{ midi: [67], dur: q }]] },
      { notes: [[{ midi: [C4], dur: 3 * q }]] },
    ]);
    const score = importMusicXml(xml);
    expect(beatsKey(score)).toBe("0.3 1.1 1.2 1.3");
    expect(score.notes[0].start).toBe(0);
    const { text } = roundTrip(score);
    expect(text).toMatch(/^m0 \|3  \|\|1 /m);
  });

  it("numérote 1 une anacrouse que le fichier compte comme mesure 1", () => {
    const score = importMusicXml(
      musicXml([
        { time: [3, 4], notes: [[{ midi: [67], dur: q }]] },
        { notes: [[{ midi: [60], dur: 3 * q }]] },
      ]),
    );
    expect(beatsKey(score)).toBe("1.3 2.1 2.2 2.3");
    roundTrip(score);
  });

  it("compte le 6/8 en deux temps ternaires", () => {
    const e = q / 2;
    const xml = musicXml([
      { time: [6, 8], notes: [[...[60, 62, 64, 65, 67, 69].map((m) => ({ midi: [m], dur: e }))]] },
    ]);
    const score = importMusicXml(xml);
    expect(score.beats).toHaveLength(2);
    expect(score.beats.every((b) => b.division === 3)).toBe(true);
    const { text } = roundTrip(score);
    expect(text).toContain("|1  *  *  |2  *  *  ||");
    expect(text).toContain("division: 3");
  });

  it("nomme les doubles croches du 6/8 avec « . »", () => {
    const s = q / 4;
    const xml = musicXml([{ time: [6, 8], notes: [[...Array(12)].map((_, i) => ({ midi: [60 + i], dur: s }))] }]);
    const { text } = roundTrip(importMusicXml(xml));
    expect(text).toContain("|1  .  *  .  *  .  |2  .  *  .  *  .  ||");
  });

  it("traite un triolet en 4/4 comme un temps ternaire", () => {
    const t = q / 3;
    const xml = musicXml([
      { notes: [[{ midi: [60], dur: q }, { midi: [62], dur: t }, { midi: [64], dur: t }, { midi: [65], dur: t }, { midi: [67], dur: 2 * q }]] },
    ]);
    const { text } = roundTrip(importMusicXml(xml));
    expect(text).toContain("|1  |2  *  *  |3  |4  ||");
  });

  it("garde l'alignement d'un 2 contre 3 entre les portées", () => {
    const xml = musicXml([
      {
        notes: [
          [{ midi: [72], dur: q / 2 }, { midi: [74], dur: q / 2 }, { midi: [76], dur: 3 * q }],
          [{ midi: [48], dur: q / 3, staff: 2 }, { midi: [52], dur: q / 3, staff: 2 }, { midi: [55], dur: q / 3, staff: 2 }, { midi: [48], dur: 3 * q, staff: 2 }],
        ],
      },
    ]);
    roundTrip(importMusicXml(xml));
  });

  it("coupe une mesure trop large sur un temps", () => {
    const s = q / 4;
    const xml = musicXml([{ notes: [[...Array(16)].map((_, i) => ({ midi: [60 + (i % 12)], dur: s }))] }]);
    const { text } = roundTrip(importMusicXml(xml), 40);
    expect(text).toMatch(/^m1 \|3 /m); // le second système reprend la mesure 1 au temps 3
  });

  it("met une note seule sur la ligne du haut de son couloir, même si un accord suit", () => {
    // do5 seul, puis l'accord do5-mi5-sol5 : l'ancien tri par hauteur moyenne
    // plaçait le do5 seul sur la ligne du milieu
    const xml = musicXml([{ notes: [[{ midi: [72], dur: 4 * q }]] }, { notes: [[{ midi: [72, 76, 79], dur: 4 * q }]] }]);
    const { text } = roundTrip(importMusicXml(xml));
    const rows = text.split("\n").filter((l) => /^(\+1| ) *\|/.test(l) && !l.startsWith("m"));
    expect(rows[0]).toMatch(/^\+1 \|1 /);
    expect(rows.map((r) => r.slice(-15))).toEqual(["|-  |-  ||8  |-  |-  |-  ||".slice(-15), "|   |   ||5  |-  |-  |-  ||".slice(-15), "|   |   ||1  |-  |-  |-  ||".slice(-15)]);
  });

  it("calcule le décalage qui centre un bloc dans son couloir", () => {
    const xml = musicXml([{ notes: [[{ midi: [72], dur: 4 * q }]] }, { notes: [[{ midi: [72, 76, 79], dur: 4 * q }]] }]);
    const [sys] = layout(importMusicXml(xml), { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 });
    // couloir de 3 lignes : la note seule (mesure 1) descend d'une ligne, l'accord (mesure 2) ne bouge pas
    expect(sys.staves[0].rows[0].center[0]).toBe(1);
    expect(sys.staves[0].rows[0].center[4]).toBe(0);
  });

  it("place les accords d'une même octave sur plusieurs lignes", () => {
    const xml = musicXml([{ notes: [[{ midi: [60, 64, 67], dur: 4 * q }]] }]);
    const { text } = roundTrip(importMusicXml(xml));
    const rows = text.split("\n").filter((l) => /^[ 0]\s*\|[^─]/.test(l) && !l.startsWith("m"));
    expect(rows.map((r) => r.slice(0, 7))).toEqual(["0  |8  ", "   |5  ", "   |1  "]);
  });
});

describe("reprises", () => {
  const n = (p: number) => ({ notes: [[{ midi: [p], dur: 4 * q }]] });

  it("écrit ||: :|| et :||: sur la règle et sur chaque ligne de notes", () => {
    const xml = musicXml([
      n(60),
      { ...n(62), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward"/>` },
      { ...n(64), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward"/>` },
      n(65),
    ]);
    const score = importMusicXml(xml);
    expect(score.repeats).toEqual([
      { barIndex: 1, start: true, end: true },
      { barIndex: 2, start: true, end: true },
    ]);
    expect(score.markers).toEqual([]); // reprises simples : pas de section
    const { text } = roundTrip(score);
    const ruler = text.split("\n").find((l) => l.startsWith("m1"))!;
    expect(ruler).toMatch(/\|\|:1 .*:\|\|:1 .*:\|\|1 /);
    const row = text.split("\n").find((l) => l.startsWith("0 "))!;
    expect(row.replace(/[^|:]/g, "")).toBe(ruler.replace(/[^|:]/g, ""));
  });

  it("met « ||: » en tête du système suivant quand la reprise commence après un saut de ligne", () => {
    const xml = musicXml([n(60), n(62), { ...n(64), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward"/>` }]);
    const { text } = roundTrip(importMusicXml(xml), 30);
    expect(text).toMatch(/^m3 \|\|:1 /m);
  });

  it("note le nombre de passages « 3× »", () => {
    const xml = musicXml([{ ...n(60), barlineLeft: `<repeat direction="forward"/>`, barline: `<repeat direction="backward" times="3"/>` }]);
    const score = importMusicXml(xml);
    expect(score.repeats[0].times).toBe(3);
    const { text } = roundTrip(score);
    expect(text).toContain("3×");
  });

  it("lit une reprise écrite à la main, sans les deux points sur les lignes de notes", () => {
    const s = parsePrisma("m1 ||:1  |2  :||1  |2  ||\n0  ||:1  |-   ||5  |   ||\n---\n-1 || 1  |    ||1  |   ||\n");
    expect(s.repeats).toEqual([{ barIndex: 0, start: true, end: true }]);
  });

  it("marque la dernière barre du morceau comme barre de fin", () => {
    const s = parsePrisma("m1 |1  ||1  ||1  ||1  ||\n0  |1  ||1  ||1  ||1  ||\n---\n");
    const sys = layout(s, { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 })[0];
    const bars = sys.columns.filter((c) => c.kind === "barSep");
    expect(bars.map((c) => !!(c as { final?: boolean }).final)).toEqual([false, false, false, true]);
  });

  it("garde les textes de la ligne @", () => {
    const s = parsePrisma("@   rit.     a tempo\nm1 |1  |2  ||1  ||\n0  |1  |   ||1  ||\n---\n");
    expect(s.texts.map((t) => t.text)).toEqual(["rit.", "a tempo"]);
    expect(writePrisma(s)).toMatch(/^@ +rit\. +a tempo$/m);
  });

  it("refuse une indication qui ne commence pas sur une case", () => {
    expect(() => parsePrisma("@     rit.\nm1 |1  |2  ||\n0  |1  |   ||\n---\n")).toThrow(/doit commencer exactement sur une case/);
  });

  it("refuse « 3× » hors d'une fin de reprise", () => {
    expect(() => parsePrisma("@   3×\nm1 |1  ||\n0  |1  ||\n---\n")).toThrow(/:\|\|/);
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

describe("sections", () => {
  const ruler = "m1 |1  ||1  ||1  ||1  ||";
  const bar = [...ruler.matchAll(/\|\|/g)].map((m) => m.index!);
  const at = (...signs: [number, string][]) => {
    let l = "@";
    for (const [col, text] of signs) l = l.padEnd(col) + text;
    return l;
  };
  const piece = (order: string, top: string, r = ruler, notes = "0  |1  ||1  ||1  ||1  ||") =>
    `${order ? `---\norder: ${order}\n---\n` : ""}${top}\n${r}\n${notes}\n---\n`;

  it("lit les sections et l'ordre de jeu", () => {
    const s = parsePrisma(piece("A B A", at([3, "[A]"], [bar[1] + 1, "[B]"])));
    expect(s.markers).toEqual([{ label: "A", barIndex: 0 }, { label: "B", barIndex: 2 }]);
    expect(s.order).toEqual(["A", "B", "A"]);
    expect(s.meta.order).toBeUndefined();
  });

  it("commence chaque section sur un nouveau système, et ferme la précédente d'une double barre", () => {
    const s = parsePrisma(piece("A B A", at([3, "[A]"], [bar[1] + 1, "[B]"])));
    const systems = layout(s, { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 });
    expect(systems.map((x) => x.section)).toEqual(["A", "B"]);
    expect(systems.map((x) => x.endsSection)).toEqual([true, false]);
    const bars = systems[0].columns.filter((c) => c.kind === "barSep") as { section?: boolean }[];
    expect(bars.map((c) => !!c.section)).toEqual([false, true]);
    // à l'écriture aussi : la section B ouvre le second système
    expect(writePrisma(s)).toMatch(/\n\n@  \[B\]\nm3 \|/);
  });

  it("à la suite : une section suit la précédente sur la même ligne, séparée par un blanc", () => {
    const s = parsePrisma(piece("A B A", at([3, "[A]"], [bar[1] + 1, "[B]"])));
    const metrics = { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 };
    const [one, ...rest] = layout(s, { ...metrics, sectionSep: 4 });
    expect(rest).toEqual([]);
    expect(one.section).toBe("A");
    const bars = one.columns.filter((c) => c.kind === "barSep") as { section?: boolean; spaced?: boolean }[];
    expect(bars.map((c) => [!!c.section, !!c.spaced])).toEqual([[false, false], [true, true], [false, false], [false, false]]);
    // la lettre de B contre la barre qui l'ouvre ; 4 de plus que la ligne ordinaire
    const opening = one.columns.findIndex((c) => c.kind === "barSep" && c.spaced);
    expect(one.marks.filter((m) => m.kind === "marker").map((m) => [m.label, m.column])).toEqual([["A", -1], ["B", opening]]);
    const plain = layout(parsePrisma(piece("", "", ruler)), metrics)[0];
    expect(one.width - plain.width).toBe(4);
  });

  it("refuse un ordre de jeu qui nomme une section absente", () => {
    expect(() => parsePrisma(piece("A C", at([3, "[A]"], [bar[1] + 1, "[B]"])))).toThrow(/aucune section « \[C\] »/);
  });

  it("refuse une section que l'ordre de jeu ne joue jamais", () => {
    expect(() => parsePrisma(piece("A A", at([3, "[A]"], [bar[1] + 1, "[B]"])))).toThrow(/section « \[B\] » n'est jamais jouée/);
    expect(() => parsePrisma(piece("", at([3, "[A]"], [bar[1] + 1, "[B]"])))).not.toThrow();
  });

  it("refuse un morceau qui commence avant sa première section", () => {
    expect(() => parsePrisma(piece("B", at([bar[1] + 1, "[B]"])))).toThrow(/première mesure/);
  });

  it("refuse une reprise à cheval sur deux sections", () => {
    const r = "m1 ||:1  ||1  ||1  :||1  ||";
    const b = [...r.matchAll(/\|\|/g)].map((m) => m.index!);
    const notes = "0  ||:1  ||1  ||1  :||1  ||";
    expect(() => parsePrisma(piece("A B", at([4, "[A]"], [b[1] + 1, "[B]"]), r, notes))).toThrow(/reprise passe le début de la section « \[B\] »/);
  });
});

describe("erreurs de saisie", () => {
  const base = (body: string) => `m1 |1  |2  ||\n───┼───┼───┼┼\n${body}`;
  const err = (txt: string) => {
    try {
      parsePrisma(txt);
    } catch (e) {
      return (e as Error).message;
    }
    return "aucune erreur";
  };

  it("accepte une seule portée, sans aucun trait", () => {
    const s = parsePrisma("m1 |1  |2  ||\n0  |1  |-  ||\n");
    expect(s.parts).toEqual([{ staves: 1 }]);
    expect(s.notes).toEqual([{ staff: 0, midi: 60, start: 0, end: 2 * T }]);
  });
  it("signale une étiquette de case inconnue", () => {
    expect(err("m1 |1  x  |2  ||\n───\n0  |1     |-  ||\n───")).toMatch(/ligne 1, col\. 8 : étiquette de case « x » inconnue/);
  });
  it("refuse un « - » en début de système", () => {
    expect(err(base("0  |-  |   ||\n───┼───┼───┼┼"))).toMatch(/ligne 3.*écrivez le numéro de la note/);
  });
  it("refuse un numéro hors de 1 à 12", () => {
    expect(err(base("0  |13 |   ||\n───┼───┼───┼┼"))).toMatch(/ligne 3, col\. 5 : case invalide « 13 »/);
  });
  it("demande l'octave sur la première ligne d'une portée", () => {
    expect(err(base("   |1  |   ||\n───┼───┼───┼┼"))).toMatch(/indiquer son octave/);
  });
  it("lit les octaves relatives au do central", () => {
    const s = parsePrisma("m1 |1  ||\n+1 |1  ||\n0  |1  ||\n---\n-1 |1  ||\n-2 |1  ||\n");
    expect(s.notes.map((n) => n.midi)).toEqual([72, 60, 48, 36]);
  });
  it("écrit les octaves relatives au do central", () => {
    const text = writePrisma(parsePrisma("m1 |1  ||\n+1 |1  ||\n---\n-1 |1  ||\n"));
    expect(text).toContain("+1 |1  ||");
    expect(text).toContain("-1 |1  ||");
  });
  it("refuse un numéro d'octave sans signe", () => {
    expect(err("m1 |1  ||\n4  |1  ||\n---\n")).toMatch(/octave invalide/);
  });
  it("refuse une octave mal écrite", () => {
    expect(err("m1 |1  ||\n+a |1  ||\n---\n")).toMatch(/octave invalide/);
  });
  it("lit et écrit le frontmatter en anglais", () => {
    const s = parsePrisma("---\ntitle: Essai\ncomposer: Moi\ncell: 3\n---\nm1 |1  ||\n0  |1  ||\n---\n");
    expect(s.meta).toMatchObject({ title: "Essai", composer: "Moi", cell: 3 });
    const text = writePrisma(s);
    expect(text).toContain("title: Essai");
    expect(text).toContain("composer: Moi");
  });
  it("accepte une saisie minimale à la main", () => {
    const s = parsePrisma("m1 |1  |2  ||\n0  |5  |-  ||\n---\n-1 |1  |   ||\n");
    expect(notesKey(s)).toBe(`0:64@0-${2 * T} 1:48@0-${T}`);
  });
});

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

describe("pédale", () => {
  const pk = (s: Score) => s.pedals.map((p) => `${p.start / T}-${p.end / T}`).join(" ");
  /** Ligne @ avec chaque signe à sa colonne : évite de compter les espaces à la main. */
  const at = (...signs: [number, string][]) => {
    let l = "@";
    for (const [col, text] of signs) l = l.padEnd(col) + text;
    return l;
  };
  const ruler = "m1 |1  |2  |3  ||1  |2  |3  ||";
  const body = (pedal: string) => [ruler, "0  |1  |   |   ||3  |   |   ||", "---", "-1 |1  |-  |-  ||8  |-  |-  ||", pedal, ""].join("\n");

  it("lit Ped., *Ped. et * sous la main gauche", () => {
    const s = parsePrisma(body(at([4, "Ped."], [17, "*Ped."], [25, "*"])));
    expect(pk(s)).toBe("0-3 3-5");
  });

  it("écrit la pédale sur sa propre ligne, tout en bas, et la relit à l'identique", () => {
    const s = parsePrisma(body(at([4, "Ped."], [17, "*Ped."], [25, "*"])));
    const text = writePrisma(s);
    expect(text.trimEnd().split("\n").pop()).toMatch(/^@ +Ped\. +\*Ped\. +\*$/);
    expect(pk(parsePrisma(text))).toBe(pk(s));
  });

  it("tient la pédale d'un système au suivant sans la réécrire", () => {
    const bars = Array.from({ length: 8 }, () => "1  |2  |3  ||").join("");
    const notes = Array.from({ length: 8 }, () => "1  |   |   ||").join("");
    const s = parsePrisma(`m1 |${bars}\n---\n-1 |${notes}\n${at([4, "Ped."])}\n`);
    expect(pk(s)).toBe("0-24"); // jamais relâchée : jusqu'à la fin du morceau
    const text = writePrisma(s, { width: 40 });
    expect(text.match(/Ped\./g)?.length).toBe(1);
    expect(pk(parsePrisma(text))).toBe("0-24");
  });

  it("refuse les signes de pédale incohérents", () => {
    expect(() => parsePrisma(body(at([4, "*"])))).toThrow(/sans pédale enfoncée/);
    expect(() => parsePrisma(body(at([4, "Ped."], [12, "Ped."])))).toThrow(/déjà enfoncée/);
    const rh = [ruler, "0  |1  |   |   ||3  |   |   ||", at([4, "Ped."]), "---", "-1 |1  |   |   ||8  |   |   ||", ""].join("\n");
    expect(() => parsePrisma(rh)).toThrow(/sous la dernière portée de sa partie/);
  });

  it("importe la pédale du MusicXML", () => {
    const ped = (type: string) => `<direction><direction-type><pedal type="${type}" line="yes"/></direction-type><staff>2</staff></direction>`;
    const xml = musicXml([
      {
        time: [3, 4],
        notes: [
          [{ midi: [C4], dur: 3 * q }],
          [
            { midi: [48], dur: q, staff: 2, before: ped("start") },
            { midi: [52], dur: q, staff: 2 },
            { midi: [55], dur: q, staff: 2, before: ped("change") },
          ],
        ],
      },
      { notes: [[{ midi: [C4], dur: 3 * q }], [{ midi: [48], dur: 3 * q, staff: 2, before: ped("stop") }]] },
    ]);
    const s = importMusicXml(xml);
    expect(pk(s)).toBe("0-2 2-3");
    expect(pk(parsePrisma(writePrisma(s)))).toBe("0-2 2-3");
  });
});

describe("cases de largeur libre", () => {
  const expr = (s: Score) => s.expressions.map((e) => `${e.staff}:${e.kind}:${e.text}@${e.t / T}`).join(" ");

  it("lit une case élargie : une case va d'une étiquette à la suivante", () => {
    const s = parsePrisma("m1 |1      *  |2  ||\n0  |1      3  |5  ||\n---\n");
    expect(notesKey(s)).toBe(`0:60@0-${T / 2} 0:62@${T / 2}-${T} 0:64@${T}-${2 * T}`);
  });

  it("nomme « , » les cases plus fines que « . »", () => {
    const s = parsePrisma("m1 |1  ,  .  ,  *  ,  .  ,  ||\n0  |1  2  3  4  5  6  7  8  ||\n---\n");
    expect(s.notes.length).toBe(8);
    expect(writePrisma(s)).toContain("|1  ,  .  ,  *  ,  .  ,  ||");
  });

  it("élargit la case d'une indication trop longue, plutôt que d'empiler les lignes @", () => {
    const s = parsePrisma("m1 |1  *  |2  *  ||\n0  |1  3  |5  7  ||\n@   (mp)\n---\n");
    s.expressions.push({ staff: 0, t: T / 2, text: "dolce", kind: "text" }, { staff: 0, t: T, text: "cresc.", kind: "text" });
    const text = writePrisma(s);
    expect(text.split("\n").filter((l) => l.startsWith("@")).length).toBe(1);
    expect(text).toMatch(/^@ +\(mp\) +dolce +cresc\.$/m);
    expect(expr(parsePrisma(text))).toBe("0:dynamic:(mp)@0 0:text:dolce@0.5 0:text:cresc.@1");
  });

  it("réunit une nuance et ses parenthèses écrites à part dans le MusicXML", () => {
    const dyn = (inner: string) => `<direction><direction-type><dynamics>${inner}</dynamics></direction-type><staff>1</staff></direction>`;
    const before = dyn("<other-dynamics>(</other-dynamics>") + dyn("<mp/>") + dyn("<other-dynamics>)</other-dynamics>");
    const s = importMusicXml(musicXml([{ notes: [[{ midi: [C4], dur: 4 * q, before }]] }]));
    expect(expr(s)).toBe("0:dynamic:(mp)@0");
  });

  it("garde « Ped. simile » comme un seul texte", () => {
    const s = parsePrisma("m1 |1  |2  ||\n0  |1  |   ||\n---\n-1 |1  |   ||\n@   Ped. simile\n");
    expect(s.pedalTexts.map((e) => e.text)).toEqual(["Ped. simile"]);
    expect(s.pedals).toEqual([]);
    expect(parsePrisma(writePrisma(s)).pedalTexts.map((e) => e.text)).toEqual(["Ped. simile"]);
  });

  it("cale un septolet sur 8 cases plutôt que sur 48", () => {
    // 7 notes dans une noire : impossibles à écrire exactement
    const notes = Array.from({ length: 7 }, (_, k) => ({ midi: [C4 + k], dur: 12 }));
    const s = importMusicXml(musicXml([{ time: [1, 4], notes: [notes] }], 84));
    expect(s.notes.map((n) => n.start / (T / 8))).toEqual([0, 1, 2, 3, 5, 6, 7]);
    const { text } = roundTrip(s);
    expect(text).toContain("|1  ,  .  ,  *  ,  .  ,  ||");
  });

  it("ignore les petites notes de réplique et les notes cachées, sans décaler le temps", () => {
    // 2e voix : un sol caché, puis un la qui doit rester au 3e temps
    const xml = musicXml([{ notes: [[{ midi: [C4], dur: 4 * q }], [{ midi: [67], dur: 2 * q }, { midi: [69], dur: 2 * q }]] }])
      .replace(/<note>(<pitch><step>G<\/step>)/, '<note print-object="no">$1');
    const s = importMusicXml(xml);
    expect(s.notes.map((n) => `${n.midi}@${n.start / T}`)).toEqual(["60@0", "69@2"]);
  });

  it("écrit un soufflet juste après la nuance de la même case", () => {
    const s = parsePrisma("m1 |1  |2  |3  ||\n0  |1  |3  |5  ||\n@   p <-------\n---\n");
    expect(s.hairpins).toEqual([{ staff: 0, kind: "<", start: 0, end: 3 * T }]);
    const text = writePrisma(s);
    expect(text.split("\n").filter((l) => l.startsWith("@")).length).toBe(1);
    expect(text).toMatch(/^@ +p <-+$/m);
    expect(parsePrisma(text).hairpins).toEqual(s.hairpins);
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

describe("petites notes", () => {
  const gk = (s: Score) => s.graces.map((g) => `${g.staff}:${g.midi}@${g.t / T}#${g.slot}`).join(" ");
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
            { midi: [C4 + 2], dur: 0, grace: "slash" },
            { midi: [C4 + 4], dur: 0, grace: true },
            { midi: [C4], dur: 2 * q },
            { midi: [C4 + 7, C4 + 11], dur: 0, grace: true },
            { midi: [C4 + 12], dur: 2 * q },
          ],
          [{ midi: [48], dur: 4 * q, staff: 2 }],
        ],
      },
    ]);
    const s = importMusicXml(xml);
    expect(gk(s)).toBe("0:62@0#0 0:64@0#1 0:71@2#0 0:67@2#0");
    expect(notesKey(s)).toBe("0:60@0-5760 1:48@0-11520 0:72@5760-11520");
    expect(gk(roundTrip(s).back)).toBe(gk(s));
  });
});

describe("consignes de pédale", () => {
  const ruler = "m1 |1  |2  |3  ||1  |2  |3  ||";
  const piece = (rh: string, lh: string) => [ruler, "0  |1  |   |   ||3  |   |   ||", rh, "---", "-1 |1  |-  |-  ||8  |-  |-  ||", lh, ""].join("\n");

  it("lit « Ped. simile » comme une consigne de pédale, et l'écrit sur la ligne de pédale", () => {
    const s = parsePrisma(piece("", "@   Ped.         *   Ped. simile").replace("\n\n---", "\n---"));
    expect(s.pedalTexts).toEqual([{ staff: 1, t: 4 * T, text: "Ped. simile" }]);
    expect(s.expressions).toEqual([]);
    const text = writePrisma(s);
    expect(text.trimEnd().split("\n").pop()).toMatch(/^@ +Ped\. +\* +Ped\. simile$/);
    expect(parsePrisma(text).pedalTexts).toEqual(s.pedalTexts);
  });

  it("refuse une consigne de pédale sous la main droite", () => {
    expect(() => parsePrisma(piece("@   Ped. simile", ""))).toThrow(/sous la dernière portée de sa partie/);
  });

  it("donne son signe à une nuance écrite en toutes lettres, et garde le texte", () => {
    const dir = `<direction><direction-type><words>sempre pianissimo e senza sordini</words></direction-type><staff>1</staff></direction>`;
    const s = importMusicXml(musicXml([{ notes: [[{ midi: [C4], dur: 4 * q, before: dir }]] }]));
    expect(s.expressions).toEqual([
      { staff: 0, t: 0, text: "pp", kind: "dynamic" },
      { staff: 0, t: 0, text: "sempre pianissimo e senza sordini", kind: "text" },
    ]);
  });

  it("importe « Ped. simile » du MusicXML sur la ligne de pédale, même écrit sur la portée du haut", () => {
    const dir = `<direction><direction-type><words>Ped. simile</words></direction-type><staff>1</staff></direction>`;
    const s = importMusicXml(musicXml([{ notes: [[{ midi: [C4], dur: 4 * q, before: dir }]] }]));
    expect(s.pedalTexts).toEqual([{ staff: 1, t: 0, text: "Ped. simile" }]);
    expect(s.expressions).toEqual([]);
  });
});

describe("ornements", () => {
  const gk = (s: Score) => s.graces.map((g) => `${g.staff}:${g.midi}@${g.t / T}#${g.slot}`).join(" ");
  const tk = (s: Score) => s.notes.filter((n) => n.trill !== undefined).map((n) => `${n.midi}~${n.trill}`).join(" ");
  const ruler = "m1 |1    |2    |3    |4    ||";

  it("lit une trille « 5~7 » : la note et sa voisine la plus proche", () => {
    const s = parsePrisma([ruler, "0  |5~7  |-    |12~1 |-    ||", "---", ""].join("\n"));
    expect(tk(s)).toBe("64~66 71~72");
    expect(notesKey(s)).toBe(`0:64@0-${2 * T} 0:71@${2 * T}-${4 * T}`);
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
    expect(s.arpeggios).toEqual([{ t: 0, staff: 0 }, { t: T, down: true }]);
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
            { midi: [65], dur: q, notations: orn("<trill-mark/>") }, // fa : trille avec sol
            { midi: [62], dur: q, notations: orn("<inverted-mordent/>") }, // ré : note, mi bémol (armure), note
            { midi: [72], dur: q, notations: orn('<turn/><accidental-mark placement="above">natural</accidental-mark>') }, // do : ré, do, si bémol
            { midi: [67], dur: q, notations: orn("<mordent/>") }, // sol : note, fa, note
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
    const s = importMusicXml(musicXml([{ notes: [[{ midi: [64], dur: 2 * q, notations: orn }, { midi: [65], dur: 2 * q }]] }]));
    expect(gk(s)).toBe("0:65@2#0 0:64@2#1 0:62@2#2 0:64@2#3");
  });

  it("importe les arpèges : par portée, ou d'un seul geste quand les deux portées partagent leur numéro", () => {
    const arp = (n: string) => `<arpeggiate number="${n}"/>`;
    const xml = musicXml([
      {
        notes: [
          [{ midi: [64, 67], dur: 2 * q, notations: arp("1") }, { midi: [64, 67], dur: 2 * q, notations: arp("2") }],
          [{ midi: [48, 55], dur: 2 * q, staff: 2, notations: arp("1") }, { midi: [48, 55], dur: 2 * q, staff: 2, notations: arp("3") }],
        ],
      },
    ]);
    expect(importMusicXml(xml).arpeggios).toEqual([{ t: 0 }, { t: 2 * T, staff: 0 }, { t: 2 * T, staff: 1 }]);
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

describe("sous-titre", () => {
  const one = [{ notes: [[{ midi: [C4], dur: 4 * q }]] }];
  const withHead = (head: string) => musicXml(one).replace("<part-list>", head + "<part-list>");

  it("lit et écrit le sous-titre du frontmatter, juste après le titre", () => {
    const s = parsePrisma("---\ncomposer: Chopin\nsubtitle: Op. 9 n° 2\ntitle: Nocturne\n---\nm1 |1  ||\n0  |1  ||\n---\n");
    expect(s.meta.subtitle).toBe("Op. 9 n° 2");
    expect(writePrisma(s).split("\n").slice(0, 6)).toEqual(["---", "format: 1", "title: Nocturne", "subtitle: Op. 9 n° 2", "composer: Chopin", "---"]);
  });

  it("importe le sous-titre des textes de page, en recollant ses morceaux", () => {
    const credit = `<credit page="1"><credit-type>subtitle</credit-type><credit-words>from Suite L. 75\n</credit-words><credit-words>3</credit-words><credit-words>rd</credit-words><credit-words> Movement</credit-words></credit>`;
    expect(importMusicXml(withHead(credit)).meta.subtitle).toBe("from Suite L. 75 3rd Movement");
  });

  it("prend le titre dans les textes de page quand l'œuvre n'en a pas", () => {
    const xml = withHead(`<credit page="1"><credit-type>title</credit-type><credit-words>To Zanarkand</credit-words></credit>`).replace(/<work>.*?<\/work>/, "");
    expect(importMusicXml(xml).meta.title).toBe("To Zanarkand");
  });

  it("prend sinon le titre du mouvement, s'il complète celui de l'œuvre", () => {
    const xml = musicXml(one).replace("</work>", "</work><movement-title>Clair de lune</movement-title>");
    expect(importMusicXml(xml).meta).toMatchObject({ title: "Test", subtitle: "Clair de lune" });
    expect(importMusicXml(musicXml(one)).meta.subtitle).toBeUndefined();
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

describe("version du format", () => {
  const body = "m1 |1  ||\n0  |1  ||\n---\n";
  const withFormat = (v: string) => `---\nformat: ${v}\n---\n${body}`;

  it("écrit toujours la version du format en tête, et relit le fichier", () => {
    const text = writePrisma(parsePrisma(body));
    expect(text.split("\n").slice(0, 3)).toEqual(["---", `format: ${FORMAT_VERSION}`, "---"]);
    expect(parsePrisma(text).meta.format).toBeUndefined();
  });

  it("lit un fichier sans version comme la version courante", () => {
    expect(parsePrisma(body).notes).toHaveLength(1);
  });

  it("refuse une version plus récente ou plus ancienne, en le disant", () => {
    expect(() => parsePrisma(withFormat(String(FORMAT_VERSION + 1)))).toThrow(/plus récente/);
    expect(() => parsePrisma(withFormat(String(FORMAT_VERSION - 1)))).toThrow(/ancienne version/);
    expect(() => parsePrisma(withFormat("un"))).toThrow(/numéro de version/);
  });
});

describe("accords", () => {
  it("calcule les notes d'un accord nommé, de la basse vers l'aigu", () => {
    const n = (name: string) => chordNameNotes(name)?.join(",");
    expect(n("C")).toBe("1,5,8");
    expect(n("Am")).toBe("10,1,5");
    expect(n("Am7")).toBe("10,1,5,8");
    expect(n("G/B")).toBe("12,3,8");
    expect(n("F#m7b5")).toBe("7,10,1,5");
    expect(n("Bb")).toBe("11,3,6");
    expect(n("C6/9")).toBe("1,3,5,8,10");
    expect(n("Xm")).toBeUndefined();
    expect(n("Cfoo")).toBeUndefined();
  });

  it("reconnaît un accord à partir de ses notes, la basse décidant entre Am7 et C6", () => {
    expect(chordName([10, 1, 5])).toBe("Am");
    expect(chordName([10, 1, 5, 8])).toBe("Am7");
    expect(chordName([1, 5, 8, 10])).toBe("C6");
    expect(chordName([12, 3, 8])).toBe("G/B");
    expect(chordName([1, 2, 3])).toBeUndefined();
    expect(chordNotes("10,1,5")).toEqual([10, 1, 5]);
    expect(chordNotes("10,13")).toBeUndefined();
    expect(chordNotes("10;1;5")).toBeUndefined();
  });

  it("lit le nom Prisma d'un accord : la fondamentale, « : » et la sorte d'accord, « / » et la basse", () => {
    const n = (name: string) => chordNotes(name)?.join(",");
    expect(n("8")).toBe("8,12,3");
    expect(n("5:m")).toBe("5,8,12");
    expect(n("8:7")).toBe("8,12,3,6");
    expect(n("7:m7b5")).toBe("7,10,1,5");
    expect(n("1/8")).toBe("8,1,5");
    expect(n("1:7/5")).toBe("5,8,11,1");
    expect(n("1:6/9")).toBe("1,3,5,8,10");
    for (const bad of ["8:", "5m", "13", "1:xx", "0"]) expect(chordNotes(bad)).toBeUndefined();
    expect(chordPrismaName([10, 1, 5, 8])).toBe("10:m7");
    expect(chordPrismaName([12, 3, 8])).toBe("8/12");
    expect(chordPrismaName([1, 5, 8])).toBe("1");
  });

  const piece = (chords: string) => [chords, "m1      |1  |2  |3  |4  ||", "0       |1  |-  |5  |-  ||", "---", ""].join("\n");

  it("lit la ligne @c, en nom Prisma, en nom anglais ou en notes Prisma, et l'écrit au-dessus de la règle", () => {
    const s = parsePrisma(piece("@c       1       Am  10,1,5"));
    expect(s.chords).toEqual([{ t: 0, text: "1" }, { t: 2 * T, text: "Am" }, { t: 3 * T, text: "10,1,5" }]);
    const { text, back } = roundTrip(s);
    expect(back.chords).toEqual(s.chords);
    const lines = text.split("\n");
    expect(lines[lines.findIndex((l) => l.startsWith("m1")) - 1]).toMatch(/^@c +1 +Am +10,1,5$/);
  });

  it("grave le nom dans la notation choisie, Prisma par défaut", () => {
    expect(splitChord("Am").name).toBe("10:m");
    expect(splitChord("10,1,5").name).toBe("10:m");
    expect(splitChord("10:m", "english").name).toBe("Am");
    expect(splitChord("G/B", "english").name).toBe("G/B");
    expect(splitChord("10,1,5").notes).toEqual([10, 1, 5]);
  });

  it("tient dans la colonne de gauche la plus étroite", () => {
    const s = parsePrisma(piece("@c       Am"));
    expect(writePrisma(s)).toMatch(/^@c  Am$/m);
    expect(writePrisma(s)).toMatch(/^m1 \|1/m);
  });

  it("refuse un accord inconnu, mal placé ou sous les notes", () => {
    expect(() => parsePrisma(piece("@c       Hm"))).toThrow(/accord inconnu/);
    expect(() => parsePrisma(piece("@c        C"))).toThrow(/exactement sur une case/);
    expect(() => parsePrisma(["m1 |1  ||", "0  |1  ||", "@c  C", "---", ""].join("\n"))).toThrow(/au-dessus de la règle/);
  });

  it("importe les accords du MusicXML (<harmony>), basse comprise", () => {
    const harmony = (step: string, kind: string, extra = "") => `<harmony><root><root-step>${step}</root-step></root><kind>${kind}</kind>${extra}</harmony>`;
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4], dur: 2 * q, before: harmony("A", "minor-seventh") },
            { midi: [C4], dur: 2 * q, before: harmony("G", "major", "<bass><bass-step>B</bass-step></bass>") },
          ],
        ],
      },
    ]);
    expect(importMusicXml(xml).chords).toEqual([{ t: 0, text: "10:m7" }, { t: 2 * T, text: "8/12" }]);
  });

  it("lit les lettres de nuance de la police musicale, et sépare une nuance en tête de texte", () => {
    const words = (w: string) => `<direction><direction-type><words>${w}</words></direction-type><staff>1</staff></direction>`;
    const xml = musicXml([{ notes: [[{ midi: [C4], dur: 2 * q, before: words("\ue520\ue520 con sordina") }, { midi: [C4], dur: 2 * q, before: words("mf dolce") }]] }]);
    expect(importMusicXml(xml).expressions.map((e) => `${e.kind}:${e.text}`)).toEqual(["dynamic:pp", "text:con sordina", "dynamic:mf", "text:dolce"]);
  });

  it("importe les accords écrits en simple texte au-dessus de la portée", () => {
    const words = (w: string) => `<direction placement="above"><direction-type><words>${w}</words></direction-type><staff>1</staff></direction>`;
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4], dur: 2 * q, before: words("A7") + words("dolce") },
            { midi: [C4], dur: 2 * q, before: words(" E7 ") },
          ],
        ],
      },
    ]);
    const s = importMusicXml(xml);
    expect(s.chords).toEqual([{ t: 0, text: "10:7" }, { t: 2 * T, text: "5:7" }]);
    expect(s.expressions.map((e) => e.text)).toEqual(["dolce"]);
  });
});

describe("paroles", () => {
  const piece = [
    "m1 |1  |2   |3  |4  ||1  |2   |3  |4  ||",
    "+1 |   |    |   |1  ||   |    |   |   ||",
    "0  |8  |10  |12 |   ||12 |10  |8  |-  ||",
    "@l  A-  men -------   A-  men -------",
    "@l  oh  la   la  di",
    "---",
    "-1 |1  |-   |-  |-  ||8  |-   |-  |-  ||",
    "",
  ].join("\n");

  it("lit une syllabe par case, le trait d'union, la prolongation et les couplets", () => {
    const s = parsePrisma(piece);
    expect(s.lyrics.filter((l) => l.verse === 1)).toEqual([
      { staff: 0, verse: 1, t: 0, text: "A", hyphen: true },
      { staff: 0, verse: 1, t: T, text: "men", extend: 4 * T },
      { staff: 0, verse: 1, t: 4 * T, text: "A", hyphen: true },
      { staff: 0, verse: 1, t: 5 * T, text: "men", extend: 8 * T },
    ]);
    expect(s.lyrics.filter((l) => l.verse === 2).map((l) => l.text)).toEqual(["oh", "la", "la", "di"]);
  });

  it("réécrit les paroles telles quelles", () => {
    const written = writePrisma(parsePrisma(piece)).split("\n");
    for (const l of piece.split("\n").slice(0, 7).filter((x) => x !== "---")) expect(written).toContain(l);
  });

  it("prolonge une syllabe d'un système au suivant", () => {
    const s = parsePrisma(piece);
    const text = writePrisma(s, { width: 26 });
    expect(text.match(/^@l  A-  men -------$/gm)).toHaveLength(2);
    expect(parsePrisma(text).lyrics).toEqual(s.lyrics);
    // une syllabe tenue jusque dans le système suivant y reprend par « --- » en tête
    const long = parsePrisma(["m1 |1  |2  ||1  |2  ||", "0  |1  |3  ||5  |-  ||", "@l  oh ------------", "---", "-1 |   |   ||   |   ||", ""].join("\n"));
    expect(long.lyrics).toEqual([{ staff: 0, verse: 1, t: 0, text: "oh", extend: 4 * T }]);
    const split = writePrisma(long, { width: 14 });
    expect(split).toMatch(/^@l  ---/m);
    expect(parsePrisma(split).lyrics).toEqual(long.lyrics);
    // syllabe sur la dernière case d'un système, prolongée au suivant
    const late = parsePrisma(["m1 |1  |2  ||1  |2  ||", "0  |1  |3  ||5  |-  ||", "@l      oh --------", "---", "-1 |   |   ||   |   ||", ""].join("\n"));
    expect(late.lyrics).toEqual([{ staff: 0, verse: 1, t: T, text: "oh", extend: 4 * T }]);
    expect(parsePrisma(writePrisma(late, { width: 14 })).lyrics).toEqual(late.lyrics);
  });

  it("veut les octaves d'une portée de l'aigu au grave, chacune numérotée une fois", () => {
    expect(() => parsePrisma(["m1 |1  ||", "-1 |1  ||", "+1 |5  ||", ""].join("\n"))).toThrow(/ligne 3, col. 1 : octave « \+1 » sous l'octave « -1 »/);
    expect(() => parsePrisma(["m1 |1  ||", "0  |1  ||", "0  |5  ||", ""].join("\n"))).toThrow(/octave « 0 » écrite deux fois/);
    expect(() => parsePrisma(["m1 |1  ||", "+1 |1  ||", "───┼───┼┼", "+1 |5  ||", ""].join("\n"))).not.toThrow();
  });

  it("refuse une note écrite après la dernière barre", () => {
    expect(() => parsePrisma(["m1 |1  |2  ||", "0  |1  |3  ||5", ""].join("\n"))).toThrow(/ligne 2, col. 14 : rien ne s'écrit après la dernière barre/);
    expect(() => parsePrisma(["m1 |1  |2  ||", "0  |1  |3  ||   ", ""].join("\n"))).not.toThrow();
  });

  it("refuse des paroles mal placées", () => {
    const one = (l: string) => ["m1 |1  |2  |3  ||", "0  |1  |3  |5  ||", l, "---", "-1 |   |   |   ||", ""].join("\n");
    expect(() => parsePrisma(one("@l   la"))).toThrow(/exactement sur une case/);
    expect(() => parsePrisma(one("@l  ---"))).toThrow(/écrivez d'abord la syllabe/);
    expect(() => parsePrisma(one("@l  la- --"))).toThrow(/ne se prolonge pas/);
    expect(() => parsePrisma(one("@l  la -"))).toThrow(/dépasser la case/);
    expect(() => parsePrisma(["@l  la", "m1 |1  ||", "0  |1  ||", "---", ""].join("\n"))).toThrow(/sous les lignes de leur portée/);
  });

  it("importe les paroles du MusicXML : syllabes, couplets, mélismes", () => {
    const ly = (n: number, syllabic: string, text: string, extend = false) =>
      `<lyric number="${n}"><syllabic>${syllabic}</syllabic><text>${text}</text>${extend ? "<extend/>" : ""}</lyric>`;
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [C4], dur: q, lyric: ly(1, "begin", "A") + ly(2, "single", "Oh !") },
            { midi: [C4 + 2], dur: q, lyric: ly(1, "end", "men", true) + ly(2, "single", "la") },
            { midi: [C4 + 4], dur: q },
            { midi: [C4 + 5], dur: q, tie: ["start"] },
          ],
        ],
      },
      { notes: [[{ midi: [C4 + 5], dur: q, tie: ["stop"] }, { midi: [C4], dur: 3 * q, lyric: ly(1, "single", "oui") }]] },
    ]);
    const s = importMusicXml(xml);
    expect(s.lyrics).toEqual([
      { staff: 0, verse: 1, t: 0, text: "A", hyphen: true },
      { staff: 0, verse: 2, t: 0, text: "Oh\u00A0!" },
      { staff: 0, verse: 1, t: T, text: "men", extend: 5 * T },
      { staff: 0, verse: 2, t: T, text: "la" },
      { staff: 0, verse: 1, t: 5 * T, text: "oui" },
    ]);
    expect(parsePrisma(writePrisma(s)).lyrics).toEqual(s.lyrics);
  });
});

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

describe("bpm", () => {
  const body = "m1 |1  ||\n0  |1  ||\n---\n-1 |   ||\n";
  it("se lit en temps par minute, et se réécrit tel quel", () => {
    const s = parsePrisma(`---\nbpm: 78\n---\n${body}`);
    expect(s.meta.bpm).toBe(78);
    expect(writePrisma(s)).toMatch(/^bpm: 78$/m);
  });

  it("refuse un tempo en mots", () => {
    expect(() => parsePrisma(`---\nbpm: Andante\n---\n${body}`)).toThrow(/temps par minute/);
  });

  it("importe le tempo du MusicXML, converti en temps de la règle (noire pointée en 6/8)", () => {
    const sound = `<direction><direction-type><words>Allegro</words></direction-type><sound tempo="120"/></direction>`;
    const four = musicXml([{ notes: [[{ midi: [C4], dur: 4 * q, before: sound }]] }]);
    expect(importMusicXml(four).meta.bpm).toBe(120);
    const six = musicXml([{ time: [6, 8], notes: [[{ midi: [C4], dur: 6 * (q / 2), before: sound }]] }]);
    expect(importMusicXml(six).meta.bpm).toBe(80);
  });
});

describe("portées et parties", () => {
  const song = [
    "---",
    "parts: Chant, Piano",
    "---",
    "m1 |1    |2  |3  |4   ||",
    "───┼─ Chant ─┼───┼────┼┼",
    "0  |8    |-  |10 |8   ||",
    "@l  Ah ---------  oui",
    "═══╪═ Piano ═╪═══╪════╪╪",
    "0  |5    |   |5  |    ||",
    "───┼─────┼───┼───┼────┼┼",
    "-1 |1    |-  |8  |-   ||",
    "@   Ped.          *",
    "",
  ].join("\n");
  const swap = (from: string, to: string) => song.replace(from, to);

  it("lit les portées de chaque partie, nommées sur leur trait", () => {
    const s = parsePrisma(song);
    expect(s.parts).toEqual([{ name: "Chant", staves: 1 }, { name: "Piano", staves: 2 }]);
    expect(s.meta.staves).toBeUndefined();
    expect(s.notes.filter((n) => n.start === 0).map((n) => n.staff)).toEqual([0, 1, 2]);
    expect(s.lyrics.map((l) => l.staff)).toEqual([0, 0]);
    expect(s.pedals).toEqual([{ staff: 2, start: 0, end: 3 * T }]);
  });

  it("réécrit le texte tel quel", () => {
    expect(writePrisma(parsePrisma(song))).toBe("---\nformat: 1\n" + song.slice(4).replace("---\nm1", "---\n\nm1"));
  });

  it("lit le nom n'importe où sur son trait, entre des espaces", () => {
    expect(parsePrisma(swap("═══╪═ Piano ═╪═══╪════╪╪", "═══╪═════╪═══╪═  Piano  ═╪╪")).parts[1].name).toBe("Piano");
  });

  it("refuse un nom de partie non déclaré, déplacé ou manquant", () => {
    expect(() => parsePrisma(swap("═ Piano ═", "═ Pno. ══"))).toThrow(/« Pno\. » non déclaré/);
    expect(() => parsePrisma(swap("─ Chant ─", "─ Piano ─"))).toThrow(/à la place de « Chant »/);
    expect(() => parsePrisma(swap("───┼─ Chant ─┼", "───┼───────┼"))).toThrow(/il manque le nom de la partie « Chant »/);
    expect(() => parsePrisma(swap("parts: Chant, Piano\n", ""))).toThrow(/non déclarée : nommez les parties/);
    expect(() => parsePrisma(swap("parts: Chant, Piano", "parts: Chant, Piano, Flûte"))).toThrow(/il manque des parties/);
    expect(() => parsePrisma(swap("───┼─────┼───┼───┼────┼┼", "───┼─ Main ┼───┼───┼────┼┼"))).toThrow(/trait double/);
  });

  it("refuse un système qui n'a pas les mêmes portées que le premier", () => {
    const two = ["m1 |1  ||", "0  |1  ||", "───┼───┼┼", "0  |1  ||", "", "m2 |1  ||", "0  |1  ||", ""].join("\n");
    expect(() => parsePrisma(two)).toThrow(/pas les mêmes portées que le premier \(1 au lieu de 2\)/);
  });

  it("met la pédale sous la dernière portée d'une partie seulement", () => {
    expect(() => parsePrisma(swap("0  |5    |   |5  |    ||", "0  |5    |   |5  |    ||\n@   Ped."))).toThrow(/sous la dernière portée de sa partie/);
  });

  it("importe chaque <part> comme une partie, et chaque portée comme une portée", () => {
    const note = (step: string, octave: number, staff: number, extra = "") =>
      `<note><pitch><step>${step}</step><octave>${octave}</octave></pitch><duration>4</duration><staff>${staff}</staff>${extra}</note>`;
    const attributes = (staves: number) => `<attributes><divisions>1</divisions><staves>${staves}</staves><time><beats>4</beats><beat-type>4</beat-type></time></attributes>`;
    const twoStaves = `<?xml version="1.0"?><score-partwise version="3.1"><part-list>
      <score-part id="P1"><part-name>Chant</part-name></score-part><score-part id="P2"><part-name>Piano</part-name></score-part></part-list>
      <part id="P1"><measure number="1">${attributes(1)}${note("C", 5, 1, "<lyric><syllabic>single</syllabic><text>Ah</text></lyric>")}</measure></part>
      <part id="P2"><measure number="1">${attributes(2)}<direction><direction-type><pedal type="start"/></direction-type><staff>1</staff></direction>${note("E", 4, 1)}<backup><duration>4</duration></backup>${note("C", 3, 2)}</measure></part>
      </score-partwise>`;
    const s = importMusicXml(twoStaves);
    expect(s.parts).toEqual([{ name: "Chant", staves: 1 }, { name: "Piano", staves: 2 }]);
    expect(s.notes.map((n) => `${n.staff}:${n.midi}`)).toEqual(["0:72", "1:64", "2:48"]);
    expect(s.lyrics).toEqual([{ staff: 0, verse: 1, t: 0, text: "Ah" }]);
    expect(s.pedals).toEqual([{ staff: 2, start: 0, end: 4 * T }]);
    expect(parsePrisma(writePrisma(s)).parts).toEqual(s.parts);
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


describe("écoute", () => {
  const two = ["---", "bpm: 120", "---", "m1 |1  |2  ||", "0  |1  |-  ||", "---", "-1 |8  |3  ||", ""].join("\n");
  /** Un morceau d'une mesure d'un temps par lettre, une note par mesure (1, 2, 3…), avec ses reprises et sections. */
  const bars = (n: number, more: Partial<Score> = {}): Score => ({
    ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
    beats: Array.from({ length: n }, (_, i) => ({ bar: String(i + 1), barIndex: i, label: 1, division: 2 }) as Score["beats"][number]),
    notes: Array.from({ length: n }, (_, i) => ({ staff: 0, midi: 60 + i, start: i * T, end: (i + 1) * T })),
    ...more,
  });
  const order = (s: Score, ps: ReturnType<typeof passages>) => playedNotes(s, ps).map((n) => n.midi - 59).join(" ");
  let passages: typeof import("../src/app/playback/performance.ts").passages;
  let playedNotes: typeof import("../src/app/playback/performance.ts").playedNotes;
  let playNotes: typeof import("../src/app/playback/player.ts").playNotes;
  beforeAll(async () => {
    ({ passages, playedNotes } = await import("../src/app/playback/performance.ts"));
    ({ playNotes } = await import("../src/app/playback/player.ts"));
  });

  it("donne les notes en secondes, au tempo choisi", () => {
    const s = parsePrisma(two);
    expect(playNotes(playedNotes(s, passages(s)), 120)).toEqual([
      { time: 0, midi: 55, duration: 0.5, velocity: 70, staff: 1 },
      { time: 0, midi: 60, duration: 1, velocity: 70, staff: 0 },
      { time: 0.5, midi: 50, duration: 0.5, velocity: 70, staff: 1 },
    ]);
  });

  it("reprend à un instant donné, en rejouant ce qui sonne encore", () => {
    const s = parsePrisma(two);
    expect(playNotes(playedNotes(s, passages(s)), 60, T)).toEqual([
      { time: 0, midi: 50, duration: 1, velocity: 70, staff: 1 },
      { time: 0, midi: 60, duration: 1, velocity: 70, staff: 0 },
    ]);
  });

  it("déroule les reprises, au nombre de passages indiqué", () => {
    const s = parsePrisma("m1 ||:1  |2  :||1  |2  ||\n0  ||:1  |-   ||5  |   ||\n---\n-1 || 1  |    ||1  |   ||\n");
    expect(playedNotes(s, passages(s)).map((n) => [n.start / T, n.midi])).toEqual([[0, 48], [0, 60], [2, 48], [2, 60], [4, 48], [4, 64]]);
    const three = bars(4, { repeats: [{ barIndex: 1, start: true }, { barIndex: 2, end: true, times: 3 }] });
    expect(order(three, passages(three))).toBe("1 2 3 2 3 2 3 4");
    // sans « ||: », on revient au début ; « :||: » enchaîne deux reprises
    const r = bars(4, { repeats: [{ barIndex: 0, end: true }, { barIndex: 1, start: true }, { barIndex: 2, end: true }] });
    expect(order(r, passages(r))).toBe("1 1 2 3 2 3 4");
  });

  it("suit l'ordre des sections, et chaque reprise reste dans la sienne", () => {
    const s = bars(4, {
      markers: [{ label: "A", barIndex: 0 }, { label: "B", barIndex: 2 }],
      order: ["A", "B", "A"],
      repeats: [{ barIndex: 3, end: true }],
    });
    expect(order(s, passages(s))).toBe("1 2 3 4 3 4 1 2");
  });

  it("compte les mesures dans l'ordre où elles se jouent, et les range par section (où en est la lecture)", async () => {
    const { playedBars, playedSections, barAt } = await import("../src/app/playback/performance.ts");
    const s = bars(4, {
      markers: [{ label: "A", barIndex: 0 }, { label: "B", barIndex: 2 }],
      order: ["A", "B", "A"],
      repeats: [{ barIndex: 3, end: true }],
    });
    const played = playedBars(s, passages(s));
    // 1 2 | 3 4 3 4 | 1 2 : huit mesures jouées, une mesure d'un temps chacune
    expect(played.map((b) => [b.at / T, b.end / T, b.entry])).toEqual([[0, 1, 0], [1, 2, 0], [2, 3, 1], [3, 4, 1], [4, 5, 1], [5, 6, 1], [6, 7, 2], [7, 8, 2]]);
    expect(playedSections(s, played)).toEqual([
      { entry: 0, label: "A", first: 0, count: 2 },
      { entry: 1, label: "B", first: 2, count: 4 },
      { entry: 2, label: "A", first: 6, count: 2 },
    ]);
    expect([0, 0.5, 5.9, 7, 99].map((t) => barAt(played, t * T))).toEqual([0, 0, 5, 7, 7]);
    // sans sections : une seule, sans lettre
    const plain = bars(3);
    expect(playedSections(plain, playedBars(plain, passages(plain)))).toEqual([{ entry: 0, label: "", first: 0, count: 3 }]);
  });

  it("garde liée une note qui passe d'un passage à la suite du morceau", () => {
    const s = bars(3, { repeats: [{ barIndex: 0, end: true }] });
    s.notes = [{ staff: 0, midi: 60, start: 0, end: 3 * T }];
    // après le retour en arrière la note s'arrête ; au dernier passage elle tient jusqu'au bout
    expect(playedNotes(s, passages(s))).toEqual([
      { staff: 0, start: 0, end: T, midi: 60, velocity: 70 },
      { staff: 0, start: T, end: 4 * T, midi: 60, velocity: 70 },
    ]);
  });

  it("place le curseur et le clic sur le bon passage d'une reprise", async () => {
    const { scoreTick, playedTick } = await import("../src/app/playback/performance.ts");
    const s = bars(3, { repeats: [{ barIndex: 1, end: true }] }); // joué 1 2 1 2 3
    const ps = passages(s);
    expect(scoreTick(ps, 2.5 * T)).toBe(0.5 * T);
    expect(playedTick(ps, 0, 0)).toBe(0); // au début : le premier passage
    expect(playedTick(ps, 0, 3 * T)).toBe(2 * T); // pendant le second passage : on y reste
    expect(playedTick(ps, 2 * T, 0)).toBe(4 * T); // la fin, jouée une seule fois
  });

  it("sait ce qu'on jouera après un système : la suite, ou le retour d'une reprise", async () => {
    const { nextTick } = await import("../src/app/playback/performance.ts");
    const s = bars(3, { repeats: [{ barIndex: 1, end: true }] }); // joué 1 2 1 2 3
    const ps = passages(s);
    expect(nextTick(ps, 0.5 * T, T)).toBe(T); // dans la mesure 1 : la mesure 2
    expect(nextTick(ps, 1.5 * T, 3 * T)).toBe(0); // dans la mesure 2, la reprise : retour à la 1
    expect(nextTick(ps, 3.5 * T, 3 * T)).toBe(2 * T); // la seconde fois : la mesure 3
    expect(nextTick(ps, 4.5 * T, 3 * T)).toBeNull(); // la fin du morceau
  });

  it("revient au passage le plus récent quand on clique en arrière, et va à une section par sa lettre", async () => {
    const { playedTick, entryAt, entryStart } = await import("../src/app/playback/performance.ts");
    // A B B B C, une mesure chacune : joué 1 2 2 2 3
    const s = bars(3, { markers: [{ label: "A", barIndex: 0 }, { label: "B", barIndex: 1 }, { label: "C", barIndex: 2 }], order: ["A", "B", "B", "B", "C"] });
    const ps = passages(s);
    expect(playedTick(ps, T, 0)).toBe(T); // à l'arrêt : le premier B
    expect(playedTick(ps, T + T / 2, 2.2 * T)).toBe(2.5 * T); // dans le 2e B : on y reste
    expect(playedTick(ps, T, 4.5 * T)).toBe(3 * T); // depuis C : le 3e B, juste avant
    expect(playedTick(ps, 2 * T, 1.5 * T)).toBe(4 * T); // C n'est pas encore joué : on y va
    expect(entryAt(ps, 2.5 * T)).toBe(2);
    expect(entryStart(ps, 3)).toBe(3 * T);
  });
});

describe("écoute : nuances", () => {
  let velocities: typeof import("../src/app/playback/dynamics.ts").velocities;
  beforeAll(async () => {
    ({ velocities } = await import("../src/app/playback/dynamics.ts"));
  });
  /** Un morceau d'une note par temps, sur une portée (ou deux, la seconde sans indication). */
  const piece = (n: number, more: Partial<Score> = {}, staves = 1): Score => ({
    ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
    parts: [{ staves }],
    notes: Array.from({ length: n * staves }, (_, i) => ({ staff: i % staves, midi: 60, start: Math.floor(i / staves) * T, end: (Math.floor(i / staves) + 1) * T })),
    ...more,
  });
  const dyn = (t: number, text: string, staff = 0) => ({ staff, t: t * T, text, kind: "dynamic" as const });

  it("joue chaque nuance à son intensité, mf par défaut", () => {
    expect(velocities(piece(3, { expressions: [dyn(1, "p"), dyn(2, "(ff)")] }))).toEqual([70, 42, 100]);
  });

  it("accentue la seule note d'un sf, et attaque fort un fp avant de jouer piano", () => {
    expect(velocities(piece(3, { expressions: [dyn(0, "p"), dyn(1, "sf")] }))).toEqual([42, 100, 42]);
    expect(velocities(piece(2, { expressions: [dyn(0, "fp")] }))).toEqual([86, 42]);
  });

  it("mène un soufflet jusqu'à la nuance qui le suit, ou d'un pas sans elle", () => {
    const hairpins = [{ staff: 0, kind: "<" as const, start: 0, end: 4 * T }];
    expect(velocities(piece(5, { expressions: [dyn(0, "p"), dyn(4, "f")], hairpins }))).toEqual([42, 53, 64, 75, 86]);
    expect(velocities(piece(5, { expressions: [dyn(0, "p")], hairpins }))).toEqual([42, 46, 49, 53, 56]);
  });

  it("lit « cresc. » et « dim. » comme des soufflets jusqu'à la nuance suivante", () => {
    expect(velocities(piece(3, { expressions: [dyn(0, "f"), { staff: 0, t: 0, text: "dim.", kind: "text" }, dyn(2, "p")] }))).toEqual([86, 64, 42]);
  });

  it("applique une nuance à toute la partie, sauf à une portée qui a la sienne au même instant", () => {
    // pp écrit à droite vaut aussi pour la gauche, même si la gauche a ses propres indications ; le f
    // écrit à gauche vaut de même pour la droite
    expect(velocities(piece(3, { expressions: [dyn(1, "pp"), dyn(2, "f", 1)] }, 2))).toEqual([70, 70, 28, 28, 86, 86]);
    // mf à droite et p à gauche, écrits ensemble : chacune le sien
    expect(velocities(piece(1, { expressions: [dyn(0, "mf"), dyn(0, "p", 1)] }, 2))).toEqual([70, 42]);
  });
});

describe("écoute : pédale", () => {
  let soundingEnds: typeof import("../src/app/playback/pedal.ts").soundingEnds;
  beforeAll(async () => {
    ({ soundingEnds } = await import("../src/app/playback/pedal.ts"));
  });
  const base = parsePrisma("m1 |1  ||\n0  |1  ||\n");
  const score = (notes: Score["notes"], pedals: Score["pedals"], staves = 1): Score => ({ ...base, parts: [{ staves }], notes, pedals });
  const n = (start: number, end: number, midi = 60, staff = 0) => ({ staff, midi, start: start * T, end: end * T });
  const ped = (start: number, end: number, staff = 0) => ({ staff, start: start * T, end: end * T });

  it("tient une note relâchée jusqu'à ce que la pédale remonte", () => {
    expect(soundingEnds(score([n(0, 1), n(1, 2, 64), n(3, 4)], [ped(0, 3)]))).toEqual([3 * T, 3 * T, 4 * T]);
  });

  it("efface à un changement de pédale l'harmonie relâchée avant, et garde la nouvelle", () => {
    // *Ped. au temps 2 : la note relâchée pile au changement s'éteint, celle attaquée là est reprise
    expect(soundingEnds(score([n(0, 2), n(2, 3, 64)], [ped(0, 2), ped(2, 4)]))).toEqual([2 * T, 4 * T]);
  });

  it("arrête une note tenue par la pédale quand la même touche est rejouée", () => {
    expect(soundingEnds(score([n(0, 1), n(2, 3)], [ped(0, 4)]))).toEqual([2 * T, 4 * T]);
  });

  it("vaut pour toutes les portées de la partie, posée sous la dernière", () => {
    expect(soundingEnds(score([n(0, 1, 72, 0), n(0, 1, 48, 1)], [ped(0, 2, 1)], 2))).toEqual([2 * T, 2 * T]);
  });
});

describe("écoute : Ped. simile", () => {
  let playedPedals: typeof import("../src/app/playback/pedal.ts").playedPedals;
  beforeAll(async () => {
    ({ playedPedals } = await import("../src/app/playback/pedal.ts"));
  });
  /** Un morceau de n mesures de 2 temps, sur une portée. */
  const piece = (n: number, more: Partial<Score>): Score => ({
    ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
    beats: Array.from({ length: 2 * n }, (_, i) => ({ bar: String((i >> 1) + 1), barIndex: i >> 1, label: (i % 2) + 1, division: 2 }) as Score["beats"][number]),
    notes: [],
    ...more,
  });
  const ped = (start: number, end: number) => ({ staff: 0, start: start * T, end: end * T, implied: true });
  const sim = (t: number) => ({ staff: 0, t: t * T, text: "Ped. simile" });

  it("reproduit le motif de la dernière mesure pédalée, mesure par mesure", () => {
    // un changement à chaque temps : Ped. sur le 1, *Ped. sur le 2, puis simile
    const s = piece(3, { pedals: [ped(0, 1), ped(1, 2)], pedalTexts: [sim(0)] });
    expect(playedPedals(s).slice(2)).toEqual([ped(2, 3), ped(3, 4), ped(4, 5), ped(5, 6)]);
  });

  it("s'arrête au prochain signe de pédale écrit, ou à la section suivante", () => {
    const s = piece(4, { pedals: [ped(0, 2), ped(6, 7)], pedalTexts: [sim(0)] });
    expect(playedPedals(s).slice(2)).toEqual([ped(2, 4), ped(4, 6)]);
    const t = piece(4, { pedals: [ped(0, 2)], pedalTexts: [sim(0)], markers: [{ label: "A", barIndex: 0 }, { label: "B", barIndex: 2 }] });
    expect(playedPedals(t).slice(1)).toEqual([ped(2, 4)]);
  });

  it("grave les pédales du simile comme les autres, atténuées, ou laisse la mention seule", async () => {
    const { withSimile } = await import("../src/app/playback/pedal.ts");
    const s = piece(2, { pedals: [{ staff: 0, start: 0, end: 2 * T }], pedalTexts: [sim(0)] });
    const plain = withSimile(s, "pedals");
    expect(plain.pedals).toEqual([{ staff: 0, start: 0, end: 2 * T }, { staff: 0, start: 2 * T, end: 4 * T }]);
    expect(plain.pedalTexts).toEqual([]);
    expect(withSimile(s, "faded").pedals[1]).toEqual(ped(2, 4));
    expect(withSimile(s, "text")).toBe(s);
  });
});

describe("écoute : petites notes", () => {
  it("joue les petites notes juste avant leur note, de gauche à droite", async () => {
    const { passages, playedNotes } = await import("../src/app/playback/performance.ts");
    const { playNotes } = await import("../src/app/playback/player.ts");
    // l'exemple de FORMAT.md, sur le 2e temps : 3 (octave du dessus), 7, 9, puis le 5 sur le temps
    const s = parsePrisma(["m1 |1  |2        ||", "+1 |   |3'       ||", "0  |1  |  7'9'5  ||", ""].join("\n"));
    const notes = playNotes(playedNotes(s, passages(s)), 60);
    expect(notes.map((n) => [n.midi, +n.time.toFixed(2), +n.duration.toFixed(2)])).toEqual([
      [60, 0, 1],
      [74, 0.79, 0.07],
      [66, 0.86, 0.07],
      [68, 0.93, 0.07],
      [64, 1, 1],
    ]);
  });
});

describe("écoute : première mesure d'une section", () => {
  it("sait si l'on est encore dans la première mesure de la section jouée", async () => {
    const { passages, inFirstBar } = await import("../src/app/playback/performance.ts");
    // A B A, des mesures de 2 temps : A = mesures 1 et 2, B = mesure 3
    const s: Score = {
      ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
      beats: Array.from({ length: 6 }, (_, i) => ({ bar: String((i >> 1) + 1), barIndex: i >> 1, label: (i % 2) + 1, division: 2 }) as Score["beats"][number]),
      markers: [{ label: "A", barIndex: 0 }, { label: "B", barIndex: 2 }],
      order: ["A", "B", "A"],
    };
    const ps = passages(s);
    expect([0, 1.5, 2, 3].map((t) => inFirstBar(s, ps, t * T))).toEqual([true, true, false, false]);
    expect([4, 5.5, 6, 7.5, 8].map((t) => inFirstBar(s, ps, t * T))).toEqual([true, true, true, true, false]);
  });
});

describe("écoute : trilles", () => {
  it("alterne la note et sa voisine, en commençant et en finissant par la note", async () => {
    const { passages, playedNotes } = await import("../src/app/playback/performance.ts");
    const { playNotes } = await import("../src/app/playback/player.ts");
    const s = parsePrisma("m1 |1  |2  ||\n0  |5~7|1  ||\n");
    const notes = playNotes(playedNotes(s, passages(s)), 60).filter((n) => n.time < 1 - 1e-9);
    expect(notes.length % 2).toBe(1);
    expect(notes.length).toBeGreaterThan(9);
    expect(notes.map((n) => n.midi)).toEqual(notes.map((_, k) => (k % 2 ? 66 : 64)));
    const last = notes[notes.length - 1];
    expect(last.time + last.duration).toBeCloseTo(1);
  });
});

describe("écoute : arpèges", () => {
  it("égrène l'accord à partir du temps, du grave à l'aigu ou de l'aigu au grave", async () => {
    const { passages, playedNotes } = await import("../src/app/playback/performance.ts");
    const { playNotes } = await import("../src/app/playback/player.ts");
    const s = parsePrisma(["m1 |1    |2    ||", "0  |8    |8    ||", "   |5    |5    ||", "   |1    |1    ||", "@   /     \\", ""].join("\n"));
    const notes = playNotes(playedNotes(s, passages(s)), 60);
    const at = (t: number) => notes.filter((n) => n.time >= t && n.time < t + 0.5).map((n) => [n.midi, +n.time.toFixed(2)]);
    expect(at(0)).toEqual([[60, 0], [64, 0.04], [67, 0.08]]);
    expect(at(1)).toEqual([[67, 1], [64, 1.04], [60, 1.08]]);
    // toutes les notes s'arrêtent ensemble, à la fin de l'accord
    expect(notes.filter((n) => n.time < 0.5).map((n) => +(n.time + n.duration).toFixed(2))).toEqual([1, 1, 1]);
  });
});

describe("écoute : point d'orgue", () => {
  it("tient deux fois plus longtemps ce qui commence sous le point d'orgue, et décale la suite", async () => {
    const { passages, playedNotes, holds, stretched, unstretched } = await import("../src/app/playback/performance.ts");
    const { playNotes } = await import("../src/app/playback/player.ts");
    const s = parsePrisma(["@       ^", "m1 |1  |2  |3  ||", "0  |1  |5  |8  ||", ""].join("\n"));
    const ps = passages(s);
    const hs = holds(s, ps);
    expect(hs).toEqual([{ at: T, length: T }]);
    expect(playNotes(playedNotes(s, ps), 60, 0, hs).map((n) => [n.midi, n.time, n.duration])).toEqual([
      [60, 0, 1],
      [64, 1, 2],
      [67, 3, 1],
    ]);
    // le curseur reste sur la case du point d'orgue pendant qu'il dure
    expect([0.5, 1.5, 2.5, 3.5].map((c) => unstretched(hs, c * T) / T)).toEqual([0.5, 1.25, 1.75, 2.5]);
    expect(stretched(hs, 2.5 * T) / T).toBe(3.5);
  });
});

describe("écoute : articulations", () => {
  it("raccourcit le staccato, renforce l'accent, et les deux pour le marcato", async () => {
    const { passages, playedNotes } = await import("../src/app/playback/performance.ts");
    const s = parsePrisma(["m1 |1  |2  |3  |4  ||", "0  |8  |10 |12 |8  ||", "@   .   !   !!", ""].join("\n"));
    expect(playedNotes(s, passages(s)).map((n) => [n.midi, (n.end - n.start) / T, n.velocity])).toEqual([
      [67, 0.5, 70],
      [69, 1, 90],
      [71, 0.75, 98],
      [67, 1, 70],
    ]);
  });
});

describe("écriture : textes qui débordent", () => {
  it("laisse un texte long déborder sur les cases suivantes, sans élargir sa case", () => {
    const s = parsePrisma("m1 |1  |2  |3  |4  ||\n0  |1  |3  |5  |8  ||\n---\n");
    s.expressions.push({ staff: 0, t: 0, text: "sempre pianissimo", kind: "text" });
    const text = writePrisma(s);
    expect(text).toMatch(/^m1 \|1  \|2  \|3  \|4  \|\|$/m);
    expect(text).toMatch(/^@   sempre pianissimo$/m);
    expect(parsePrisma(text).expressions).toEqual(s.expressions);
  });
});

describe("écoute : métronome", () => {
  it("bat chaque temps du déroulé, le premier de la mesure marqué, levée comprise", async () => {
    const { passages, clicks } = await import("../src/app/playback/performance.ts");
    // une levée sur le temps 2, puis une mesure de 2 temps, reprise
    const s: Score = {
      ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
      beats: [
        { bar: "0", barIndex: 0, label: 2, division: 2 },
        { bar: "1", barIndex: 1, label: 1, division: 2 },
        { bar: "1", barIndex: 1, label: 2, division: 2 },
      ] as Score["beats"],
      repeats: [{ barIndex: 1, start: true, end: true }],
    };
    const beats = clicks(s, passages(s)).filter((c) => c.level === "beat" || c.level === "downbeat");
    expect(beats.map((c) => `${c.at / T}${c.level === "downbeat" ? "!" : ""}`).join(" ")).toBe("0 1! 2 3! 4");
  });

  it("divise chaque temps sur sa grille régulière, en 2 ou en 3, puis en deux", async () => {
    const { passages, clicks } = await import("../src/app/playback/performance.ts");
    const s: Score = {
      ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
      beats: [
        { bar: "1", barIndex: 0, label: 1, division: 2 },
        { bar: "1", barIndex: 0, label: 2, division: 3 },
      ] as Score["beats"],
    };
    const short = { downbeat: "1", beat: "T", division: "d", subdivision: "s" };
    expect(clicks(s, passages(s)).map((c) => `${short[c.level]}${+(c.at / T).toFixed(3)}`).join(" ")).toBe(
      "10 s0.25 d0.5 s0.75 T1 s1.167 d1.333 s1.5 d1.667 s1.833",
    );
  });

  it("bat les cases écrites, chacune à son niveau, pour faire entendre quand jouer", async () => {
    const { passages, clicks } = await import("../src/app/playback/performance.ts");
    // une noire, deux croches, quatre doubles croches
    const s = parsePrisma("m1 |1  |2  *  |3  .  *  .  ||\n0  |1  |3  5  |8  10 12 1  ||\n");
    const short = { downbeat: "1", beat: "T", division: "d", subdivision: "s" };
    expect(clicks(s, passages(s), "cells").map((c) => `${short[c.level]}${c.at / T}`).join(" ")).toBe("10 T1 d1.5 T2 s2.25 d2.5 s2.75");
  });

  it("bat les seules attaques, temps compris : ni les tenues, ni les cases d'un soufflet", async () => {
    const { passages, clicks } = await import("../src/app/playback/performance.ts");
    // la case « * » du premier temps n'existe que pour le soufflet ; le 3e temps n'est qu'une tenue
    const s = parsePrisma("m1 |1  *  |2  |3  ||\n0  |1  -  |3  |-  ||\n@      <----\n");
    const short = { downbeat: "1", beat: "T", division: "d", subdivision: "s" };
    const at = (grid: "cells" | "attacks") => clicks(s, passages(s), grid).map((c) => `${short[c.level]}${c.at / T}`).join(" ");
    expect(at("cells")).toBe("10 d0.5 T1 T2");
    expect(at("attacks")).toBe("10 T1");
  });
});

describe("écoute : décompte", () => {
  it("compte une mesure, puis les temps qui mènent à une levée", async () => {
    const { passages, countIn } = await import("../src/app/playback/performance.ts");
    // une levée sur le temps 4, puis une mesure de 4 temps
    const s: Score = {
      ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
      beats: [{ bar: "0", barIndex: 0, label: 4, division: 2 }, ...[1, 2, 3, 4].map((label) => ({ bar: "1", barIndex: 1, label, division: 2 }))] as Score["beats"],
    };
    const ps = passages(s);
    const short = (ls: string[]) => ls.map((l) => (l === "downbeat" ? "1" : "·")).join("");
    expect(short(countIn(s, ps, 0))).toBe("1···1··");
    expect(short(countIn(s, ps, T))).toBe("1···");
    expect(short(countIn(s, ps, 3 * T))).toBe("1···1·");
  });
});

describe("écoute : portées", () => {
  it("nomme les portées : les mains d'un clavier, le rang ailleurs", async () => {
    const { staffNames } = await import("../src/app/playback/staves.ts");
    expect(staffNames([{ staves: 2 }])).toEqual(["Main droite", "Main gauche"]);
    expect(staffNames([{ name: "Chant", staves: 1 }, { name: "Piano", staves: 2 }])).toEqual(["Chant", "Piano — main droite", "Piano — main gauche"]);
    expect(staffNames([{ name: "Chœur", staves: 2 }])).toEqual(["Chœur — portée 1", "Chœur — portée 2"]);
  });

  it("garde la portée de chaque note jouée, pour pouvoir la rendre muette", async () => {
    const { passages, playedNotes } = await import("../src/app/playback/performance.ts");
    const s = parsePrisma("m1 |1  ||\n0  |1  ||\n---\n-1 |1  ||\n");
    expect(playedNotes(s, passages(s)).map((n) => [n.midi, n.staff])).toEqual([[48, 1], [60, 0]]);
  });
});

describe("bibliothèque", () => {
  it("lit le titre et le compositeur : l'en-tête d'un .prisma, les crédits d'un MusicXML", async () => {
    const { describe: describeFile } = await import("../src/app/library/library.ts");
    expect(describeFile('---\nformat: 1\ntitle: "Gymnopédie n°1"\ncomposer: Erik Satie\n---\nm1 |1  ||\n', "prisma")).toEqual({ title: "Gymnopédie n°1", composer: "Erik Satie" });
    expect(describeFile("m1 |1  ||\n", "prisma")).toEqual({ title: undefined, composer: undefined });
    const xml = `<score-partwise><work><work-title>Clair &amp; net</work-title></work><identification><creator type="composer">Anonyme</creator></identification>`;
    expect(describeFile(xml, "musicxml")).toEqual({ title: "Clair & net", composer: "Anonyme" });
    expect(describeFile("<movement-title>Mouvement</movement-title>", "musicxml").title).toBe("Mouvement");
  });
});

describe("ce que montre le curseur", () => {
  const text = [
    "---",
    "parts: Chant, Piano",
    "bpm: 72",
    "---",
    "",
    "@  [A]          rit.",
    "m12|1  *  |2  |3  ||1      |2  |3  ||",
    "───┼─ Chant ┼───┼───┼┼───────┼───┼───┼┼",
    "0  |8  10 |-  |   ||12~1_3 |   |   ||",
    "@l  Ah --",
    "═══╪═ Piano ╪═══╪═══╪╪═══════╪═══╪═══╪╪",
    "+1 |3'5   |   |   ||       |   |   ||",
    "@   p      <---     !",
    "───┼──────┼───┼───┼┼───────┼───┼───┼┼",
    "-1 |1     |-  |   ||       |   |   ||",
    "@   Ped.                *",
    "",
  ].join("\n");
  const at = async (line: number, col: number, names: "latin" | "english" | "none" = "latin") => {
    const { inspect } = await import("../src/core/inspect.ts");
    const lines = text.split("\n");
    return inspect(text, lines.slice(0, line - 1).join("\n").length + (line > 1 ? 1 : 0) + col - 1, names);
  };

  it("nomme la clé de l'en-tête et lit sa valeur", async () => {
    expect((await at(3, 1)).symbol).toEqual({ text: "bpm", meaning: "tempo de départ : ici 72 temps par minute" });
    const { inspect } = await import("../src/core/inspect.ts");
    expect(inspect("---\ndivision: 3\n---\n", 5).symbol?.meaning).toBe("découpage par défaut d'un temps : ici ternaire, chaque temps en 3");
    expect(inspect("---\ntitle: X\n---\n", 5).symbol?.meaning).toBe("titre du morceau");
  });

  it("place le curseur dans la musique : section, mesure, temps, case, portée", async () => {
    const r = await at(9, 8);
    expect([r.line, r.column, r.section, r.bar, r.beat, r.cell, r.staff]).toEqual([9, 8, "A", "12", 1, { index: 2, count: 2 }, 0]);
    expect(r.parts).toEqual([{ name: "Chant", staves: 1 }, { name: "Piano", staves: 2 }]);
    expect(r.symbol).toEqual({ text: "10", meaning: "la3", keys: [10] });
    // sans noms : le numéro suffit
    expect((await at(9, 8, "none")).symbol?.meaning).toBe("note");
    expect((await at(9, 8, "english")).symbol?.meaning).toBe("A4");
    expect((await at(15, 5)).staff).toBe(2);
    expect((await at(9, 22)).bar).toBe("13");
  });

  it("traduit les notes : tenue, trille et doigté, petites notes, octave", async () => {
    expect((await at(9, 12)).symbol?.meaning).toBe("10 (la3) qui continue");
    expect((await at(9, 21)).symbol?.meaning).toBe("si3, en trille avec do4, doigt 3 (majeur)");
    expect((await at(12, 5)).symbol?.meaning).toBe("petite note : ré4, puis mi4");
    expect((await at(12, 1)).symbol?.meaning).toBe("octave +1 : de do4 à si4");
    expect((await at(9, 21, "none")).symbol).toMatchObject({ meaning: "note, en trille avec 1, doigt 3 (majeur)", keys: [12], trill: 1 });
    expect((await at(12, 5)).symbol).toMatchObject({ keys: [5], graces: [3] });
    expect((await at(9, 12, "none")).symbol).toMatchObject({ meaning: "10 qui continue", keys: [10] });
    expect((await at(12, 1, "none")).symbol?.meaning).toBe("octave +1");
  });

  it("traduit les indications, les barres et les traits", async () => {
    expect((await at(6, 4)).symbol?.meaning).toBe("début de la section A");
    expect((await at(6, 17)).symbol?.meaning).toBe("ritardando : en ralentissant");
    expect((await at(13, 5)).symbol?.meaning).toBe("piano : doux");
    expect((await at(13, 12)).symbol?.meaning).toBe("crescendo : de plus en plus fort");
    expect((await at(13, 21)).symbol?.meaning).toBe("accent : attaque plus forte");
    expect((await at(16, 5)).symbol?.meaning).toBe("enfoncer la pédale");
    expect((await at(7, 19)).symbol?.meaning).toBe("fin de mesure");
    expect((await at(11, 1)).symbol?.meaning).toBe("trait double : sépare deux parties ; il porte le nom de la partie « Piano »");
    expect((await at(10, 5)).symbol?.meaning).toBe("syllabe des paroles");
    const { inspect } = await import("../src/core/inspect.ts");
    const chords = "@c  Am  10,1,5  10:m\nm1 |1   |2   |3   ||\n0  |    |    |    ||\n";
    expect(inspect(chords, 4).symbol).toEqual({ text: "Am", meaning: "(10:m, 10,1,5) accord la do mi", keys: [10, 1, 5] });
    expect(inspect(chords, 8).symbol).toEqual({ text: "10,1,5", meaning: "(10:m, Am) accord la do mi", keys: [10, 1, 5] });
    expect(inspect(chords, 16).symbol).toEqual({ text: "10:m", meaning: "(Am, 10,1,5) accord la do mi", keys: [10, 1, 5] });
    expect(inspect(chords, 4, "none").symbol?.meaning).toBe("(10:m, 10,1,5) accord 10 1 5");
    expect(inspect("@c  8,3,4\nm1 |1   ||\n0  |    ||\n", 4).symbol?.meaning).toBe("accord sol ré ré♯");
  });
});

describe("instruments", () => {
  it("se devinent d'après le nom de la partie, en français ou en anglais", async () => {
    const { guessInstrument } = await import("../src/core/index.ts");
    const cases: [string | undefined, string][] = [
      [undefined, "piano"],
      ["Piano", "piano"],
      ["Piano électrique", "electric-piano"],
      ["Flûte", "flute"],
      ["Flute 1", "flute"],
      ["Violon II", "violin"],
      ["Violoncelle", "cello"],
      ["Contrebasse", "double-bass"],
      ["Basse électrique", "electric-bass"],
      ["Chant", "voice"],
      ["Soprano", "voice"],
      ["Alto", "voice"],
      ["Viola", "viola"],
      ["Saxophone alto", "saxophone"],
      ["Cor", "horn"],
      ["Cor anglais", "oboe"],
      ["Harpsichord", "harpsichord"],
      ["Ukulélé", "piano"],
    ];
    for (const [name, instrument] of cases) expect([name, guessInstrument(name)]).toEqual([name, instrument]);
  });

  it("donnent celui choisi pour le morceau, sinon celui de la partition, à chaque portée de la partie", async () => {
    const { staffInstruments, instrumentsOf } = await import("../src/app/playback/instruments.ts");
    const parts = [{ name: "Flûte", staves: 1 }, { name: "Piano", staves: 2 }, { name: "Chœur de droite", staves: 1, instrument: "flute" as const }];
    expect(instrumentsOf(parts)).toEqual(["flute", "piano", "flute"]);
    expect(instrumentsOf(parts, [null, "harpsichord", "voice"])).toEqual(["flute", "harpsichord", "voice"]);
    expect(instrumentsOf(parts, ["inconnu"])).toEqual(["flute", "piano", "flute"]);
    expect(staffInstruments(parts, ["flute", "harpsichord"])).toEqual(["flute", "harpsichord", "harpsichord", "piano"]);
  });

  const choir = (parts: string) =>
    ["---", `parts: ${parts}`, "---", "m1 |1  |2  ||", "───┼─ Chœur de droite ─┼┼", "0  |8  |   ||", "═══╪═ Piano ═╪═══╪╪", "0  |1  |   ||", ""].join("\n");

  it("s'écrivent entre parenthèses après le nom de la partie, et se relisent", () => {
    const s = parsePrisma(choir("Chœur de droite (flute), Piano"));
    expect(s.parts).toEqual([{ name: "Chœur de droite", staves: 1, instrument: "flute" }, { name: "Piano", staves: 1 }]);
    expect(writePrisma(s)).toContain("parts: Chœur de droite (flute), Piano");
    expect(parsePrisma(writePrisma(s)).parts).toEqual(s.parts);
  });

  it("refusent un instrument inconnu, en donnant la liste", () => {
    expect(() => parsePrisma(choir("Chœur de droite (flûte), Piano"))).toThrow(/instrument « flûte » inconnu pour « Chœur de droite » ; les instruments : piano, electric-piano/);
  });

  it("s'importent du MusicXML d'après le programme General MIDI, écrits seulement si le nom ne les fait pas deviner", () => {
    const part = (id: string, name: string, program: number) => `<score-part id="${id}"><part-name>${name}</part-name><midi-instrument id="${id}-I1"><midi-program>${program}</midi-program></midi-instrument></score-part>`;
    const body = (id: string) => `<part id="${id}"><measure number="1"><attributes><divisions>1</divisions><time><beats>2</beats><beat-type>4</beat-type></time></attributes><note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><type>half</type></note></measure></part>`;
    const xml = (parts: [string, string, number][]) => `<?xml version="1.0"?><score-partwise version="3.1"><part-list>${parts.map(([id, n, p]) => part(id, n, p)).join("")}</part-list>${parts.map(([id]) => body(id)).join("")}</score-partwise>`;
    expect(importMusicXml(xml([["P1", "Flute", 74], ["P2", "Voix de droite", 41]])).parts).toEqual([{ name: "Flute", staves: 1 }, { name: "Voix de droite", staves: 1, instrument: "violin" }]);
    // une seule partie : nommée pour porter son instrument, sauf le piano
    expect(importMusicXml(xml([["P1", "Flute", 74]])).parts).toEqual([{ name: "Flute", staves: 1 }]);
    expect(importMusicXml(xml([["P1", "Piano", 1]])).parts).toEqual([{ staves: 1 }]);
  });
});

describe("tonalité", () => {
  const body = "m1 |1  |2  |3  |4  ||\n0  |1  |5  |8  |1  ||\n";
  const read = (key: string) => parsePrisma(`---\nkey: ${key}\n---\n${body}`);

  it.each([
    ["8", 8, false],
    ["5:m", 5, true],
    ["G", 8, false],
    ["Em", 5, true],
    ["F#m", 7, true],
    ["Bb", 11, false],
  ])("lit « %s »", (text, tonic, minor) => {
    expect(parseKey(text)).toMatchObject({ tonic, minor });
  });

  it("garde l'écriture choisie, sans guillemets", () => {
    expect(writePrisma(read("5:m"))).toMatch(/^key: 5:m$/m);
    expect(writePrisma(read("F#m"))).toMatch(/^key: F#m$/m);
  });

  it("refuse une tonalité qui ne s'écrit pas ainsi", () => {
    for (const k of ["13", "5m", "H", "sol"]) expect(() => read(k)).toThrow(/« key » est la tonalité du morceau/);
  });

  it("se nomme en latin ou en anglais, avec l'altération usuelle", () => {
    expect(keyName(parseKey("11")!, "latin")).toBe("si♭ majeur");
    expect(keyName(parseKey("2:m")!, "latin")).toBe("do♯ mineur");
    expect(keyName(parseKey("Gb")!, "latin")).toBe("sol♭ majeur");
    expect(keyName(parseKey("5:m")!, "english")).toBe("Em");
    expect(keyName(parseKey("8")!, "none")).toBe("");
  });

  it("s'importe de l'armure du MusicXML, majeure ou mineure selon les notes, en notation Prisma", () => {
    expect(keysOfSignature(2)).toEqual([
      { tonic: 3, minor: false },
      { tonic: 12, minor: true },
    ]);
    // une armure d'un dièse : sol majeur (sol si ré) ou mi mineur (mi sol si)
    const xml = (key: number, chord: number[]) => musicXml([{ key, notes: [[{ midi: chord, dur: 4 * q }]] }]);
    expect(importMusicXml(xml(1, [67, 71, 74])).meta.key).toBe("8");
    expect(importMusicXml(xml(1, [64, 67, 71])).meta.key).toBe("5:m");
    // sans altération à l'armure, la mineur plutôt que do majeur quand les notes le disent
    expect(importMusicXml(xml(0, [57, 60, 64])).meta.key).toBe("10:m");
  });

  it("se devine aux notes du morceau", () => {
    expect(guessKey(parsePrisma(body))).toEqual({ tonic: 1, minor: false });
    const gymnopedie = importMusicXml(readFileSync(new URL("./fixtures/gymnopedie1.musicxml", import.meta.url), "utf8"));
    expect(prismaKey(guessKey(gymnopedie)!)).toBe("3");
  });
});
