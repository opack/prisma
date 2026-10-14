import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FORMAT_VERSION, TICKS_PER_BEAT as T, importMusicXml, layout, parseYmn, writeYmn } from "../src/core/index.ts";
import type { Score } from "../src/core/index.ts";
import { playOrder, sectionsOf } from "../src/core/musicxml.ts";
import { chordName, chordNameNotes, chordNotes } from "../src/core/chords.ts";
import { musicXml, q } from "./helpers.ts";

const C4 = 60;
const notesKey = (s: Score) => s.notes.map((n) => `${n.hand}${n.midi}@${n.start}-${n.end}`).join(" ");
const beatsKey = (s: Score) => s.beats.map((b) => `${b.bar}.${b.label}`).join(" ");

/** L'aller-retour .ymn doit retrouver exactement les mêmes notes et les mêmes temps. */
function roundTrip(score: Score, width = 96) {
  const text = writeYmn(score, { width });
  const back = parseYmn(text);
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
    const fa = score.notes.find((n) => n.hand === "D" && n.midi === 66 && n.start === 8 * 3 * T);
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

  it("garde l'alignement d'un 2 contre 3 entre les mains", () => {
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
    expect(sys.right[0].center[0]).toBe(1);
    expect(sys.right[0].center[4]).toBe(0);
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
    const s = parseYmn("m1 ||:1  |2  :||1  |2  ||\n0  ||:1  |-   ||5  |   ||\n---\n-1 || 1  |    ||1  |   ||\n");
    expect(s.repeats).toEqual([{ barIndex: 0, start: true, end: true }]);
  });

  it("marque la dernière barre du morceau comme barre de fin", () => {
    const s = parseYmn("m1 |1  ||1  ||1  ||1  ||\n0  |1  ||1  ||1  ||1  ||\n---\n");
    const sys = layout(s, { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 })[0];
    const bars = sys.columns.filter((c) => c.kind === "barSep");
    expect(bars.map((c) => !!(c as { final?: boolean }).final)).toEqual([false, false, false, true]);
  });

  it("garde les textes de la ligne @", () => {
    const s = parseYmn("@   rit.     a tempo\nm1 |1  |2  ||1  ||\n0  |1  |   ||1  ||\n---\n");
    expect(s.texts.map((t) => t.text)).toEqual(["rit.", "a tempo"]);
    expect(writeYmn(s)).toMatch(/^@ +rit\. +a tempo$/m);
  });

  it("refuse une indication qui ne commence pas sur une case", () => {
    expect(() => parseYmn("@     rit.\nm1 |1  |2  ||\n0  |1  |   ||\n---\n")).toThrow(/doit commencer exactement sur une case/);
  });

  it("refuse « 3× » hors d'une fin de reprise", () => {
    expect(() => parseYmn("@   3×\nm1 |1  ||\n0  |1  ||\n---\n")).toThrow(/:\|\|/);
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
    expect(parseYmn(text).order).toEqual(s.order);
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
    const s = parseYmn(piece("A B A", at([3, "*A"], [bar[1] + 1, "*B"])));
    expect(s.markers).toEqual([{ label: "A", barIndex: 0 }, { label: "B", barIndex: 2 }]);
    expect(s.order).toEqual(["A", "B", "A"]);
    expect(s.meta.order).toBeUndefined();
  });

  it("commence chaque section sur un nouveau système, et ferme la précédente d'une double barre", () => {
    const s = parseYmn(piece("A B A", at([3, "*A"], [bar[1] + 1, "*B"])));
    const systems = layout(s, { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 });
    expect(systems.map((x) => x.section)).toEqual(["A", "B"]);
    expect(systems.map((x) => x.endsSection)).toEqual([true, false]);
    const bars = systems[0].columns.filter((c) => c.kind === "barSep") as { section?: boolean }[];
    expect(bars.map((c) => !!c.section)).toEqual([false, true]);
    // à l'écriture aussi : la section B ouvre le second système
    expect(writeYmn(s)).toMatch(/\n\n@  \*B\nm3 \|/);
  });

  it("refuse un ordre de jeu qui nomme une section absente", () => {
    expect(() => parseYmn(piece("A C", at([3, "*A"], [bar[1] + 1, "*B"])))).toThrow(/aucune section « \*C »/);
  });

  it("refuse un morceau qui commence avant sa première section", () => {
    expect(() => parseYmn(piece("B", at([bar[1] + 1, "*B"])))).toThrow(/première mesure/);
  });

  it("refuse une reprise à cheval sur deux sections", () => {
    const r = "m1 ||:1  ||1  ||1  :||1  ||";
    const b = [...r.matchAll(/\|\|/g)].map((m) => m.index!);
    const notes = "0  ||:1  ||1  ||1  :||1  ||";
    expect(() => parseYmn(piece("A B", at([4, "*A"], [b[1] + 1, "*B"]), r, notes))).toThrow(/reprise passe le début de la section « \*B »/);
  });
});

