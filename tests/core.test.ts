import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { TICKS_PER_BEAT as T, importMusicXml, parseYmn, writeYmn } from "../src/core/index.ts";
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

  it("lit les barres de reprise du MusicXML", () => {
    const n = (p: number) => ({ notes: [[{ midi: [p], dur: 4 * q }]] });
    const xml = musicXml([
      n(60),
      { ...n(62), barlineLeft: `<ending number="1" type="start"/>`, barline: `<ending number="1" type="stop"/><repeat direction="backward"/>` },
      { ...n(64), barlineLeft: `<ending number="2" type="start"/>`, barline: `<ending number="2" type="stop"/>` },
    ]);
    const score = importMusicXml(xml);
    expect(score.notes.map((x) => x.midi)).toEqual([60, 62, 60, 64]);
    expect(beatsKey(score).split(" ").filter((b) => b.endsWith(".1"))).toEqual(["1.1", "2.1", "3.1", "4.1"]);
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
    expect(err("m1 |1  |2  ||\n4  |1  |-  ||")).toMatch(/trait qui sépare/);
  });
  it("signale une largeur de temps incorrecte", () => {
    expect(err("m1 |1   |2  ||\n───\n4  |1   |-  ||\n───")).toMatch(/ligne 1, col\. 5 : le temps fait 4 caractères/);
  });
  it("refuse un « - » en début de système", () => {
    expect(err(base("4  |-  |   ||\n───┼───┼───┼┼"))).toMatch(/ligne 3.*écris le numéro de la note/);
  });
  it("refuse un numéro hors de 1 à 12", () => {
    expect(err(base("4  |13 |   ||\n───┼───┼───┼┼"))).toMatch(/ligne 3, col\. 5 : case invalide « 13 »/);
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
  it("refuse une octave mal écrite", () => {
    expect(err("m1 |1  ||\n+a |1  ||\n---\n")).toMatch(/octave invalide/);
  });
  it("accepte encore l'ancien format (octave absolue, do central = 4)", () => {
    const s = parseYmn("m1 |1  |2  ||\n4  |5  |-  ||\n---\n3  |1  |   ||\n");
    expect(notesKey(s)).toBe(`D64@0-${2 * T} G48@0-${T}`);
  });
});
