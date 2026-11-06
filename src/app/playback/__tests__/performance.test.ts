import { describe, expect, it } from "vitest";
import {
  barAt,
  entryAt,
  entryStart,
  holds,
  inFirstBar,
  nextElsewhere,
  nextTick,
  passages,
  playedBars,
  playedNotes,
  playedSections,
  playedTick,
  scoreTick,
  stretched,
  unstretched,
} from "../performance.ts";
import { playNotes } from "../player.ts";
import { staffNames } from "../staves.ts";
import { parsePrisma, TICKS_PER_BEAT } from "../../../core/index.ts";
import type { Score } from "../../../core/index.ts";

describe("écoute", () => {
  const two = ["---", "bpm: 120", "---", "m1 |1  |2  ||", "0  |1  |-  ||", "---", "-1 |8  |3  ||", ""].join("\n");
  /** Un morceau d'une mesure d'un temps par lettre, une note par mesure (1, 2, 3…), avec ses reprises et sections. */
  const bars = (n: number, more: Partial<Score> = {}): Score => ({
    ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
    beats: Array.from(
      { length: n },
      (_, index) => ({ bar: String(index + 1), barIndex: index, label: 1, division: 2 }) as Score["beats"][number],
    ),
    notes: Array.from({ length: n }, (_, i) => ({ staff: 0, midi: 60 + i, start: i * TICKS_PER_BEAT, end: (i + 1) * TICKS_PER_BEAT })),
    ...more,
  });
  const order = (score: Score, ps: ReturnType<typeof passages>) =>
    playedNotes(score, ps)
      .map((playedNote) => playedNote.midi - 59)
      .join(" ");

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
    expect(playNotes(playedNotes(s, passages(s)), 60, TICKS_PER_BEAT)).toEqual([
      { time: 0, midi: 50, duration: 1, velocity: 70, staff: 1 },
      { time: 0, midi: 60, duration: 1, velocity: 70, staff: 0 },
    ]);
  });

  it("déroule les reprises, au nombre de passages indiqué", () => {
    const s = parsePrisma("m1 ||:1  |2  :||1  |2  ||\n0  ||:1  |-   ||5  |   ||\n---\n-1 || 1  |    ||1  |   ||\n");
    expect(playedNotes(s, passages(s)).map((playedNote) => [playedNote.start / TICKS_PER_BEAT, playedNote.midi])).toEqual([
      [0, 48],
      [0, 60],
      [2, 48],
      [2, 60],
      [4, 48],
      [4, 64],
    ]);
    const three = bars(4, {
      repeats: [
        { barIndex: 1, start: true },
        { barIndex: 2, end: true, times: 3 },
      ],
    });
    expect(order(three, passages(three))).toBe("1 2 3 2 3 2 3 4");
    // sans « ||: », on revient au début ; « :||: » enchaîne deux reprises
    const r = bars(4, {
      repeats: [
        { barIndex: 0, end: true },
        { barIndex: 1, start: true },
        { barIndex: 2, end: true },
      ],
    });
    expect(order(r, passages(r))).toBe("1 1 2 3 2 3 4");
  });

  it("suit l'ordre des sections, et chaque reprise reste dans la sienne", () => {
    const s = bars(4, {
      markers: [
        { label: "A", barIndex: 0 },
        { label: "B", barIndex: 2 },
      ],
      order: ["A", "B", "A"],
      repeats: [{ barIndex: 3, end: true }],
    });
    expect(order(s, passages(s))).toBe("1 2 3 4 3 4 1 2");
  });

  it("compte les mesures dans l'ordre où elles se jouent, et les range par section (où en est la lecture)", () => {
    const s = bars(4, {
      markers: [
        { label: "A", barIndex: 0 },
        { label: "B", barIndex: 2 },
      ],
      order: ["A", "B", "A"],
      repeats: [{ barIndex: 3, end: true }],
    });
    const played = playedBars(s, passages(s));
    // 1 2 | 3 4 3 4 | 1 2 : huit mesures jouées, une mesure d'un temps chacune
    expect(played.map((playedBar) => [playedBar.at / TICKS_PER_BEAT, playedBar.end / TICKS_PER_BEAT, playedBar.entry])).toEqual([
      [0, 1, 0],
      [1, 2, 0],
      [2, 3, 1],
      [3, 4, 1],
      [4, 5, 1],
      [5, 6, 1],
      [6, 7, 2],
      [7, 8, 2],
    ]);
    expect(playedSections(s, played)).toEqual([
      { entry: 0, label: "A", first: 0, count: 2 },
      { entry: 1, label: "B", first: 2, count: 4 },
      { entry: 2, label: "A", first: 6, count: 2 },
    ]);
    expect([0, 0.5, 5.9, 7, 99].map((t) => barAt(played, t * TICKS_PER_BEAT))).toEqual([0, 0, 5, 7, 7]);
    // sans sections : une seule, sans lettre
    const plain = bars(3);
    expect(playedSections(plain, playedBars(plain, passages(plain)))).toEqual([{ entry: 0, label: "", first: 0, count: 3 }]);
  });

  it("garde liée une note qui passe d'un passage à la suite du morceau", () => {
    const s = bars(3, { repeats: [{ barIndex: 0, end: true }] });
    s.notes = [{ staff: 0, midi: 60, start: 0, end: 3 * TICKS_PER_BEAT }];
    // après le retour en arrière la note s'arrête ; au dernier passage elle tient jusqu'au bout
    expect(playedNotes(s, passages(s))).toEqual([
      { staff: 0, start: 0, end: TICKS_PER_BEAT, midi: 60, velocity: 70 },
      { staff: 0, start: TICKS_PER_BEAT, end: 4 * TICKS_PER_BEAT, midi: 60, velocity: 70 },
    ]);
  });

  it("place le curseur et le clic sur le bon passage d'une reprise", () => {
    const s = bars(3, { repeats: [{ barIndex: 1, end: true }] }); // joué 1 2 1 2 3
    const ps = passages(s);
    expect(scoreTick(ps, 2.5 * TICKS_PER_BEAT)).toBe(0.5 * TICKS_PER_BEAT);
    expect(playedTick(ps, 0, 0)).toBe(0); // au début : le premier passage
    expect(playedTick(ps, 0, 3 * TICKS_PER_BEAT)).toBe(2 * TICKS_PER_BEAT); // pendant le second passage : on y reste
    expect(playedTick(ps, 2 * TICKS_PER_BEAT, 0)).toBe(4 * TICKS_PER_BEAT); // la fin, jouée une seule fois
  });

  it("sait ce qu'on jouera après un système : la suite, ou le retour d'une reprise", () => {
    const s = bars(3, { repeats: [{ barIndex: 1, end: true }] }); // joué 1 2 1 2 3
    const ps = passages(s);
    expect(nextTick(ps, 0.5 * TICKS_PER_BEAT, TICKS_PER_BEAT)).toBe(TICKS_PER_BEAT); // dans la mesure 1 : la mesure 2
    expect(nextTick(ps, 1.5 * TICKS_PER_BEAT, 3 * TICKS_PER_BEAT)).toBe(0); // dans la mesure 2, la reprise : retour à la 1
    expect(nextTick(ps, 3.5 * TICKS_PER_BEAT, 3 * TICKS_PER_BEAT)).toBe(2 * TICKS_PER_BEAT); // la seconde fois : la mesure 3
    expect(nextTick(ps, 4.5 * TICKS_PER_BEAT, 3 * TICKS_PER_BEAT)).toBeNull(); // la fin du morceau
  });

  it("sait quel autre système on jouera ensuite, une reprise sur place passée", () => {
    const s = bars(3, { repeats: [{ barIndex: 1, end: true }] }); // joué 1 2 1 2 3
    const ps = passages(s);
    // un système des mesures 1 et 2 : la reprise y reste, on en sort à la mesure 3
    expect(nextElsewhere(ps, 0.5 * TICKS_PER_BEAT, 0, 2 * TICKS_PER_BEAT)).toBe(2 * TICKS_PER_BEAT);
    expect(nextElsewhere(ps, 2.5 * TICKS_PER_BEAT, 0, 2 * TICKS_PER_BEAT)).toBe(2 * TICKS_PER_BEAT);
    // un système de la mesure 2 : la reprise ramène à la 1, ailleurs ; la seconde fois, la 3
    expect(nextElsewhere(ps, 1.5 * TICKS_PER_BEAT, TICKS_PER_BEAT, 2 * TICKS_PER_BEAT)).toBe(0);
    expect(nextElsewhere(ps, 3.5 * TICKS_PER_BEAT, TICKS_PER_BEAT, 2 * TICKS_PER_BEAT)).toBe(2 * TICKS_PER_BEAT);
    // le dernier système : on n'en sort plus
    expect(nextElsewhere(ps, 4.5 * TICKS_PER_BEAT, 2 * TICKS_PER_BEAT, 3 * TICKS_PER_BEAT)).toBeNull();
    // une reprise qui s'ouvre dans le premier système (joué 1 2 3 2 3) : le passage suivant y commence
    // encore, on en sort à la mesure 3 ; nextTick, lui, s'arrêtait au début de la reprise
    const opened = passages(
      bars(3, {
        repeats: [
          { barIndex: 1, start: true },
          { barIndex: 2, end: true },
        ],
      }),
    );
    expect(nextTick(opened, 0.5 * TICKS_PER_BEAT, 2 * TICKS_PER_BEAT)).toBe(TICKS_PER_BEAT);
    expect(nextElsewhere(opened, 0.5 * TICKS_PER_BEAT, 0, 2 * TICKS_PER_BEAT)).toBe(2 * TICKS_PER_BEAT);
  });

  it("revient au passage le plus récent quand on clique en arrière, et va à une section par sa lettre", () => {
    // A B B B C, une mesure chacune : joué 1 2 2 2 3
    const s = bars(3, {
      markers: [
        { label: "A", barIndex: 0 },
        { label: "B", barIndex: 1 },
        { label: "C", barIndex: 2 },
      ],
      order: ["A", "B", "B", "B", "C"],
    });
    const ps = passages(s);
    expect(playedTick(ps, TICKS_PER_BEAT, 0)).toBe(TICKS_PER_BEAT); // à l'arrêt : le premier B
    expect(playedTick(ps, TICKS_PER_BEAT + TICKS_PER_BEAT / 2, 2.2 * TICKS_PER_BEAT)).toBe(2.5 * TICKS_PER_BEAT); // dans le 2e B : on y reste
    expect(playedTick(ps, TICKS_PER_BEAT, 4.5 * TICKS_PER_BEAT)).toBe(3 * TICKS_PER_BEAT); // depuis C : le 3e B, juste avant
    expect(playedTick(ps, 2 * TICKS_PER_BEAT, 1.5 * TICKS_PER_BEAT)).toBe(4 * TICKS_PER_BEAT); // C n'est pas encore joué : on y va
    expect(entryAt(ps, 2.5 * TICKS_PER_BEAT)).toBe(2);
    expect(entryStart(ps, 3)).toBe(3 * TICKS_PER_BEAT);
  });
});