describe("erreurs de saisie", () => {
  const base = (body: string) => `m1 |1  |2  ||\n───┼───┼───┼┼\n${body}`;
  const err = (txt: string) => {
    try {
      parseYmn(txt);
    } catch (e) {
      return (e as Error).message;
    }
    return "aucune erreur";
  };

  it("exige le trait entre les mains", () => {
    expect(err("m1 |1  |2  ||\n0  |1  |-  ||")).toMatch(/trait qui sépare/);
  });
  it("signale une étiquette de case inconnue", () => {
    expect(err("m1 |1  x  |2  ||\n───\n0  |1     |-  ||\n───")).toMatch(/ligne 1, col\. 8 : étiquette de case « x » inconnue/);
  });
  it("refuse un « - » en début de système", () => {
    expect(err(base("0  |-  |   ||\n───┼───┼───┼┼"))).toMatch(/ligne 3.*écris le numéro de la note/);
  });
  it("refuse un numéro hors de 1 à 12", () => {
    expect(err(base("0  |13 |   ||\n───┼───┼───┼┼"))).toMatch(/ligne 3, col\. 5 : case invalide « 13 »/);
  });
  it("demande l'octave sur la première ligne d'une main", () => {
    expect(err(base("   |1  |   ||\n───┼───┼───┼┼"))).toMatch(/indiquer son octave/);
  });
  it("lit les octaves relatives au do central", () => {
    const s = parseYmn("m1 |1  ||\n+1 |1  ||\n0  |1  ||\n---\n-1 |1  ||\n-2 |1  ||\n");
    expect(s.notes.map((n) => n.midi)).toEqual([72, 60, 48, 36]);
  });
  it("écrit les octaves relatives au do central", () => {
    const text = writeYmn(parseYmn("m1 |1  ||\n+1 |1  ||\n---\n-1 |1  ||\n"));
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
    const s = parseYmn("---\ntitle: Essai\ncomposer: Moi\ncell: 3\n---\nm1 |1  ||\n0  |1  ||\n---\n");
    expect(s.meta).toMatchObject({ title: "Essai", composer: "Moi", cell: 3 });
    const text = writeYmn(s);
    expect(text).toContain("title: Essai");
    expect(text).toContain("composer: Moi");
  });
  it("accepte une saisie minimale à la main", () => {
    const s = parseYmn("m1 |1  |2  ||\n0  |5  |-  ||\n---\n-1 |1  |   ||\n");
    expect(notesKey(s)).toBe(`D64@0-${2 * T} G48@0-${T}`);
  });
});

