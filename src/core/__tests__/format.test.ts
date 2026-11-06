import { describe, expect, it } from "vitest";
import { FORMAT_VERSION, importMusicXml, layout, parsePrisma, TICKS_PER_BEAT, writePrisma } from "../index.ts";
import { C4, musicXml, QUARTER } from "../../../tests/support/musicxml.ts";
import { beatsKey, notesKey, roundTrip } from "../../../tests/support/round-trip.ts";
import type { Score } from "../index.ts";

describe("règles du format", () => {
  it("rappelle la note tenue en début de système avec « -N »", () => {
    // une ronde de do sur deux mesures liées, à 24 caractères par ligne : une mesure par système
    const xml = musicXml([
      { notes: [[{ midi: [C4], duration: 4 * QUARTER, tie: ["start"] }]] },
      { notes: [[{ midi: [C4], duration: 4 * QUARTER, tie: ["stop"] }]] },
    ]);
    const score = importMusicXml(xml);
    expect(score.notes).toHaveLength(1);
    const { text } = roundTrip(score, 24);
    const rows = text.split("\n").filter((line) => line.startsWith("0 "));
    expect(rows[0]).toMatch(/^0\s+\|1 /);
    expect(rows[1]).toMatch(/^0\s+\|-1 /);
  });

  it("commence une anacrouse au bon temps", () => {
    const xml = musicXml([
      { time: [3, 4], implicit: true, notes: [[{ midi: [67], duration: QUARTER }]] },
      { notes: [[{ midi: [C4], duration: 3 * QUARTER }]] },
    ]);
    const score = importMusicXml(xml);
    expect(beatsKey(score)).toBe("0.3 1.1 1.2 1.3");
    expect(score.notes[0].start).toBe(0);
    const { text } = roundTrip(score);
    expect(text).toMatch(/^m0 \|3  \|\|1 /m);
  });

  it("numérote 1 une anacrouse que le fichier compte comme mesure 1", () => {
    const score = importMusicXml(
      musicXml([{ time: [3, 4], notes: [[{ midi: [67], duration: QUARTER }]] }, { notes: [[{ midi: [60], duration: 3 * QUARTER }]] }]),
    );
    expect(beatsKey(score)).toBe("1.3 2.1 2.2 2.3");
    roundTrip(score);
  });

  it("compte le 6/8 en deux temps ternaires", () => {
    const eighth = QUARTER / 2;
    const xml = musicXml([{ time: [6, 8], notes: [[...[60, 62, 64, 65, 67, 69].map((midi) => ({ midi: [midi], duration: eighth }))]] }]);
    const score = importMusicXml(xml);
    expect(score.beats).toHaveLength(2);
    expect(score.beats.every((beat) => beat.division === 3)).toBe(true);
    const { text } = roundTrip(score);
    expect(text).toContain("|1  *  *  |2  *  *  ||");
    expect(text).toContain("division: 3");
  });

  it("nomme les doubles croches du 6/8 avec « . »", () => {
    const sixteenth = QUARTER / 4;
    const xml = musicXml([{ time: [6, 8], notes: [[...Array(12)].map((_, index) => ({ midi: [60 + index], duration: sixteenth }))] }]);
    const { text } = roundTrip(importMusicXml(xml));
    expect(text).toContain("|1  .  *  .  *  .  |2  .  *  .  *  .  ||");
  });

  it("traite un triolet en 4/4 comme un temps ternaire", () => {
    const tripletEighth = QUARTER / 3;
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [60], duration: QUARTER },
            { midi: [62], duration: tripletEighth },
            { midi: [64], duration: tripletEighth },
            { midi: [65], duration: tripletEighth },
            { midi: [67], duration: 2 * QUARTER },
          ],
        ],
      },
    ]);
    const { text } = roundTrip(importMusicXml(xml));
    expect(text).toContain("|1  |2  *  *  |3  |4  ||");
  });

  it("garde l'alignement d'un 2 contre 3 entre les portées", () => {
    const xml = musicXml([
      {
        notes: [
          [
            { midi: [72], duration: QUARTER / 2 },
            { midi: [74], duration: QUARTER / 2 },
            { midi: [76], duration: 3 * QUARTER },
          ],
          [
            { midi: [48], duration: QUARTER / 3, staff: 2 },
            { midi: [52], duration: QUARTER / 3, staff: 2 },
            { midi: [55], duration: QUARTER / 3, staff: 2 },
            { midi: [48], duration: 3 * QUARTER, staff: 2 },
          ],
        ],
      },
    ]);
    roundTrip(importMusicXml(xml));
  });

  it("coupe une mesure trop large sur un temps", () => {
    const sixteenth = QUARTER / 4;
    const xml = musicXml([{ notes: [[...Array(16)].map((_, index) => ({ midi: [60 + (index % 12)], duration: sixteenth }))] }]);
    const { text } = roundTrip(importMusicXml(xml), 40);
    expect(text).toMatch(/^m1 \|3 /m); // le second système reprend la mesure 1 au temps 3
  });

  it("met une note seule sur la ligne du haut de son couloir, même si un accord suit", () => {
    // do5 seul, puis l'accord do5-mi5-sol5 : l'ancien tri par hauteur moyenne
    // plaçait le do5 seul sur la ligne du milieu
    const xml = musicXml([
      { notes: [[{ midi: [72], duration: 4 * QUARTER }]] },
      { notes: [[{ midi: [72, 76, 79], duration: 4 * QUARTER }]] },
    ]);
    const { text } = roundTrip(importMusicXml(xml));
    const rows = text.split("\n").filter((line) => /^(\+1| ) *\|/.test(line) && !line.startsWith("m"));
    expect(rows[0]).toMatch(/^\+1 \|1 /);
    expect(rows.map((row) => row.slice(-15))).toEqual([
      "|-  |-  ||8  |-  |-  |-  ||".slice(-15),
      "|   |   ||5  |-  |-  |-  ||".slice(-15),
      "|   |   ||1  |-  |-  |-  ||".slice(-15),
    ]);
  });

  it("calcule le décalage qui centre un bloc dans son couloir", () => {
    const xml = musicXml([
      { notes: [[{ midi: [72], duration: 4 * QUARTER }]] },
      { notes: [[{ midi: [72, 76, 79], duration: 4 * QUARTER }]] },
    ]);
    const [sys] = layout(importMusicXml(xml), { width: 200, prefix: 4, cell: 3, beatSep: 1, barSep: 2, repeatDots: 1 });
    // couloir de 3 lignes : la note seule (mesure 1) descend d'une ligne, l'accord (mesure 2) ne bouge pas
    expect(sys.staves[0].rows[0].center[0]).toBe(1);
    expect(sys.staves[0].rows[0].center[4]).toBe(0);
  });

  it("place les accords d'une même octave sur plusieurs lignes", () => {
    const xml = musicXml([{ notes: [[{ midi: [60, 64, 67], duration: 4 * QUARTER }]] }]);
    const { text } = roundTrip(importMusicXml(xml));
    const rows = text.split("\n").filter((line) => /^[ 0]\s*\|[^─]/.test(line) && !line.startsWith("m"));
    expect(rows.map((row) => row.slice(0, 7))).toEqual(["0  |8  ", "   |5  ", "   |1  "]);
  });
});

