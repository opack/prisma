import { describe, expect, it } from "vitest";
import { playedPedals, soundingEnds, withSimile } from "../pedal.ts";
import { parsePrisma, TICKS_PER_BEAT } from "../../../core/index.ts";
import type { Score } from "../../../core/index.ts";

describe("écoute : pédale", () => {
  const base = parsePrisma("m1 |1  ||\n0  |1  ||\n");
  const score = (notes: Score["notes"], pedals: Score["pedals"], staves = 1): Score => ({ ...base, parts: [{ staves }], notes, pedals });
  const note = (start: number, end: number, midi = 60, staff = 0) => ({
    staff,
    midi,
    start: start * TICKS_PER_BEAT,
    end: end * TICKS_PER_BEAT,
  });
  const ped = (start: number, end: number, staff = 0) => ({ staff, start: start * TICKS_PER_BEAT, end: end * TICKS_PER_BEAT });

  it("tient une note relâchée jusqu'à ce que la pédale remonte", () => {
    expect(soundingEnds(score([note(0, 1), note(1, 2, 64), note(3, 4)], [ped(0, 3)]))).toEqual([
      3 * TICKS_PER_BEAT,
      3 * TICKS_PER_BEAT,
      4 * TICKS_PER_BEAT,
    ]);
  });

  it("efface à un changement de pédale l'harmonie relâchée avant, et garde la nouvelle", () => {
    // *Ped. au temps 2 : la note relâchée pile au changement s'éteint, celle attaquée là est reprise
    expect(soundingEnds(score([note(0, 2), note(2, 3, 64)], [ped(0, 2), ped(2, 4)]))).toEqual([2 * TICKS_PER_BEAT, 4 * TICKS_PER_BEAT]);
  });

  it("arrête une note tenue par la pédale quand la même touche est rejouée", () => {
    expect(soundingEnds(score([note(0, 1), note(2, 3)], [ped(0, 4)]))).toEqual([2 * TICKS_PER_BEAT, 4 * TICKS_PER_BEAT]);
  });

  it("vaut pour toutes les portées de la partie, posée sous la dernière", () => {
    expect(soundingEnds(score([note(0, 1, 72, 0), note(0, 1, 48, 1)], [ped(0, 2, 1)], 2))).toEqual([
      2 * TICKS_PER_BEAT,
      2 * TICKS_PER_BEAT,
    ]);
  });
});

describe("écoute : Ped. simile", () => {
  /** Un morceau de n mesures de 2 temps, sur une portée. */
  const piece = (beats: number, more: Partial<Score>): Score => ({
    ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
    beats: Array.from(
      { length: 2 * beats },
      (_, index) =>
        ({ bar: String((index >> 1) + 1), barIndex: index >> 1, label: (index % 2) + 1, division: 2 }) as Score["beats"][number],
    ),
    notes: [],
    ...more,
  });
  const ped = (start: number, end: number) => ({ staff: 0, start: start * TICKS_PER_BEAT, end: end * TICKS_PER_BEAT, implied: true });
  const simile = (beat: number) => ({ staff: 0, t: beat * TICKS_PER_BEAT, text: "Ped. simile" });

  it("reproduit le motif de la dernière mesure pédalée, mesure par mesure", () => {
    // un changement à chaque temps : Ped. sur le 1, *Ped. sur le 2, puis simile
    const score = piece(3, { pedals: [ped(0, 1), ped(1, 2)], pedalTexts: [simile(0)] });
    expect(playedPedals(score).slice(2)).toEqual([ped(2, 3), ped(3, 4), ped(4, 5), ped(5, 6)]);
  });

  it("s'arrête au prochain signe de pédale écrit, ou à la section suivante", () => {
    const score = piece(4, { pedals: [ped(0, 2), ped(6, 7)], pedalTexts: [simile(0)] });
    expect(playedPedals(score).slice(2)).toEqual([ped(2, 4), ped(4, 6)]);
    const other = piece(4, {
      pedals: [ped(0, 2)],
      pedalTexts: [simile(0)],
      markers: [
        { label: "A", barIndex: 0 },
        { label: "B", barIndex: 2 },
      ],
    });
    expect(playedPedals(other).slice(1)).toEqual([ped(2, 4)]);
  });

  it("grave les pédales du simile comme les autres, atténuées, ou laisse la mention seule", () => {
    const score = piece(2, { pedals: [{ staff: 0, start: 0, end: 2 * TICKS_PER_BEAT }], pedalTexts: [simile(0)] });
    const plain = withSimile(score, "pedals");
    expect(plain.pedals).toEqual([
      { staff: 0, start: 0, end: 2 * TICKS_PER_BEAT },
      { staff: 0, start: 2 * TICKS_PER_BEAT, end: 4 * TICKS_PER_BEAT },
    ]);
    expect(plain.pedalTexts).toEqual([]);
    expect(withSimile(score, "faded").pedals[1]).toEqual(ped(2, 4));
    expect(withSimile(score, "text")).toBe(score);
  });
});