describe("nuances et soufflets", () => {
  const expr = (s: Score) => s.expressions.map((e) => `${e.hand}:${e.kind}:${e.text}@${e.t / T}`).join(" ");
  const pins = (s: Score) => s.hairpins.map((h) => `${h.hand}${h.kind}${h.start / T}-${h.end / T}`).join(" ");
  const piece = [
    "m1 |1  |2  |3  |4  ||",
    "0  |1  |3  |5  |-  ||",
    "@   p   <------",
    "---",
    "-1 |1  |   |   |   ||",
    "@   mf      >--",
    "",
  ].join("\n");

  it("lit les lignes @ sous chaque main", () => {
    const s = parseYmn(piece);
    expect(expr(s)).toBe("D:dynamic:p@0 G:dynamic:mf@0");
    // le soufflet finit avec la case qui contient son dernier caractère
    expect(pins(s)).toBe("D<1-3 G>2-3");
  });

  it("écrit nuances et soufflets sous leur main, et les relit à l'identique", () => {
    const s = parseYmn(piece);
    const text = writeYmn(s);
    const lines = text.split("\n");
    const sep = lines.findIndex((l, i) => i > 2 && /^─/.test(l) && lines[i - 1].startsWith("@"));
    expect(lines[sep - 1]).toMatch(/^@ +p +<-+$/);
    expect(lines.filter((l) => l.startsWith("@")).pop()).toMatch(/^@ +mf +>-+$/);
    const back = parseYmn(text);
    expect(expr(back)).toBe(expr(s));
    expect(pins(back)).toBe(pins(s));
  });

  it("garde un soufflet qui passe d'un système au suivant", () => {
    const bars = Array.from({ length: 8 }, () => "1  |2  |3  ||").join("");
    const notes = Array.from({ length: 8 }, () => "1  |   |   ||").join("");
    const s = parseYmn(`m1 |${bars}\n0  |${notes}\n@   <\n---\n`);
    s.hairpins[0].end = 20 * T; // de la mesure 1 au milieu de la mesure 7
    const text = writeYmn(s, { width: 40 });
    expect(text.split("\n").filter((l) => /^@ +<-*$/.test(l)).length).toBeGreaterThan(1);
    const back = parseYmn(text);
    expect(pins(back)).toBe("D<0-20");
    // un soufflet coupé reste ouvert au point de coupure
    const spans = layout(back, { width: 40, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 }).flatMap((x) => x.voices.D.hairpins);
    expect(spans[0].from).toBe(0);
    expect(spans[0].to).toBeGreaterThan(0);
    expect(spans[spans.length - 1].to).toBe(1);
  });

  it("garde « più f » comme un seul texte", () => {
    const s = parseYmn("m1 |1  |2  ||\n0  |1  |   ||\n@   più f\n---\n");
    expect(expr(s)).toBe("D:text:più f@0");
  });

  it("refuse une ligne de notes sous la ligne @ de sa main", () => {
    expect(() => parseYmn("m1 |1  ||\n0  |1  ||\n@   p\n   |3  ||\n---\n")).toThrow(/sous une ligne @/);
  });

  it("refuse une nuance qui ne commence pas sur une case", () => {
    expect(() => parseYmn("m1 |1  |2  ||\n0  |1  |   ||\n@    p\n---\n")).toThrow(/doit commencer exactement sur une case/);
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
    expect(expr(s)).toBe("D:dynamic:p@0 G:text:dolce@0 D:dynamic:f@3");
    expect(pins(s)).toBe("D<1-3");
    roundTrip(s);
    expect(expr(parseYmn(writeYmn(s)))).toBe("D:dynamic:p@0 G:text:dolce@0 D:dynamic:f@3");
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
    const s = parseYmn(body(at([4, "Ped."], [17, "*Ped."], [25, "*"])));
    expect(pk(s)).toBe("0-3 3-5");
  });

  it("écrit la pédale sur sa propre ligne, tout en bas, et la relit à l'identique", () => {
    const s = parseYmn(body(at([4, "Ped."], [17, "*Ped."], [25, "*"])));
    const text = writeYmn(s);
    expect(text.trimEnd().split("\n").pop()).toMatch(/^@ +Ped\. +\*Ped\. +\*$/);
    expect(pk(parseYmn(text))).toBe(pk(s));
  });

  it("tient la pédale d'un système au suivant sans la réécrire", () => {
    const bars = Array.from({ length: 8 }, () => "1  |2  |3  ||").join("");
    const notes = Array.from({ length: 8 }, () => "1  |   |   ||").join("");
    const s = parseYmn(`m1 |${bars}\n---\n-1 |${notes}\n${at([4, "Ped."])}\n`);
    expect(pk(s)).toBe("0-24"); // jamais relâchée : jusqu'à la fin du morceau
    const text = writeYmn(s, { width: 40 });
    expect(text.match(/Ped\./g)?.length).toBe(1);
    expect(pk(parseYmn(text))).toBe("0-24");
  });

  it("refuse les signes de pédale incohérents", () => {
    expect(() => parseYmn(body(at([4, "*"])))).toThrow(/sans pédale enfoncée/);
    expect(() => parseYmn(body(at([4, "Ped."], [12, "Ped."])))).toThrow(/déjà enfoncée/);
    const rh = [ruler, "0  |1  |   |   ||3  |   |   ||", at([4, "Ped."]), "---", "-1 |1  |   |   ||8  |   |   ||", ""].join("\n");
    expect(() => parseYmn(rh)).toThrow(/sous la main gauche/);
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
    expect(pk(parseYmn(writeYmn(s)))).toBe("0-2 2-3");
  });
});