describe("cases de largeur libre", () => {
  const expr = (score: Score) =>
    score.expressions
      .map((expression) => `${expression.staff}:${expression.kind}:${expression.text}@${expression.t / TICKS_PER_BEAT}`)
      .join(" ");

  it("lit une case élargie : une case va d'une étiquette à la suivante", () => {
    const score = parsePrisma("m1 |1      *  |2  ||\n0  |1      3  |5  ||\n---\n");
    expect(notesKey(score)).toBe(
      `0:60@0-${TICKS_PER_BEAT / 2} 0:62@${TICKS_PER_BEAT / 2}-${TICKS_PER_BEAT} 0:64@${TICKS_PER_BEAT}-${2 * TICKS_PER_BEAT}`,
    );
  });

  it("nomme « , » les cases plus fines que « . »", () => {
    const score = parsePrisma("m1 |1  ,  .  ,  *  ,  .  ,  ||\n0  |1  2  3  4  5  6  7  8  ||\n---\n");
    expect(score.notes.length).toBe(8);
    expect(writePrisma(score)).toContain("|1  ,  .  ,  *  ,  .  ,  ||");
  });

  it("élargit la case d'une indication trop longue, plutôt que d'empiler les lignes @", () => {
    const score = parsePrisma("m1 |1  *  |2  *  ||\n0  |1  3  |5  7  ||\n@   (mp)\n---\n");
    score.expressions.push(
      { staff: 0, t: TICKS_PER_BEAT / 2, text: "dolce", kind: "text" },
      { staff: 0, t: TICKS_PER_BEAT, text: "cresc.", kind: "text" },
    );
    const text = writePrisma(score);
    expect(text.split("\n").filter((line) => line.startsWith("@")).length).toBe(1);
    expect(text).toMatch(/^@ +\(mp\) +dolce +cresc\.$/m);
    expect(expr(parsePrisma(text))).toBe("0:dynamic:(mp)@0 0:text:dolce@0.5 0:text:cresc.@1");
  });

  it("réunit une nuance et ses parenthèses écrites à part dans le MusicXML", () => {
    const dyn = (inner: string) => `<direction><direction-type><dynamics>${inner}</dynamics></direction-type><staff>1</staff></direction>`;
    const before = dyn("<other-dynamics>(</other-dynamics>") + dyn("<mp/>") + dyn("<other-dynamics>)</other-dynamics>");
    const score = importMusicXml(musicXml([{ notes: [[{ midi: [C4], duration: 4 * QUARTER, before }]] }]));
    expect(expr(score)).toBe("0:dynamic:(mp)@0");
  });

  it("garde « Ped. simile » comme un seul texte", () => {
    const score = parsePrisma("m1 |1  |2  ||\n0  |1  |   ||\n---\n-1 |1  |   ||\n@   Ped. simile\n");
    expect(score.pedalTexts.map((pedalText) => pedalText.text)).toEqual(["Ped. simile"]);
    expect(score.pedals).toEqual([]);
    expect(parsePrisma(writePrisma(score)).pedalTexts.map((pedalText) => pedalText.text)).toEqual(["Ped. simile"]);
  });

  it("cale un septolet sur 8 cases plutôt que sur 48", () => {
    // 7 notes dans une noire : impossibles à écrire exactement
    const notes = Array.from({ length: 7 }, (_, index) => ({ midi: [C4 + index], duration: 12 }));
    const score = importMusicXml(musicXml([{ time: [1, 4], notes: [notes] }], 84));
    expect(score.notes.map((note) => note.start / (TICKS_PER_BEAT / 8))).toEqual([0, 1, 2, 3, 5, 6, 7]);
    const { text } = roundTrip(score);
    expect(text).toContain("|1  ,  .  ,  *  ,  .  ,  ||");
  });

  it("ignore les petites notes de réplique et les notes cachées, sans décaler le temps", () => {
    // 2e voix : un sol caché, puis un la qui doit rester au 3e temps
    const xml = musicXml([
      {
        notes: [
          [{ midi: [C4], duration: 4 * QUARTER }],
          [
            { midi: [67], duration: 2 * QUARTER },
            { midi: [69], duration: 2 * QUARTER },
          ],
        ],
      },
    ]).replace(/<note>(<pitch><step>G<\/step>)/, '<note print-object="no">$1');
    const score = importMusicXml(xml);
    expect(score.notes.map((note) => `${note.midi}@${note.start / TICKS_PER_BEAT}`)).toEqual(["60@0", "69@2"]);
  });

  it("écrit un soufflet juste après la nuance de la même case", () => {
    const score = parsePrisma("m1 |1  |2  |3  ||\n0  |1  |3  |5  ||\n@   p <-------\n---\n");
    expect(score.hairpins).toEqual([{ staff: 0, kind: "<", start: 0, end: 3 * TICKS_PER_BEAT }]);
    const text = writePrisma(score);
    expect(text.split("\n").filter((line) => line.startsWith("@")).length).toBe(1);
    expect(text).toMatch(/^@ +p <-+$/m);
    expect(parsePrisma(text).hairpins).toEqual(score.hairpins);
  });
});

