import { describe, expect, it } from "vitest";
import { barAt, entryAt, entryStart, holds, inFirstBar, nextElsewhere, nextTick, passages, playedBars, playedNotes, playedSections, playedTick, scoreTick, stretched, unstretched } from "../performance.ts";
import { playNotes } from "../player.ts";
import { staffNames } from "../staves.ts";
import { parsePrisma, TICKS_PER_BEAT as T } from "../../../core/index.ts";
import type { Score } from "../../../core/index.ts";

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

  it("compte les mesures dans l'ordre où elles se jouent, et les range par section (où en est la lecture)", () => {
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

  it("place le curseur et le clic sur le bon passage d'une reprise", () => {
    const s = bars(3, { repeats: [{ barIndex: 1, end: true }] }); // joué 1 2 1 2 3
    const ps = passages(s);
    expect(scoreTick(ps, 2.5 * T)).toBe(0.5 * T);
    expect(playedTick(ps, 0, 0)).toBe(0); // au début : le premier passage
    expect(playedTick(ps, 0, 3 * T)).toBe(2 * T); // pendant le second passage : on y reste
    expect(playedTick(ps, 2 * T, 0)).toBe(4 * T); // la fin, jouée une seule fois
  });

  it("sait ce qu'on jouera après un système : la suite, ou le retour d'une reprise", () => {
    const s = bars(3, { repeats: [{ barIndex: 1, end: true }] }); // joué 1 2 1 2 3
    const ps = passages(s);
    expect(nextTick(ps, 0.5 * T, T)).toBe(T); // dans la mesure 1 : la mesure 2
    expect(nextTick(ps, 1.5 * T, 3 * T)).toBe(0); // dans la mesure 2, la reprise : retour à la 1
    expect(nextTick(ps, 3.5 * T, 3 * T)).toBe(2 * T); // la seconde fois : la mesure 3
    expect(nextTick(ps, 4.5 * T, 3 * T)).toBeNull(); // la fin du morceau
  });

  it("sait quel autre système on jouera ensuite, une reprise sur place passée", () => {
    const s = bars(3, { repeats: [{ barIndex: 1, end: true }] }); // joué 1 2 1 2 3
    const ps = passages(s);
    // un système des mesures 1 et 2 : la reprise y reste, on en sort à la mesure 3
    expect(nextElsewhere(ps, 0.5 * T, 0, 2 * T)).toBe(2 * T);
    expect(nextElsewhere(ps, 2.5 * T, 0, 2 * T)).toBe(2 * T);
    // un système de la mesure 2 : la reprise ramène à la 1, ailleurs ; la seconde fois, la 3
    expect(nextElsewhere(ps, 1.5 * T, T, 2 * T)).toBe(0);
    expect(nextElsewhere(ps, 3.5 * T, T, 2 * T)).toBe(2 * T);
    // le dernier système : on n'en sort plus
    expect(nextElsewhere(ps, 4.5 * T, 2 * T, 3 * T)).toBeNull();
    // une reprise qui s'ouvre dans le premier système (joué 1 2 3 2 3) : le passage suivant y commence
    // encore, on en sort à la mesure 3 ; nextTick, lui, s'arrêtait au début de la reprise
    const opened = passages(bars(3, { repeats: [{ barIndex: 1, start: true }, { barIndex: 2, end: true }] }));
    expect(nextTick(opened, 0.5 * T, 2 * T)).toBe(T);
    expect(nextElsewhere(opened, 0.5 * T, 0, 2 * T)).toBe(2 * T);
  });

  it("revient au passage le plus récent quand on clique en arrière, et va à une section par sa lettre", () => {
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

describe("écoute : petites notes", () => {
  it("joue les petites notes juste avant leur note, de gauche à droite", () => {
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
  it("sait si l'on est encore dans la première mesure de la section jouée", () => {
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
  it("alterne la note et sa voisine, en commençant et en finissant par la note", () => {
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
  it("égrène l'accord à partir du temps, du grave à l'aigu ou de l'aigu au grave", () => {
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
  it("tient deux fois plus longtemps ce qui commence sous le point d'orgue, et décale la suite", () => {
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
  it("raccourcit le staccato, renforce l'accent, et les deux pour le marcato", () => {
    const s = parsePrisma(["m1 |1  |2  |3  |4  ||", "0  |8  |10 |12 |8  ||", "@   .   !   !!", ""].join("\n"));
    expect(playedNotes(s, passages(s)).map((n) => [n.midi, (n.end - n.start) / T, n.velocity])).toEqual([
      [67, 0.5, 70],
      [69, 1, 90],
      [71, 0.75, 98],
      [67, 1, 70],
    ]);
  });
});

describe("écoute : portées", () => {
  it("nomme les portées : les mains d'un clavier, le rang ailleurs", () => {
    expect(staffNames([{ staves: 2 }])).toEqual(["Main droite", "Main gauche"]);
    expect(staffNames([{ name: "Chant", staves: 1 }, { name: "Piano", staves: 2 }])).toEqual(["Chant", "Piano — main droite", "Piano — main gauche"]);
    expect(staffNames([{ name: "Chœur", staves: 2 }])).toEqual(["Chœur — portée 1", "Chœur — portée 2"]);
  });

  it("garde la portée de chaque note jouée, pour pouvoir la rendre muette", () => {
    const s = parsePrisma("m1 |1  ||\n0  |1  ||\n---\n-1 |1  ||\n");
    expect(playedNotes(s, passages(s)).map((n) => [n.midi, n.staff])).toEqual([[48, 1], [60, 0]]);
  });
});