describe("cases de largeur libre", () => {
  const expr = (s: Score) => s.expressions.map((e) => `${e.hand}:${e.kind}:${e.text}@${e.t / T}`).join(" ");

  it("lit une case élargie : une case va d'une étiquette à la suivante", () => {
    const s = parseYmn("m1 |1      *  |2  ||\n0  |1      3  |5  ||\n---\n");
    expect(notesKey(s)).toBe(`D60@0-${T / 2} D62@${T / 2}-${T} D64@${T}-${2 * T}`);
  });

  it("nomme « , » les cases plus fines que « . »", () => {
    const s = parseYmn("m1 |1  ,  .  ,  *  ,  .  ,  ||\n0  |1  2  3  4  5  6  7  8  ||\n---\n");
    expect(s.notes.length).toBe(8);
    expect(writeYmn(s)).toContain("|1  ,  .  ,  *  ,  .  ,  ||");
  });

  it("élargit la case d'une indication trop longue, plutôt que d'empiler les lignes @", () => {
    const s = parseYmn("m1 |1  *  |2  *  ||\n0  |1  3  |5  7  ||\n@   (mp)\n---\n");
    s.expressions.push({ hand: "D", t: T / 2, text: "dolce", kind: "text" }, { hand: "D", t: T, text: "cresc.", kind: "text" });
    const text = writeYmn(s);
    expect(text.split("\n").filter((l) => l.startsWith("@")).length).toBe(1);
    expect(text).toMatch(/^@ +\(mp\) +dolce +cresc\.$/m);
    expect(expr(parseYmn(text))).toBe("D:dynamic:(mp)@0 D:text:dolce@0.5 D:text:cresc.@1");
  });

  it("réunit une nuance et ses parenthèses écrites à part dans le MusicXML", () => {
    const dyn = (inner: string) => `<direction><direction-type><dynamics>${inner}</dynamics></direction-type><staff>1</staff></direction>`;
    const before = dyn("<other-dynamics>(</other-dynamics>") + dyn("<mp/>") + dyn("<other-dynamics>)</other-dynamics>");
    const s = importMusicXml(musicXml([{ notes: [[{ midi: [C4], dur: 4 * q, before }]] }]));
    expect(expr(s)).toBe("D:dynamic:(mp)@0");
  });

  it("garde « Ped. simile » comme un seul texte", () => {
    const s = parseYmn("m1 |1  |2  ||\n0  |1  |   ||\n---\n-1 |1  |   ||\n@   Ped. simile\n");
    expect(s.pedalTexts.map((e) => e.text)).toEqual(["Ped. simile"]);
    expect(s.pedals).toEqual([]);
    expect(parseYmn(writeYmn(s)).pedalTexts.map((e) => e.text)).toEqual(["Ped. simile"]);
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
    const s = parseYmn("m1 |1  |2  |3  ||\n0  |1  |3  |5  ||\n@   p <-------\n---\n");
    expect(s.hairpins).toEqual([{ hand: "D", kind: "<", start: 0, end: 3 * T }]);
    const text = writeYmn(s);
    expect(text.split("\n").filter((l) => l.startsWith("@")).length).toBe(1);
    expect(text).toMatch(/^@ +p <-+$/m);
    expect(parseYmn(text).hairpins).toEqual(s.hairpins);
  });
});