describe("version du format", () => {
  const body = "m1 |1  ||\n0  |1  ||\n---\n";
  const withFormat = (version: string) => `---\nformat: ${version}\n---\n${body}`;

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

describe("bpm", () => {
  const body = "m1 |1  ||\n0  |1  ||\n---\n-1 |   ||\n";
  it("se lit en temps par minute, et se réécrit tel quel", () => {
    const score = parsePrisma(`---\nbpm: 78\n---\n${body}`);
    expect(score.meta.bpm).toBe(78);
    expect(writePrisma(score)).toMatch(/^bpm: 78$/m);
  });

  it("refuse un tempo en mots", () => {
    expect(() => parsePrisma(`---\nbpm: Andante\n---\n${body}`)).toThrow(/temps par minute/);
  });

  it("importe le tempo du MusicXML, converti en temps de la règle (noire pointée en 6/8)", () => {
    const sound = `<direction><direction-type><words>Allegro</words></direction-type><sound tempo="120"/></direction>`;
    const four = musicXml([{ notes: [[{ midi: [C4], duration: 4 * QUARTER, before: sound }]] }]);
    expect(importMusicXml(four).meta.bpm).toBe(120);
    const six = musicXml([{ time: [6, 8], notes: [[{ midi: [C4], duration: 6 * (QUARTER / 2), before: sound }]] }]);
    expect(importMusicXml(six).meta.bpm).toBe(80);
  });
});

describe("sous-titre", () => {
  const one = [{ notes: [[{ midi: [C4], duration: 4 * QUARTER }]] }];
  const withHead = (head: string) => musicXml(one).replace("<part-list>", head + "<part-list>");

  it("lit et écrit le sous-titre du frontmatter, juste après le titre", () => {
    const score = parsePrisma("---\ncomposer: Chopin\nsubtitle: Op. 9 n° 2\ntitle: Nocturne\n---\nm1 |1  ||\n0  |1  ||\n---\n");
    expect(score.meta.subtitle).toBe("Op. 9 n° 2");
    expect(writePrisma(score).split("\n").slice(0, 6)).toEqual([
      "---",
      "format: 1",
      "title: Nocturne",
      "subtitle: Op. 9 n° 2",
      "composer: Chopin",
      "---",
    ]);
  });

  it("garde les notes du frontmatter, après la source, sans les graver", () => {
    const score = parsePrisma(
      "---\nnotes: Doigtés de la main gauche à revoir\ntitle: Nocturne\nsource: nocturne.musicxml\n---\nm1 |1  ||\n0  |1  ||\n",
    );
    expect(score.meta.notes).toBe("Doigtés de la main gauche à revoir");
    expect(writePrisma(score).split("\n").slice(0, 6)).toEqual([
      "---",
      "format: 1",
      "title: Nocturne",
      "source: nocturne.musicxml",
      "notes: Doigtés de la main gauche à revoir",
      "---",
    ]);
  });

  it("importe le sous-titre des textes de page, en recollant ses morceaux", () => {
    const credit = `<credit page="1"><credit-type>subtitle</credit-type><credit-words>from Suite L. 75\n</credit-words><credit-words>3</credit-words><credit-words>rd</credit-words><credit-words> Movement</credit-words></credit>`;
    expect(importMusicXml(withHead(credit)).meta.subtitle).toBe("from Suite L. 75 3rd Movement");
  });

  it("prend le titre dans les textes de page quand l'œuvre n'en a pas", () => {
    const xml = withHead(`<credit page="1"><credit-type>title</credit-type><credit-words>To Zanarkand</credit-words></credit>`).replace(
      /<work>.*?<\/work>/,
      "",
    );
    expect(importMusicXml(xml).meta.title).toBe("To Zanarkand");
  });

  it("prend sinon le titre du mouvement, s'il complète celui de l'œuvre", () => {
    const xml = musicXml(one).replace("</work>", "</work><movement-title>Clair de lune</movement-title>");
    expect(importMusicXml(xml).meta).toMatchObject({ title: "Test", subtitle: "Clair de lune" });
    expect(importMusicXml(musicXml(one)).meta.subtitle).toBeUndefined();
  });
});

describe("écriture : textes qui débordent", () => {
  it("laisse un texte long déborder sur les cases suivantes, sans élargir sa case", () => {
    const score = parsePrisma("m1 |1  |2  |3  |4  ||\n0  |1  |3  |5  |8  ||\n---\n");
    score.expressions.push({ staff: 0, t: 0, text: "sempre pianissimo", kind: "text" });
    const text = writePrisma(score);
    expect(text).toMatch(/^m1 \|1  \|2  \|3  \|4  \|\|$/m);
    expect(text).toMatch(/^@   sempre pianissimo$/m);
    expect(parsePrisma(text).expressions).toEqual(score.expressions);
  });
});