describe("écoute : petites notes", () => {
  it("joue les petites notes juste avant leur note, de gauche à droite", () => {
    // l'exemple de FORMAT.md, sur le 2e temps : 3 (octave du dessus), 7, 9, puis le 5 sur le temps
    const score = parsePrisma(["m1 |1  |2        ||", "+1 |   |3'       ||", "0  |1  |  7'9'5  ||", ""].join("\n"));
    const notes = playNotes(playedNotes(score, passages(score)), 60);
    expect(notes.map((playNote) => [playNote.midi, +playNote.time.toFixed(2), +playNote.duration.toFixed(2)])).toEqual([
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
    const score: Score = {
      ...parsePrisma("m1 |1  ||\n0  |1  ||\n"),
      beats: Array.from(
        { length: 6 },
        (_, index) =>
          ({ bar: String((index >> 1) + 1), barIndex: index >> 1, label: (index % 2) + 1, division: 2 }) as Score["beats"][number],
      ),
      markers: [
        { label: "A", barIndex: 0 },
        { label: "B", barIndex: 2 },
      ],
      order: ["A", "B", "A"],
    };
    const ps = passages(score);
    expect([0, 1.5, 2, 3].map((t) => inFirstBar(score, ps, t * TICKS_PER_BEAT))).toEqual([true, true, false, false]);
    expect([4, 5.5, 6, 7.5, 8].map((t) => inFirstBar(score, ps, t * TICKS_PER_BEAT))).toEqual([true, true, true, true, false]);
  });
});

describe("écoute : trilles", () => {
  it("alterne la note et sa voisine, en commençant et en finissant par la note", () => {
    const score = parsePrisma("m1 |1  |2  ||\n0  |5~7|1  ||\n");
    const notes = playNotes(playedNotes(score, passages(score)), 60).filter((playNote) => playNote.time < 1 - 1e-9);
    expect(notes.length % 2).toBe(1);
    expect(notes.length).toBeGreaterThan(9);
    expect(notes.map((n) => n.midi)).toEqual(notes.map((_, index) => (index % 2 ? 66 : 64)));
    const last = notes[notes.length - 1];
    expect(last.time + last.duration).toBeCloseTo(1);
  });
});

describe("écoute : arpèges", () => {
  it("égrène l'accord à partir du temps, du grave à l'aigu ou de l'aigu au grave", () => {
    const score = parsePrisma(
      ["m1 |1    |2    ||", "0  |8    |8    ||", "   |5    |5    ||", "   |1    |1    ||", "@   /     \\", ""].join("\n"),
    );
    const notes = playNotes(playedNotes(score, passages(score)), 60);
    const at = (t: number) =>
      notes.filter((playNote) => playNote.time >= t && playNote.time < t + 0.5).map((n) => [n.midi, +n.time.toFixed(2)]);
    expect(at(0)).toEqual([
      [60, 0],
      [64, 0.04],
      [67, 0.08],
    ]);
    expect(at(1)).toEqual([
      [67, 1],
      [64, 1.04],
      [60, 1.08],
    ]);
    // toutes les notes s'arrêtent ensemble, à la fin de l'accord
    expect(notes.filter((n) => n.time < 0.5).map((n) => +(n.time + n.duration).toFixed(2))).toEqual([1, 1, 1]);
  });
});

describe("écoute : point d'orgue", () => {
  it("tient deux fois plus longtemps ce qui commence sous le point d'orgue, et décale la suite", () => {
    const score = parsePrisma(["@       ^", "m1 |1  |2  |3  ||", "0  |1  |5  |8  ||", ""].join("\n"));
    const ps = passages(score);
    const hs = holds(score, ps);
    expect(hs).toEqual([{ at: TICKS_PER_BEAT, length: TICKS_PER_BEAT }]);
    expect(playNotes(playedNotes(score, ps), 60, 0, hs).map((playNote) => [playNote.midi, playNote.time, playNote.duration])).toEqual([
      [60, 0, 1],
      [64, 1, 2],
      [67, 3, 1],
    ]);
    // le curseur reste sur la case du point d'orgue pendant qu'il dure
    expect([0.5, 1.5, 2.5, 3.5].map((c) => unstretched(hs, c * TICKS_PER_BEAT) / TICKS_PER_BEAT)).toEqual([0.5, 1.25, 1.75, 2.5]);
    expect(stretched(hs, 2.5 * TICKS_PER_BEAT) / TICKS_PER_BEAT).toBe(3.5);
  });
});

describe("écoute : articulations", () => {
  it("raccourcit le staccato, renforce l'accent, et les deux pour le marcato", () => {
    const score = parsePrisma(["m1 |1  |2  |3  |4  ||", "0  |8  |10 |12 |8  ||", "@   .   !   !!", ""].join("\n"));
    expect(
      playedNotes(score, passages(score)).map((playedNote) => [
        playedNote.midi,
        (playedNote.end - playedNote.start) / TICKS_PER_BEAT,
        playedNote.velocity,
      ]),
    ).toEqual([
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
    expect(
      staffNames([
        { name: "Chant", staves: 1 },
        { name: "Piano", staves: 2 },
      ]),
    ).toEqual(["Chant", "Piano — main droite", "Piano — main gauche"]);
    expect(staffNames([{ name: "Chœur", staves: 2 }])).toEqual(["Chœur — portée 1", "Chœur — portée 2"]);
  });

  it("garde la portée de chaque note jouée, pour pouvoir la rendre muette", () => {
    const score = parsePrisma("m1 |1  ||\n0  |1  ||\n---\n-1 |1  ||\n");
    expect(playedNotes(score, passages(score)).map((playedNote) => [playedNote.midi, playedNote.staff])).toEqual([
      [48, 1],
      [60, 0],
    ]);
  });
});
