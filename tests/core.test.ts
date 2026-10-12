import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TICKS_PER_BEAT as T, importMusicXml, layout, parseYmn, writeYmn } from "../src/core/index.ts";
import type { Score } from "../src/core/index.ts";
import { unfold } from "../src/core/musicxml.ts";
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

  it("compte le 6/8 en deux temps ternaires", () => {
    const e = q / 2;
    const xml = musicXml([
      { time: [6, 8], notes: [[...[60, 62, 64, 65, 67, 69].map((m) => ({ midi: [m], dur: e }))]] },
    ]);
    const score = importMusicXml(xml);
    expect(score.beats).toHaveLength(2);
    expect(score.beats.every((b) => b.division === 3)).toBe(true);
    const { text } = roundTrip(score);
    expect(text).toContain("|1  :  :  |2  :  :  ||");
    expect(text).toContain("division: 3");
  });

  it("nomme les doubles croches du 6/8 avec « . »", () => {
    const s = q / 4;
    const xml = musicXml([{ time: [6, 8], notes: [[...Array(12)].map((_, i) => ({ midi: [60 + i], dur: s }))] }]);
    const { text } = roundTrip(importMusicXml(xml));
    expect(text).toContain("|1  .  :  .  :  .  |2  .  :  .  :  .  ||");
  });

  it("traite un triolet en 4/4 comme un temps ternaire", () => {
    const t = q / 3;
    const xml = musicXml([
      { notes: [[{ midi: [60], dur: q }, { midi: [62], dur: t }, { midi: [64], dur: t }, { midi: [65], dur: t }, { midi: [67], dur: 2 * q }]] },
    ]);
    const { text } = roundTrip(importMusicXml(xml));
    expect(text).toContain("|1  |2  :  :  |3  |4  ||");
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
  it("déroule une reprise simple", () => {
    const m = { startRepeat: false, endRepeat: false, times: 2 };
    expect(unfold([m, { ...m, startRepeat: true }, { ...m, endRepeat: true }, m])).toEqual([0, 1, 2, 1, 2, 3]);
  });

  it("déroule les cases 1 et 2", () => {
    const m = { startRepeat: false, endRepeat: false, times: 2 };
    const ms = [m, m, { ...m, endRepeat: true, endings: [1] }, { ...m, endings: [2] }, m];
    expect(unfold(ms)).toEqual([0, 1, 2, 0, 1, 3, 4]);
  });

  const n = (p: number) => ({ notes: [[{ midi: [p], dur: 4 * q }]] });

  it("garde les reprises et les cases du MusicXML telles qu'écrites", () => {
    const xml = musicXml([
      n(60),
      { ...n(62), barlineLeft: `<ending number="1" type="start"/>`, barline: `<ending number="1" type="stop"/><repeat direction="backward"/>` },
      { ...n(64), barlineLeft: `<ending number="2" type="start"/>`, barline: `<ending number="2" type="stop"/>` },
    ]);
    const score = importMusicXml(xml);
    expect(score.notes.map((x) => x.midi)).toEqual([60, 62, 64]);
    expect(score.repeats).toEqual([{ barIndex: 1, end: true }]);
    expect(score.endings).toEqual([
      { numbers: [1], firstBar: 1, lastBar: 1 },
      { numbers: [2], firstBar: 2, lastBar: 2 },
    ]);
    const { text } = roundTrip(score);
    expect(text).toContain(":||");
    expect(text).toMatch(/^@ +\[1\. +\[2\. +\]$/m);
  });

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

  it("garde une case de plusieurs mesures et une case groupée « 1.2. »", () => {
    const xml = musicXml([
      { ...n(60), barlineLeft: `<repeat direction="forward"/>` },
      { ...n(62), barlineLeft: `<ending number="1, 2" type="start"/>` },
      { ...n(64), barline: `<ending number="1, 2" type="stop"/><repeat direction="backward" times="3"/>` },
      { ...n(65), barlineLeft: `<ending number="3" type="start"/>` },
      { ...n(67), barline: `<ending number="3" type="stop"/>` },
      n(69),
    ]);
    const score = importMusicXml(xml);
    expect(score.endings).toEqual([
      { numbers: [1, 2], firstBar: 1, lastBar: 2 },
      { numbers: [3], firstBar: 3, lastBar: 4 },
    ]);
    const { text } = roundTrip(score);
    expect(text).toContain("[1.2.");
    expect(text).toContain("[3.");
  });

  it("lit une reprise écrite à la main, sans les deux points sur les lignes de notes", () => {
    const s = parseYmn(
      "@   [1.        [2.\nm1 ||:1  |2  :||1  |2  ||\n0  ||:1  |-   ||5  |   ||\n---\n-1 || 1  |    ||1  |   ||\n",
    );
    expect(s.repeats).toEqual([{ barIndex: 0, start: true, end: true }]);
    expect(s.endings).toEqual([
      { numbers: [1], firstBar: 0, lastBar: 0 },
      { numbers: [2], firstBar: 1, lastBar: 1, open: true },
    ]);
  });

  // règle de 4 mesures d'un temps : barres aux colonnes 3, 7-8, 12-13, 17-18 et 22-23
  const grid = (marks: string) =>
    `@${marks}\nm1 |1  ||1  ||1  ||1  ||\n0  |1  ||1  ||1  ||1  ||\n---\n`;

  it("prolonge une case sans « ] » jusqu'à la fin du morceau", () => {
    const s = parseYmn(grid("       [2."));
    expect(s.endings).toEqual([{ numbers: [2], firstBar: 1, lastBar: 3, open: true }]);
  });

  it("ferme une case sur le « ] » placé sur la barre de fin de mesure", () => {
    const s = parseYmn(grid("       [2.      ]"));
    expect(s.endings).toEqual([{ numbers: [2], firstBar: 1, lastBar: 2 }]);
  });

  it("arrête une case sans fin avant le « ||: » suivant", () => {
    const s = parseYmn("@       [2.\nm1 |1  ||1  ||1  ||:1  ||\n0  |1  ||1  ||1  ||:1  ||\n---\n");
    expect(s.endings).toEqual([{ numbers: [2], firstBar: 1, lastBar: 2, open: true }]);
  });

  it("enchaîne « ][2. » sur une même barre, à la lecture comme à l'écriture", () => {
    // case 1 sur la mesure 2, fermée sur le premier « | » de la barre 12-13 ; case 2 ouverte sur le second
    const s = parseYmn(grid("       [1. ][2."));
    expect(s.endings).toEqual([
      { numbers: [1], firstBar: 1, lastBar: 1 },
      { numbers: [2], firstBar: 2, lastBar: 3, open: true },
    ]);
    const at = writeYmn(s).split("\n").filter((l) => l.startsWith("@"));
    expect(at).toEqual(["@       [1. ][2."]);
  });

  it("refuse « [1. » sur le premier « | » d'une barre « || »", () => {
    expect(() => parseYmn(grid("      [2."))).toThrow(/dernier « \| » de la barre/);
  });

  it("refuse « ] » sur le second « | » d'une barre « || »", () => {
    expect(() => parseYmn(grid("       [2.       ]"))).toThrow(/premier « \| » de la barre/);
  });

  it("refuse « [1. » placé sur une case au lieu d'une barre", () => {
    expect(() => parseYmn(grid("        [2."))).toThrow(/barre qui ouvre une mesure/);
  });

  it("refuse « ] » placé ailleurs que sur une barre de fin de mesure", () => {
    expect(() => parseYmn(grid("       [2.    ]"))).toThrow(/barre qui ferme une mesure/);
  });

  it("écrit « [ » et « ] » sur les barres de mesure", () => {
    const text = writeYmn(parseYmn(grid("       [2.      ]")));
    const at = text.split("\n").find((l) => l.startsWith("@"))!;
    const ruler = text.split("\n").find((l) => l.startsWith("m1"))!;
    expect(ruler[at.indexOf("[")]).toBe("|");
    expect(ruler[at.indexOf("]")]).toBe("|");
  });

  it("importe une case MusicXML sans crochet de fin comme une case ouverte", () => {
    const xml = musicXml([
      n(60),
      { ...n(62), barlineLeft: `<ending number="1" type="start"/>`, barline: `<ending number="1" type="stop"/><repeat direction="backward"/>` },
      { ...n(64), barlineLeft: `<ending number="2" type="start"/>` },
      { ...n(65), barline: `<ending number="2" type="discontinue"/>` },
    ]);
    const score = importMusicXml(xml);
    expect(score.endings[1]).toEqual({ numbers: [2], firstBar: 2, lastBar: 3, open: true });
    const { text } = roundTrip(score);
    expect(text).not.toContain("]"); // pas de fin explicite à écrire
  });

  it("ne trace le crochet d'une case ouverte qu'au-dessus de sa première mesure", () => {
    const sys = layout(parseYmn(grid("       [2.")), { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 })[0];
    const span = sys.endings[0];
    expect(span.toAnchor).toBe(1); // ancre de la mesure 2 seulement
    expect(span.hook).toBe(false);
  });

  it("ferme le crochet d'une case dont la mesure finit le morceau", () => {
    const sys = layout(parseYmn(grid("                 [2.")), { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 })[0];
    expect(sys.endings[0].hook).toBe(true);
  });

  it("marque la dernière barre du morceau comme barre de fin", () => {
    const sys = layout(parseYmn(grid("")), { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 })[0];
    const bars = sys.columns.filter((c) => c.kind === "barSep");
    expect(bars.map((c) => !!(c as { final?: boolean }).final)).toEqual([false, false, false, true]);
  });

  it("ferme le crochet d'une case terminée par « ] »", () => {
    const sys = layout(parseYmn(grid("       [2.      ]")), { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 })[0];
    expect(sys.endings[0].hook).toBe(true);
    expect(sys.endings[0].toAnchor).toBe(2);
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
  it("signale une largeur de temps incorrecte", () => {
    expect(err("m1 |1   |2  ||\n───\n0  |1   |-  ||\n───")).toMatch(/ligne 1, col\. 5 : le temps fait 4 caractères/);
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
