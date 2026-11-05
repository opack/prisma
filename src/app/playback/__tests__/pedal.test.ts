import { describe, expect, it } from "vitest";
import { playedPedals, soundingEnds, withSimile } from "../pedal.ts";
import { parsePrisma, TICKS_PER_BEAT as T } from "../../../core/index.ts";
import type { Score } from "../../../core/index.ts";

describe("écoute : pédale", () => {
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

  it("grave les pédales du simile comme les autres, atténuées, ou laisse la mention seule", () => {
    const s = piece(2, { pedals: [{ staff: 0, start: 0, end: 2 * T }], pedalTexts: [sim(0)] });
    const plain = withSimile(s, "pedals");
    expect(plain.pedals).toEqual([{ staff: 0, start: 0, end: 2 * T }, { staff: 0, start: 2 * T, end: 4 * T }]);
    expect(plain.pedalTexts).toEqual([]);
    expect(withSimile(s, "faded").pedals[1]).toEqual(ped(2, 4));
    expect(withSimile(s, "text")).toBe(s);
  });
});