describe("point d'orgue", () => {
  it("lit « ^ » sur la ligne @ du haut, sans le coller à un texte voisin", () => {
    const s = parseYmn("@   dolce ^\nm1 |1    |2    |3    |4    ||\n0  |1    |     |     |5    ||\n---\n");
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
  const gk = (s: Score) => s.graces.map((g) => `${g.hand}${g.midi}@${g.t / T}#${g.slot}`).join(" ");
  const piece = [
    "m1 |1        |2  |3        |4  ||",
    "+1 |3'       |   |         |   ||",
    "0  |   7'9'5 |-  |10'12'7  |1  ||",
    "---",
    "-1 |1        |8  |5'5'5    |1  ||",
    "",
  ].join("\n");

  it("lit les petites notes de gauche à droite dans la case, chacune dans son octave", () => {
    const s = parseYmn(piece);
    expect(gk(s)).toBe("D74@0#0 D66@0#1 D68@0#2 D69@2#0 D71@2#1 G52@2#0 G52@2#1");
    // les petites notes ne comptent pas dans le temps
    expect(notesKey(s)).toBe("D64@0-5760 G48@0-2880 G55@2880-5760 D66@5760-8640 G52@5760-8640 D60@8640-11520 G48@8640-11520");
  });

  it("joue ensemble deux petites notes alignées", () => {
    const s = parseYmn("m1 |1     |2  ||\n+1 |3'    |   ||\n0  |7'5   |   ||\n---\n");
    expect(gk(s)).toBe("D74@0#0 D66@0#0");
  });

  it("refuse une petite note placée après la note de sa case", () => {
    expect(() => parseYmn("m1 |1     |2  ||\n0  |5 3'  |   ||\n---\n")).toThrow(/avant la note de sa case/);
  });

  it("garde les petites notes à l'aller-retour, en alignant les notes de la case", () => {
    const s = parseYmn(piece);
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
    expect(gk(s)).toBe("D62@0#0 D64@0#1 D71@2#0 D67@2#0");
    expect(notesKey(s)).toBe("D60@0-5760 G48@0-11520 D72@5760-11520");
    expect(gk(roundTrip(s).back)).toBe(gk(s));
  });
});

describe("consignes de pédale", () => {
  const ruler = "m1 |1  |2  |3  ||1  |2  |3  ||";
  const piece = (rh: string, lh: string) => [ruler, "0  |1  |   |   ||3  |   |   ||", rh, "---", "-1 |1  |-  |-  ||8  |-  |-  ||", lh, ""].join("\n");

  it("lit « Ped. simile » comme une consigne de pédale, et l'écrit sur la ligne de pédale", () => {
    const s = parseYmn(piece("", "@   Ped.         *   Ped. simile").replace("\n\n---", "\n---"));
    expect(s.pedalTexts).toEqual([{ t: 4 * T, text: "Ped. simile" }]);
    expect(s.expressions).toEqual([]);
    const text = writeYmn(s);
    expect(text.trimEnd().split("\n").pop()).toMatch(/^@ +Ped\. +\* +Ped\. simile$/);
    expect(parseYmn(text).pedalTexts).toEqual(s.pedalTexts);
  });

  it("refuse une consigne de pédale sous la main droite", () => {
    expect(() => parseYmn(piece("@   Ped. simile", ""))).toThrow(/sous la main gauche/);
  });

  it("importe « Ped. simile » du MusicXML sur la ligne de pédale, même écrit sur la portée du haut", () => {
    const dir = `<direction><direction-type><words>Ped. simile</words></direction-type><staff>1</staff></direction>`;
    const s = importMusicXml(musicXml([{ notes: [[{ midi: [C4], dur: 4 * q, before: dir }]] }]));
    expect(s.pedalTexts).toEqual([{ t: 0, text: "Ped. simile" }]);
    expect(s.expressions).toEqual([]);
  });
});

describe("ornements", () => {
  const gk = (s: Score) => s.graces.map((g) => `${g.hand}${g.midi}@${g.t / T}#${g.slot}`).join(" ");
  const tk = (s: Score) => s.notes.filter((n) => n.trill !== undefined).map((n) => `${n.midi}~${n.trill}`).join(" ");
  const ruler = "m1 |1    |2    |3    |4    ||";

  it("lit une trille « 5~7 » : la note et sa voisine la plus proche", () => {
    const s = parseYmn([ruler, "0  |5~7  |-    |12~1 |-    ||", "---", ""].join("\n"));
    expect(tk(s)).toBe("64~66 71~72");
    expect(notesKey(s)).toBe(`D64@0-${2 * T} D71@${2 * T}-${4 * T}`);
    const { text, back } = roundTrip(s);
    expect(tk(back)).toBe(tk(s));
    expect(text).toContain("|5~7 ");
  });

  it("refuse une trille sur une tenue ou sans voisine", () => {
    expect(() => parseYmn([ruler, "0  |5    |-5~7 |     |     ||", "---", ""].join("\n"))).toThrow(/case invalide/);
    expect(() => parseYmn([ruler, "0  |5~5  |     |     |     ||", "---", ""].join("\n"))).toThrow(/autre note/);
  });

  it("lit les arpèges : d'une main sur sa ligne @, des deux mains sur celle du haut", () => {
    const s = parseYmn(
      ["@         \\", ruler, "0  |5    |5    |     |     ||", "   |1    |1    |     |     ||", "@   /", "---", "-1 |1    |1    |     |     ||", ""].join("\n"),
    );
    expect(s.arpeggios).toEqual([{ t: 0, hand: "D" }, { t: T, down: true }]);
    expect(s.expressions).toEqual([]);
    const { back } = roundTrip(s);
    expect(back.arpeggios).toEqual(s.arpeggios);
  });

  it("refuse deux arpèges sur un même accord", () => {
    expect(() => parseYmn(["@   /", ruler, "0  |5    |     |     |     ||", "@   /", "---", ""].join("\n"))).toThrow(/un seul arpège/);
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
    expect(gk(s)).toBe(`D62@1#0 D63@1#1 D74@2#0 D72@2#1 D70@2#2 D67@3#0 D65@3#1`);
    expect(gk(roundTrip(s).back)).toBe(gk(s));
  });

  it("joue un gruppetto placé après la note juste avant la note suivante", () => {
    const orn = `<ornaments><delayed-turn/></ornaments>`;
    const s = importMusicXml(musicXml([{ notes: [[{ midi: [64], dur: 2 * q, notations: orn }, { midi: [65], dur: 2 * q }]] }]));
    expect(gk(s)).toBe("D65@2#0 D64@2#1 D62@2#2 D64@2#3");
  });

  it("importe les arpèges : par main, ou d'un seul geste quand les deux portées partagent leur numéro", () => {
    const arp = (n: string) => `<arpeggiate number="${n}"/>`;
    const xml = musicXml([
      {
        notes: [
          [{ midi: [64, 67], dur: 2 * q, notations: arp("1") }, { midi: [64, 67], dur: 2 * q, notations: arp("2") }],
          [{ midi: [48, 55], dur: 2 * q, staff: 2, notations: arp("1") }, { midi: [48, 55], dur: 2 * q, staff: 2, notations: arp("3") }],
        ],
      },
    ]);
    expect(importMusicXml(xml).arpeggios).toEqual([{ t: 0 }, { t: 2 * T, hand: "D" }, { t: 2 * T, hand: "G" }]);
  });
});

describe("liaisons d'expression", () => {
  const sk = (s: Score) => s.slurs.map((x) => `${x.hand}${x.start / T}-${x.end / T}`).join(" ");
  const ruler = "m1 |1  |2  |3  |4  ||1  |2  |3  |4  ||";
  const rh = "0  |5  |7  |8  |10 ||8  |7  |5  |3  ||";
  const piece = (slurLine: string) => [ruler, rh, slurLine, "---", ""].join("\n");

  it("lit une liaison de la case de sa première note à celle de sa dernière", () => {
    const s = parseYmn(piece("@   (-------)   (-------------)"));
    expect(sk(s)).toBe("D0-2 D3-6");
    expect(s.expressions).toEqual([]);
  });

  it("garde les liaisons imbriquées, coupées et reprises à l'aller-retour", () => {
    const s = parseYmn(piece("@   (-------------------------)\n@       (---)        (---)"));
    expect(sk(s)).toBe("D0-6 D1-2 D4-5");
    // un système par mesure : la grande liaison est coupée puis reprise
    const text = writeYmn(s, { width: 24 });
    expect(text).toMatch(/^@ +\(-+$/m);
    expect(text).toMatch(/^@ +-+\)/m);
    expect(sk(parseYmn(text))).toBe(sk(s));
  });

  it("range les liaisons imbriquées par étages, la plus courte au plus près des notes", () => {
    const s = parseYmn(piece("@   (-------------------------)\n@       (---)        (---)"));
    const v = layout(s, { width: 999, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 })[0].voices.D;
    expect(v.slurs.map((x) => `${x.fromAnchor}-${x.toAnchor}:${x.level}`).sort()).toEqual(["0-6:1", "1-2:0", "4-5:0"]);
  });

  it("refuse une liaison jamais refermée, ou reprise sans avoir été ouverte", () => {
    expect(() => parseYmn(piece("@   (-----"))).toThrow(/jamais refermée/);
    expect(() => parseYmn(piece("@   ------)"))).toThrow(/sans liaison ouverte/);
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
    expect(sk(s)).toBe("D0-3 D1-2");
  });
});

describe("sous-titre", () => {
  const one = [{ notes: [[{ midi: [C4], dur: 4 * q }]] }];
  const withHead = (head: string) => musicXml(one).replace("<part-list>", head + "<part-list>");

  it("lit et écrit le sous-titre du frontmatter, juste après le titre", () => {
    const s = parseYmn("---\ncomposer: Chopin\nsubtitle: Op. 9 n° 2\ntitle: Nocturne\n---\nm1 |1  ||\n0  |1  ||\n---\n");
    expect(s.meta.subtitle).toBe("Op. 9 n° 2");
    expect(writeYmn(s).split("\n").slice(0, 6)).toEqual(["---", "format: 1", "title: Nocturne", "subtitle: Op. 9 n° 2", "composer: Chopin", "---"]);
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
    const s = parseYmn([ruler, "0  |5_1    |7~9_3  |8  |   ||", "   |1_5    |       |   |   ||", "---", ""].join("\n"));
    expect(fk(s)).toBe("64_1 60_5 66_3");
    expect(s.notes.find((n) => n.midi === 66)!.trill).toBe(68);
    const { text, back } = roundTrip(s);
    expect(fk(back)).toBe(fk(s));
    expect(text).toContain("7~9_3");
  });

  it("refuse un doigt hors de 1 à 5, ou posé sur une tenue", () => {
    expect(() => parseYmn([ruler, "0  |5_6    |       |   |   ||", "---", ""].join("\n"))).toThrow(/doigt de 1 à 5/);
    expect(() => parseYmn([ruler, "0  |5      |-_2    |   |   ||", "---", ""].join("\n"))).toThrow(/case invalide/);
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
    const text = writeYmn(parseYmn(body));
    expect(text.split("\n").slice(0, 3)).toEqual(["---", `format: ${FORMAT_VERSION}`, "---"]);
    expect(parseYmn(text).meta.format).toBeUndefined();
  });

  it("lit un fichier sans version comme la version courante", () => {
    expect(parseYmn(body).notes).toHaveLength(1);
  });

  it("refuse une version plus récente ou plus ancienne, en le disant", () => {
    expect(() => parseYmn(withFormat(String(FORMAT_VERSION + 1)))).toThrow(/plus récente/);
    expect(() => parseYmn(withFormat(String(FORMAT_VERSION - 1)))).toThrow(/ancienne version/);
    expect(() => parseYmn(withFormat("un"))).toThrow(/numéro de version/);
  });
});

describe("accords", () => {
  it("calcule les notes d'un accord nommé, de la basse vers l'aigu", () => {
    const n = (name: string) => chordNameNotes(name)?.join(";");
    expect(n("C")).toBe("1;5;8");
    expect(n("Am")).toBe("10;1;5");
    expect(n("Am7")).toBe("10;1;5;8");
    expect(n("G/B")).toBe("12;3;8");
    expect(n("F#m7b5")).toBe("7;10;1;5");
    expect(n("Bb")).toBe("11;3;6");
    expect(n("C6/9")).toBe("1;3;5;8;10");
    expect(n("Xm")).toBeUndefined();
    expect(n("Cfoo")).toBeUndefined();
  });

  it("reconnaît un accord à partir de ses notes, la basse décidant entre Am7 et C6", () => {
    expect(chordName([10, 1, 5])).toBe("Am");
    expect(chordName([10, 1, 5, 8])).toBe("Am7");
    expect(chordName([1, 5, 8, 10])).toBe("C6");
    expect(chordName([12, 3, 8])).toBe("G/B");
    expect(chordName([1, 2, 3])).toBeUndefined();
    expect(chordNotes("10;1;5")).toEqual([10, 1, 5]);
    expect(chordNotes("10;13")).toBeUndefined();
  });

  const piece = (chords: string) => [chords, "m1      |1  |2  |3  |4  ||", "0       |1  |-  |5  |-  ||", "---", ""].join("\n");

  it("lit la ligne @c, en nom anglais ou en notes ymn, et l'écrit au-dessus de la règle", () => {
    const s = parseYmn(piece("@c       C       10;1;5"));
    expect(s.chords).toEqual([{ t: 0, text: "C" }, { t: 2 * T, text: "10;1;5" }]);
    const { text, back } = roundTrip(s);
    expect(back.chords).toEqual(s.chords);
    const lines = text.split("\n");
    expect(lines[lines.findIndex((l) => l.startsWith("m1")) - 1]).toMatch(/^@c +C +10;1;5$/);
  });

  it("tient dans la colonne de gauche la plus étroite", () => {
    const s = parseYmn(piece("@c       Am"));
    expect(writeYmn(s)).toMatch(/^@c  Am$/m);
    expect(writeYmn(s)).toMatch(/^m1 \|1/m);
  });

  it("refuse un accord inconnu, mal placé ou sous les notes", () => {
    expect(() => parseYmn(piece("@c       Hm"))).toThrow(/accord inconnu/);
    expect(() => parseYmn(piece("@c        C"))).toThrow(/exactement sur une case/);
    expect(() => parseYmn(["m1 |1  ||", "0  |1  ||", "@c  C", "---", ""].join("\n"))).toThrow(/au-dessus de la règle/);
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
    expect(importMusicXml(xml).chords).toEqual([{ t: 0, text: "Am7" }, { t: 2 * T, text: "G/B" }]);
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
    expect(s.chords).toEqual([{ t: 0, text: "A7" }, { t: 2 * T, text: "E7" }]);
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
    const s = parseYmn(piece);
    expect(s.lyrics.filter((l) => l.verse === 1)).toEqual([
      { hand: "D", verse: 1, t: 0, text: "A", hyphen: true },
      { hand: "D", verse: 1, t: T, text: "men", extend: 4 * T },
      { hand: "D", verse: 1, t: 4 * T, text: "A", hyphen: true },
      { hand: "D", verse: 1, t: 5 * T, text: "men", extend: 8 * T },
    ]);
    expect(s.lyrics.filter((l) => l.verse === 2).map((l) => l.text)).toEqual(["oh", "la", "la", "di"]);
  });

  it("réécrit les paroles telles quelles", () => {
    const written = writeYmn(parseYmn(piece)).split("\n");
    for (const l of piece.split("\n").slice(0, 7).filter((x) => x !== "---")) expect(written).toContain(l);
  });

  it("prolonge une syllabe d'un système au suivant", () => {
    const s = parseYmn(piece);
    const text = writeYmn(s, { width: 26 });
    expect(text.match(/^@l  A-  men -------$/gm)).toHaveLength(2);
    expect(parseYmn(text).lyrics).toEqual(s.lyrics);
    // une syllabe tenue jusque dans le système suivant y reprend par « --- » en tête
    const long = parseYmn(["m1 |1  |2  ||1  |2  ||", "0  |1  |3  ||5  |-  ||", "@l  oh ------------", "---", "-1 |   |   ||   |   ||", ""].join("\n"));
    expect(long.lyrics).toEqual([{ hand: "D", verse: 1, t: 0, text: "oh", extend: 4 * T }]);
    const split = writeYmn(long, { width: 14 });
    expect(split).toMatch(/^@l  ---/m);
    expect(parseYmn(split).lyrics).toEqual(long.lyrics);
    // syllabe sur la dernière case d'un système, prolongée au suivant
    const late = parseYmn(["m1 |1  |2  ||1  |2  ||", "0  |1  |3  ||5  |-  ||", "@l      oh --------", "---", "-1 |   |   ||   |   ||", ""].join("\n"));
    expect(late.lyrics).toEqual([{ hand: "D", verse: 1, t: T, text: "oh", extend: 4 * T }]);
    expect(parseYmn(writeYmn(late, { width: 14 })).lyrics).toEqual(late.lyrics);
  });

  it("refuse des paroles mal placées", () => {
    const one = (l: string) => ["m1 |1  |2  |3  ||", "0  |1  |3  |5  ||", l, "---", "-1 |   |   |   ||", ""].join("\n");
    expect(() => parseYmn(one("@l   la"))).toThrow(/exactement sur une case/);
    expect(() => parseYmn(one("@l  ---"))).toThrow(/écris d'abord la syllabe/);
    expect(() => parseYmn(one("@l  la- --"))).toThrow(/ne se prolonge pas/);
    expect(() => parseYmn(one("@l  la -"))).toThrow(/dépasser la case/);
    expect(() => parseYmn(["@l  la", "m1 |1  ||", "0  |1  ||", "---", ""].join("\n"))).toThrow(/sous les lignes de leur main/);
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
      { hand: "D", verse: 1, t: 0, text: "A", hyphen: true },
      { hand: "D", verse: 2, t: 0, text: "Oh\u00A0!" },
      { hand: "D", verse: 1, t: T, text: "men", extend: 5 * T },
      { hand: "D", verse: 2, t: T, text: "la" },
      { hand: "D", verse: 1, t: 5 * T, text: "oui" },
    ]);
    expect(parseYmn(writeYmn(s)).lyrics).toEqual(s.lyrics);
  });
});

describe("notes alignées", () => {
  const metrics = { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 };
  const rows = (text: string, align: boolean) => layout(parseYmn(text), { ...metrics, align })[0].right.map((r) => r.cells);
  const piece = ["m1 |1  |2  |3  |4  ||", "0  |8  |   |8  |10 ||", "   |5  |5  |5  |5  ||", "   |1  |1  |   |   ||", "---", "-1 |1  |-  |-  |-  ||", ""].join("\n");

  it("range par défaut chaque accord depuis le haut du couloir", () => {
    expect(rows(piece, false)).toEqual([
      ["8", "5", "8", "10"],
      ["5", "1", "5", "5"],
      ["1", "", "", ""],
    ]);
  });

  it("garde sur sa ligne une note rejouée, l'aiguë toujours au-dessus de la grave", () => {
    expect(rows(piece, true)).toEqual([
      ["8", "", "8", "10"],
      ["5", "5", "5", "5"],
      ["1", "1", "", ""],
    ]);
  });

  it("ne touche pas au texte .ymn", () => {
    expect(writeYmn(parseYmn(piece))).toContain("0  |8  |5  |8  |10 ||");
  });

  it("ajoute une ligne quand des chaînes se croisent, et seulement alors", () => {
    // le 5 tient tout du long : le 8 au-dessus, puis le 3 au-dessous
    const cross = ["m1 |1  |2  ||", "0  |8  |5  ||", "   |5  |3  ||", "---", "-1 |   |   ||", ""].join("\n");
    expect(rows(cross, true)).toEqual([
      ["8", ""],
      ["5", "5"],
      ["", "3"],
    ]);
  });
});
