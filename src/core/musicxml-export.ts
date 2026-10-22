/**
 * Export MusicXML (« score-partwise » 4.0) : un morceau Prisma, pour l'ouvrir dans MuseScore ou un
 * autre logiciel de partition. C'est le chemin inverse de l'import ; la partition classique
 * demande ce que Prisma a retiré, et l'export le reconstitue :
 *
 * - le nom des notes (dièse ou bémol) et l'armure, d'après la tonalité du morceau (ou celle que
 *   ses notes font deviner) ;
 * - les figures de durée : une note qui passe une barre devient des notes liées, une durée qu'aucune
 *   figure ne rend se découpe en figures liées, et un temps coupé en 3 (ou 5, 6, 7) devient un triolet
 *   (un quintolet…) ;
 * - les voix : dans une portée, les notes qui commencent et finissent ensemble forment un accord, les
 *   autres vont dans des voix distinctes ;
 * - la clé de chaque portée, d'après ses notes ;
 * - l'ordre de jeu : sans ordre, les reprises s'écrivent en barres de reprise ; avec un ordre, le
 *   morceau est déroulé, les sections dans l'ordre où elles se jouent (leur lettre en repère).
 *
 * Toutes les hauteurs sont écrites telles qu'elles sonnent.
 */
import { recognize } from "./chords.ts";
import { chordNotes } from "./chords.ts";
import { guessInstrument } from "./instruments.ts";
import type { InstrumentName } from "./instruments.ts";
import { guessKey, parseKey } from "./key.ts";
import type { Key } from "./key.ts";
import { TICKS_PER_BEAT as T, firstStaves } from "./model.ts";
import type { Lyric, Note, Score, Staff } from "./model.ts";
import { fretOf } from "./strings.ts";
import type { Strings } from "./strings.ts";

/** Divisions MusicXML par noire : un tick vaut 2 divisions dans une mesure simple, 3 dans une composée. */
const DIVISIONS = 5760;

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Programme General MIDI (1 à 128) de chaque instrument de l'écoute. */
const PROGRAM: Record<InstrumentName, number> = {
  piano: 1, "electric-piano": 5, harpsichord: 7, organ: 20, accordion: 22, guitar: 25, "electric-bass": 34, harp: 47,
  violin: 41, viola: 42, cello: 43, "double-bass": 44, strings: 49, flute: 74, oboe: 69, clarinet: 72, bassoon: 71,
  saxophone: 66, trumpet: 57, horn: 61, trombone: 58, voice: 53, marimba: 13, vibraphone: 12,
};

/**
 * Le son de chaque instrument, dans la liste standard de MusicXML (`<instrument-sound>`) : c'est
 * lui qui fait choisir l'instrument à MuseScore (sa tessiture, sa clé), plus sûrement que le nom.
 */
const SOUND: Record<InstrumentName, string> = {
  piano: "keyboard.piano", "electric-piano": "keyboard.piano.electric", harpsichord: "keyboard.harpsichord", organ: "keyboard.organ",
  accordion: "keyboard.accordion", guitar: "pluck.guitar.nylon-string", "electric-bass": "pluck.bass.electric", harp: "pluck.harp",
  violin: "strings.violin", viola: "strings.viola", cello: "strings.cello", "double-bass": "strings.contrabass", strings: "strings.group",
  flute: "wind.flutes.flute", oboe: "wind.reed.oboe", clarinet: "wind.reed.clarinet", bassoon: "wind.reed.bassoon",
  saxophone: "wind.reed.saxophone.alto", trumpet: "brass.trumpet", horn: "brass.french-horn", trombone: "brass.trombone",
  voice: "voice.vocals", marimba: "pitched-percussion.marimba", vibraphone: "pitched-percussion.vibraphone",
};

/* ---------------------------------------------------------------- noms des notes */

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_ORDER = "FCGDAEB";
const pc = (n: number) => ((n % 12) + 12) % 12;

/** L'armure d'une tonalité : le nombre de dièses (> 0) ou de bémols (< 0). */
function fifthsOf(k: Key): number {
  const major = pc(k.tonic - 1 + (k.minor ? 3 : 0));
  const f = pc(major * 7);
  // fa♯ majeur (6 dièses) plutôt que sol♭, mais ré♭ (5 bémols) plutôt que do♯ (7 dièses)
  return f > 6 ? f - 12 : f;
}

/** L'altération d'une lettre à l'armure. */
const keyAlter = (fifths: number, letter: string) => {
  const i = SHARP_ORDER.indexOf(letter);
  return fifths > 0 && i < fifths ? 1 : fifths < 0 && i >= 7 + fifths ? -1 : 0;
};

/** Le nom d'une hauteur dans une armure : la lettre de l'armure, sinon la note naturelle, sinon un dièse (ou un bémol en tonalité bémolisée). */
function spell(midi: number, fifths: number): { step: string; alter: number; octave: number } {
  const p = pc(midi);
  const candidates = LETTERS.flatMap((letter) => [-1, 0, 1].filter((a) => pc(STEP[letter] + a) === p).map((alter) => ({ letter, alter })));
  const rank = (c: { letter: string; alter: number }) =>
    c.alter === keyAlter(fifths, c.letter) ? 0 : c.alter === 0 ? 1 : (fifths >= 0 ? c.alter > 0 : c.alter < 0) ? 2 : 3;
  const best = candidates.sort((a, b) => rank(a) - rank(b))[0];
  return { step: best.letter, alter: best.alter, octave: Math.floor((midi - best.alter) / 12) - 1 };
}

/* ---------------------------------------------------------------- figures de durée */

/** Figures, de la plus longue à la plus courte, en noires. */
const TYPES: [string, number][] = [
  ["whole", 4],
  ["half", 2],
  ["quarter", 1],
  ["eighth", 0.5],
  ["16th", 0.25],
  ["32nd", 0.125],
  ["64th", 0.0625],
  ["128th", 0.03125],
];
/** Les durées qu'une seule figure rend, pointée ou non, en divisions. */
const SHAPES = TYPES.flatMap(([type, q]) => [0, 1, 2].map((dots) => ({ type, dots, div: Math.round(q * DIVISIONS * (2 - 1 / 2 ** dots)) }))).sort((a, b) => b.div - a.div);
const shapeOf = (div: number) => SHAPES.find((s) => s.div === div);

/** Une durée en figures liées, de la plus longue à la plus courte ; undefined si aucune suite de figures ne la rend. */
function figures(div: number): { type: string; dots: number; div: number }[] | undefined {
  const out = [];
  let rest = div;
  while (rest > 0) {
    // la durée entière d'une seule figure, sinon la plus longue figure simple qui y tient
    const pick = shapeOf(rest) ?? SHAPES.find((x) => x.div <= rest && x.dots === 0);
    if (!pick) return undefined;
    out.push(pick);
    rest -= pick.div;
  }
  return out;
}

/** Les tuplets essayés : n notes à la place de m. */
const TUPLETS: [number, number][] = [
  [3, 2],
  [5, 4],
  [6, 4],
  [7, 4],
  [9, 8],
];

/* ---------------------------------------------------------------- mesures */

type Bar = { index: number; number: string; start: number; end: number; beats: number; compound: boolean; implicit: boolean };

function barsOf(score: Score): Bar[] {
  // une mesure composée (6/8, 9/8…) : ses temps se coupent en 3 par défaut (« division: 3 ») ; un
  // temps coupé en 3 dans une mesure simple est un triolet
  const compound = Number(score.meta.division) === 3;
  const bars: Bar[] = [];
  score.beats.forEach((b, i) => {
    const last = bars[bars.length - 1];
    if (last && last.index === b.barIndex) {
      last.end = (i + 1) * T;
      last.beats++;
    } else bars.push({ index: b.barIndex, number: b.bar, start: i * T, end: (i + 1) * T, beats: 1, compound, implicit: i === 0 && b.label > 1 });
  });
  return bars;
}

/** La métrique d'une mesure complète : ses temps, en noires (2/4, 3/4…) ou en noires pointées (6/8, 9/8…). */
function timeOf(bar: Bar, full: number) {
  return bar.compound ? { beats: full * 3, type: 8 } : { beats: full, type: 4 };
}

/** L'ordre des mesures à écrire : déroulé selon l'ordre de jeu, ou tel quel (les reprises en barres). */
function barOrder(score: Score, bars: Bar[]): number[] {
  if (!score.order.length) return bars.map((_, i) => i);
  const starts = score.markers.map((m) => ({ ...m, at: bars.findIndex((b) => b.index === m.barIndex) }));
  const out: number[] = [];
  for (const label of score.order) {
    const m = starts.find((x) => x.label === label);
    if (!m) continue;
    const next = starts.filter((x) => x.at > m.at).sort((a, b) => a.at - b.at)[0];
    const end = next ? next.at : bars.length;
    for (let i = m.at; i < end; i++) out.push(i);
  }
  return out;
}

/* ---------------------------------------------------------------- voix */

/** Un accord d'une voix : des notes qui commencent et finissent ensemble. */
type Group = { start: number; end: number; notes: Note[] };

/** Les voix d'une portée : chaque accord dans la première voix libre à son début, l'accord le plus aigu d'abord ; la voix du dessus en premier. */
function voicesOf(notes: Note[]): Group[][] {
  const groups: Group[] = [];
  for (const n of [...notes].sort((a, b) => a.start - b.start || a.end - b.end || a.midi - b.midi)) {
    const g = groups.find((x) => x.start === n.start && x.end === n.end);
    if (g) g.notes.push(n);
    else groups.push({ start: n.start, end: n.end, notes: [n] });
  }
  // à un même instant, l'accord le plus aigu d'abord : la mélodie prend la première voix
  const top = (g: Group) => Math.max(...g.notes.map((n) => n.midi));
  const voices: Group[][] = [];
  for (const g of groups.sort((a, b) => a.start - b.start || top(b) - top(a))) {
    const v = voices.find((x) => x[x.length - 1].end <= g.start);
    if (v) v.push(g);
    else voices.push([g]);
  }
  // la voix du dessus en premier, comme sur une partition : hampes en haut pour elle, en bas pour la suivante
  const mean = (v: Group[]) => v.reduce((s, g) => s + top(g), 0) / v.length;
  return voices.sort((a, b) => mean(b) - mean(a));
}

/* ---------------------------------------------------------------- écriture */

type Ctx = {
  score: Score;
  fifths: number;
  bars: Bar[];
  firstStaff: number[];
  /** Les voix de chaque portée. */
  voices: Map<Staff, Group[][]>;
  /** Les liaisons marquées sur chaque accord, à l'instant de sa note qui les porte. */
  slurMarks: Map<Group, { t: number; xml: string }[]>;
};

/** Un morceau en MusicXML. */
export function exportMusicXml(score: Score): string {
  const key = (score.meta.key ? parseKey(score.meta.key) : undefined) ?? guessKey(score) ?? { tonic: 1, minor: false };
  const fifths = fifthsOf(key);
  const bars = barsOf(score);
  const voices = new Map([...new Set(score.notes.map((n) => n.staff))].map((s) => [s, voicesOf(score.notes.filter((n) => n.staff === s))]));
  const firstStaff = firstStaves(score.parts);
  const ctx: Ctx = { score, fifths, bars, firstStaff, voices, slurMarks: slurMarks(score, voices, firstStaff, bars) };
  const order = barOrder(score, bars);
  const fullBeats = Math.max(1, ...bars.filter((b) => !b.implicit).map((b) => b.beats));

  const out: string[] = [];
  out.push('<?xml version="1.0" encoding="UTF-8"?>');
  out.push('<!DOCTYPE score-partwise PUBLIC "-//Recordare//DTD MusicXML 4.0 Partwise//EN" "http://www.musicxml.org/dtds/partwise.dtd">');
  out.push('<score-partwise version="4.0">');
  const { title, subtitle, composer } = score.meta;
  if (title) out.push(`  <work><work-title>${esc(title)}</work-title></work>`);
  out.push("  <identification>");
  if (composer) out.push(`    <creator type="composer">${esc(composer)}</creator>`);
  out.push("    <encoding><software>Prisma</software></encoding>");
  out.push("  </identification>");
  if (subtitle) out.push(`  <credit page="1"><credit-type>subtitle</credit-type><credit-words>${esc(subtitle)}</credit-words></credit>`);
  out.push("  <part-list>");
  score.parts.forEach((part, i) => {
    const instrument = part.instrument ?? guessInstrument(part.name);
    const name = part.name ?? (score.parts.length > 1 ? `Partie ${i + 1}` : "Piano");
    out.push(`    <score-part id="P${i + 1}">`);
    out.push(`      <part-name>${esc(name)}</part-name>`);
    out.push(`      <score-instrument id="P${i + 1}-I1"><instrument-name>${esc(name)}</instrument-name><instrument-sound>${SOUND[instrument]}</instrument-sound></score-instrument>`);
    out.push(`      <midi-instrument id="P${i + 1}-I1"><midi-channel>${(i % 15) + 1 + (i >= 9 ? 1 : 0)}</midi-channel><midi-program>${PROGRAM[instrument]}</midi-program></midi-instrument>`);
    out.push("    </score-part>");
  });
  out.push("  </part-list>");

  score.parts.forEach((part, p) => {
    // un instrument à cordes : sa portée deux fois, en partition puis en tablature (la seconde porte les cordes)
    const strs = part.strings;
    const staves = strs ? [ctx.firstStaff[p], ctx.firstStaff[p]] : Array.from({ length: part.staves }, (_, k) => ctx.firstStaff[p] + k);
    const voices = staves.map((s) => ctx.voices.get(s) ?? []);
    const clefs = strs ? [] : staves.map((s) => clefOf(score.notes.filter((n) => n.staff === s)));
    out.push(`  <part id="P${p + 1}">`);
    let lastTime = "";
    order.forEach((bi, k) => {
      const bar = bars[bi];
      // déroulé, les mesures se numérotent à la suite, à partir du numéro de la première
      const number = score.order.length ? String((Number(bars[0].number) || 0) + k) : bar.number;
      // une anacrouse numérotée 0 est hors décompte ; numérotée 1, elle compte
      out.push(`    <measure number="${esc(number)}"${bar.implicit && k === 0 && bar.number === "0" ? ' implicit="yes"' : ""}>`);
      const repeat = score.repeats.find((r) => r.barIndex === bar.index);
      if (repeat?.start) out.push('      <barline location="left"><bar-style>heavy-light</bar-style><repeat direction="forward"/></barline>');
      const time = timeOf(bar, bar.implicit ? fullBeats : bar.beats);
      const timeText = `${time.beats}/${time.type}`;
      if (k === 0 || timeText !== lastTime) {
        out.push("      <attributes>");
        if (k === 0) {
          out.push(`        <divisions>${DIVISIONS}</divisions>`);
          out.push(`        <key><fifths>${fifths}</fifths><mode>${key.minor ? "minor" : "major"}</mode></key>`);
        }
        out.push(`        <time><beats>${time.beats}</beats><beat-type>${time.type}</beat-type></time>`);
        if (k === 0) {
          if (staves.length > 1) out.push(`        <staves>${staves.length}</staves>`);
          clefs.forEach((c, s) => out.push(`        <clef${part.staves > 1 ? ` number="${s + 1}"` : ""}><sign>${c.sign}</sign><line>${c.line}</line></clef>`));
          if (strs) out.push(...tablatureAttributes(strs));
        }
        out.push("      </attributes>");
        lastTime = timeText;
      }
      // en tête du morceau : le tempo ; au début d'une section : sa lettre
      if (p === 0 && k === 0 && score.meta.bpm) {
        const quarters = bar.compound ? 1.5 : 1;
        out.push(
          `      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit>${bar.compound ? "<beat-unit-dot/>" : ""}<per-minute>${score.meta.bpm}</per-minute></metronome></direction-type><sound tempo="${+(score.meta.bpm * quarters).toFixed(2)}"/></direction>`,
        );
      }
      const marker = p === 0 ? score.markers.find((m) => m.barIndex === bar.index) : undefined;
      if (marker) out.push(`      <direction placement="above"><direction-type><rehearsal>${marker.label}</rehearsal></direction-type></direction>`);
      out.push(...measureBody(ctx, p, staves, voices, bar, !!strs));
      if (repeat?.end) out.push(`      <barline location="right"><bar-style>light-heavy</bar-style><repeat direction="backward"${(repeat.times ?? 2) !== 2 ? ` times="${repeat.times}"` : ""}/></barline>`);
      else if (k === order.length - 1) out.push('      <barline location="right"><bar-style>light-heavy</bar-style></barline>');
      out.push("    </measure>");
    });
    out.push("  </part>");
  });
  out.push("</score-partwise>");
  return out.join("\n") + "\n";
}

/**
 * Les clés d'un instrument à cordes : la partition, écrite une octave au-dessus de ce qui sonne
 * (clé de sol, ou de fa pour la basse, à l'octave basse), puis la tablature, avec ses cordes à vide
 * (la ligne 1 est la plus grave) et le capo.
 */
function tablatureAttributes(strs: Strings): string[] {
  const bass = strs.open.length === 4;
  const lines = [...strs.open].reverse().map((m, i) => {
    const sp = spell(m, 0);
    return `<staff-tuning line="${i + 1}"><tuning-step>${sp.step}</tuning-step>${sp.alter ? `<tuning-alter>${sp.alter}</tuning-alter>` : ""}<tuning-octave>${sp.octave}</tuning-octave></staff-tuning>`;
  });
  return [
    `        <clef number="1"><sign>${bass ? "F" : "G"}</sign><line>${bass ? 4 : 2}</line><clef-octave-change>-1</clef-octave-change></clef>`,
    '        <clef number="2"><sign>TAB</sign><line>5</line></clef>',
    `        <staff-details number="2"><staff-lines>${strs.open.length}</staff-lines>${lines.join("")}${strs.capo ? `<capo>${strs.capo}</capo>` : ""}</staff-details>`,
  ];
}

/** La clé d'une portée : de sol si ses notes sont plutôt au-dessus du si grave, de fa sinon. */
function clefOf(notes: Note[]) {
  if (!notes.length) return { sign: "G", line: 2 };
  const mean = notes.reduce((s, n) => s + n.midi, 0) / notes.length;
  return mean >= 57 ? { sign: "G", line: 2 } : { sign: "F", line: 4 };
}

/* ---------------------------------------------------------------- le contenu d'une mesure */

/** Un événement d'une voix dans la mesure : un accord (ou une note), ou un silence, sur [start, end[. */
type Event = { start: number; end: number; group?: Group };
/** Un morceau d'événement, écrit par une figure : un tuplet s'ouvre ou se ferme peut-être sur lui. */
type Piece = { e: Event; div: number; type: string; dots: number; tuplet?: [number, number]; beat: number; first: boolean; last: boolean; open?: boolean; close?: boolean };

/** tab : la seconde portée est la tablature de la première. */
function measureBody(ctx: Ctx, p: number, staves: Staff[], voices: Group[][][], bar: Bar, tab = false): string[] {
  const out: string[] = [];
  const toDiv = (ticks: number) => ticks * (bar.compound ? 3 : 2);
  let cursor = 0; // en divisions depuis le début de la mesure
  const blocks: { staff: Staff; s: number; voice: number; events: Event[]; tab: boolean }[] = [];
  staves.forEach((staff, s) => {
    voices[s].forEach((groups, v) => {
      const inBar = groups.filter((g) => g.start < bar.end && g.end > bar.start);
      if (v > 0 && !inBar.length) return;
      const events: Event[] = [];
      let t = bar.start;
      for (const g of inBar) {
        const a = Math.max(g.start, bar.start), b = Math.min(g.end, bar.end);
        if (a > t) events.push({ start: t, end: a });
        events.push({ start: a, end: b, group: g });
        t = b;
      }
      if (t < bar.end) events.push({ start: t, end: bar.end });
      blocks.push({ staff, s, voice: s * 4 + v + 1, events, tab: tab && s === 1 });
    });
  });
  blocks.forEach((block, i) => {
    if (i > 0 && cursor > 0) {
      out.push(`      <backup><duration>${cursor}</duration></backup>`);
      cursor = 0;
    }
    const secondary = (block.voice - 1) % 4 !== 0;
    const first = blocks.findIndex((b) => b.staff === block.staff) === i;
    const directions = first ? directionsOf(ctx, p, block.staff, bar) : [];
    const measureRest = block.events.length === 1 && !block.events[0].group;
    // les morceaux de la voix, puis les tuplets : un crochet par temps, du premier au dernier de ses morceaux
    const all = piecesOf(block.events, bar);
    all.forEach((x, k) => {
      if (!x.tuplet) return;
      const prev = all[k - 1], next = all[k + 1];
      x.open = !prev?.tuplet || prev.beat !== x.beat;
      x.close = !next?.tuplet || next.beat !== x.beat;
    });
    for (const e of block.events) {
      // les indications qui tombent avant la fin de cet événement, à leur place
      const from = toDiv(e.start - bar.start);
      while (directions.length && directions[0].t < e.end) {
        const d = directions.shift()!;
        const offset = toDiv(d.t - bar.start) - from;
        out.push(d.xml(offset > 0 ? offset : 0));
      }
      if (!e.group && secondary) {
        // un silence d'une voix secondaire : un simple saut
        out.push(`      <forward><duration>${toDiv(e.end - e.start)}</duration></forward>`);
      } else out.push(...eventXml(ctx, block.staff, block.s, block.voice, e, bar, measureRest, all.filter((x) => x.e === e), tab ? (block.tab ? "tab" : "notation") : undefined));
      cursor += toDiv(e.end - e.start);
    }
    // les indications à la fin de la mesure (la fin d'un soufflet, d'une pédale)
    for (const d of directions) out.push(d.xml(0));
  });
  return out;
}

/** Les morceaux des événements d'une voix : coupés aux temps où un tuplet est nécessaire, puis en figures liées. */
function piecesOf(events: Event[], bar: Bar): Piece[] {
  const toDiv = (ticks: number) => ticks * (bar.compound ? 3 : 2);
  const grid = DIVISIONS / 32; // la plus petite figure : la quadruple croche
  const beatOf = (t: number) => Math.floor((t - bar.start) / T);
  // un temps où un début ou une fin d'événement tombe hors de la grille des figures : un tuplet
  const tupletBeats = new Set(
    events
      .flatMap((x) => [x.start, x.end])
      .filter((t) => toDiv(t - bar.start) % grid !== 0)
      .map(beatOf),
  );
  const out: Piece[] = [];
  for (const e of events) {
    const cuts = [e.start];
    for (let b = beatOf(e.start) + 1; bar.start + b * T < e.end; b++) if (tupletBeats.has(b) || tupletBeats.has(b - 1)) cuts.push(bar.start + b * T);
    cuts.push(e.end);
    for (let i = 0; i + 1 < cuts.length; i++) {
      const a = cuts[i], b = cuts[i + 1];
      const beat = beatOf(a);
      const div = toDiv(b - a);
      let ratio: [number, number] | undefined;
      let figs = tupletBeats.has(beat) ? undefined : figures(div);
      if (!figs) {
        for (const r of TUPLETS) {
          const scaled = (div * r[0]) / r[1];
          const f = Number.isInteger(scaled) ? figures(scaled) : undefined;
          if (f) {
            ratio = r;
            figs = f.map((x) => ({ ...x, div: (x.div * r[1]) / r[0] }));
            break;
          }
        }
      }
      // aucune figure ne la rend (un découpage très fin) : une seule note, de sa vraie durée
      if (!figs) figs = [{ type: "128th", dots: 0, div }];
      figs.forEach((f, k) => out.push({ e, div: f.div, type: f.type, dots: f.dots, tuplet: ratio, beat, first: i === 0 && k === 0, last: i + 2 === cuts.length && k === figs!.length - 1 }));
    }
  }
  return out;
}

/**
 * Un événement d'une voix. Pour un instrument à cordes (layer), la partition ou la tablature : la
 * tablature porte la corde et la case de chaque note, et les liaisons ; la partition, les paroles.
 */
function eventXml(ctx: Ctx, staff: Staff, s: number, voice: number, e: Event, bar: Bar, measureRest: boolean, ps: Piece[], layer?: "notation" | "tab"): string[] {
  const { score, fifths } = ctx;
  const out: string[] = [];
  const part = ctx.firstStaff.findIndex((f, i) => f <= staff && staff < f + score.parts[i].staves);
  const strs = score.parts[part].strings;
  const staffTag = score.parts[part].staves > 1 || layer ? `<staff>${s + 1}</staff>` : "";
  // la corde et la case d'une note, sur la tablature
  const onString = (x: { midi: number; string?: number }) => (layer === "tab" && strs && x.string !== undefined ? `<technical><string>${x.string}</string><fret>${fretOf(strs, x.string, x.midi)}</fret></technical>` : "");
  const tuplet = (x: Piece) => (x.tuplet ? (x.open ? '<tuplet type="start" bracket="yes"/>' : "") + (x.close ? '<tuplet type="stop"/>' : "") : "");
  if (!e.group) {
    if (measureRest) {
      out.push(`      <note><rest measure="yes"/><duration>${(e.end - e.start) * (bar.compound ? 3 : 2)}</duration><voice>${voice}</voice>${staffTag}</note>`);
      return out;
    }
    for (const x of ps) {
      const notations = tuplet(x);
      out.push(`      <note><rest/><duration>${x.div}</duration><voice>${voice}</voice><type>${x.type}</type>${"<dot/>".repeat(x.dots)}${timeMod(x.tuplet)}${staffTag}${notations ? `<notations>${notations}</notations>` : ""}</note>`);
    }
    return out;
  }
  const g = e.group;
  const t = g.start;
  const starts = e.start === g.start; // l'attaque de la note est dans cette mesure
  const ends = e.end === g.end;
  // petites notes, avant l'attaque
  if (starts) {
    const graces = score.graces.filter((x) => x.staff === staff && x.t === t).sort((a, b) => a.slot - b.slot || a.midi - b.midi);
    graces.forEach((x, k) => {
      const chord = k > 0 && graces[k - 1].slot === x.slot ? "<chord/>" : "";
      const tech = onString(x);
      out.push(`      <note><grace slash="yes"/>${chord}${pitchXml(spell(x.midi, fifths))}<voice>${voice}</voice><type>eighth</type>${staffTag}${tech ? `<notations>${tech}</notations>` : ""}</note>`);
    });
  }
  const notes = [...g.notes].sort((a, b) => a.midi - b.midi);
  // les liaisons, sur le premier morceau : l'attaque, ou la suite d'une note tenue en début de mesure
  const slurs = layer === "notation" ? [] : (ctx.slurMarks.get(g) ?? []).filter((m) => m.t === (starts ? t : e.start)).map((m) => m.xml);
  for (const x of ps) {
    const tieStart = !(ends && x.last);
    const tieStop = !(starts && x.first);
    notes.forEach((n, j) => {
      const sp = spell(n.midi, fifths);
      const notations: string[] = [];
      if (tieStop) notations.push('<tied type="stop"/>');
      if (tieStart) notations.push('<tied type="start"/>');
      if (j === 0) notations.push(tuplet(x));
      if (starts && x.first) notations.push(...attackNotations(ctx, staff, t, n, sp, j === 0));
      if (x.first && j === 0) notations.push(...slurs);
      notations.push(onString(n));
      const ties = (tieStop ? '<tie type="stop"/>' : "") + (tieStart ? '<tie type="start"/>' : "");
      const lyric = starts && x.first && j === 0 && layer !== "tab" ? lyricsXml(score, staff, t) : "";
      const n8 = notations.join("");
      out.push(
        `      <note>${j > 0 ? "<chord/>" : ""}${pitchXml(sp)}<duration>${x.div}</duration>${ties}<voice>${voice}</voice><type>${x.type}</type>${"<dot/>".repeat(x.dots)}${timeMod(x.tuplet)}${staffTag}${n8 ? `<notations>${n8}</notations>` : ""}${lyric}</note>`,
      );
    });
  }
  return out;
}

const accidentalName = (alter: number) => (alter > 0 ? "sharp" : alter < 0 ? "flat" : "natural");
const pitchXml = (sp: { step: string; alter: number; octave: number }) => `<pitch><step>${sp.step}</step>${sp.alter ? `<alter>${sp.alter}</alter>` : ""}<octave>${sp.octave}</octave></pitch>`;
const timeMod = (r?: [number, number]) => (r ? `<time-modification><actual-notes>${r[0]}</actual-notes><normal-notes>${r[1]}</normal-notes></time-modification>` : "");

/** Ce qui s'attache à l'attaque d'une note : point d'orgue, arpège, articulations, doigté, trille. */
function attackNotations(ctx: Ctx, staff: Staff, t: number, n: Note, sp: { step: string; alter: number; octave: number }, first: boolean): string[] {
  const { score } = ctx;
  const out: string[] = [];
  const top = ctx.firstStaff.includes(staff) && ctx.firstStaff.indexOf(staff) === 0;
  if (first && top && score.fermatas.includes(t)) out.push('<fermata type="upright"/>');
  const arp = score.arpeggios.find((a) => a.t === t && (a.staff === undefined || a.staff === staff));
  if (arp) out.push(arp.down ? '<arpeggiate direction="down"/>' : "<arpeggiate/>");
  if (first) {
    const arts = score.articulations.filter((a) => a.staff === staff && a.t === t);
    if (arts.length) out.push(`<articulations>${arts.map((a) => (a.kind === "staccato" ? "<staccato/>" : a.kind === "accent" ? "<accent/>" : "<strong-accent/>")).join("")}</articulations>`);
  }
  if (n.finger) out.push(`<technical><fingering>${n.finger}</fingering></technical>`);
  if (n.trill !== undefined) {
    // la voisine du dessus, son altération dessinée : la note de la lettre suivante qui sonne comme la trille
    const i = LETTERS.indexOf(sp.step) + 1;
    const letter = LETTERS[i % 7];
    const oct = sp.octave + (i > 6 ? 1 : 0);
    const alter = n.trill - (12 * (oct + 1) + STEP[letter]);
    const mark = Math.abs(alter) <= 1 && alter !== keyAlter(ctx.fifths, letter) ? `<accidental-mark placement="above">${accidentalName(alter)}</accidental-mark>` : "";
    out.push(`<ornaments><trill-mark/>${mark}</ornaments>`);
  }
  return out;
}

/**
 * Les liaisons de chaque partie, marquées sur les notes : un début et une fin par liaison,
 * numérotés pour s'imbriquer, les numéros valant pour toute la partie (ses deux portées au piano).
 * Un bout se marque sur la note qui attaque à cet instant dans la portée de la liaison ; à
 * défaut, sur la suite d'une note tenue en début de mesure, sur une note d'une autre portée de
 * la partie, ou sur la dernière note attaquée avant dans sa portée. Une seule voix le porte.
 */
function slurMarks(score: Score, voices: Map<Staff, Group[][]>, firstStaff: number[], bars: Bar[]): Map<Group, { t: number; xml: string }[]> {
  const marks = new Map<Group, { t: number; xml: string }[]>();
  const barStarts = new Set(bars.map((b) => b.start));
  const groups = (x: Staff) => (voices.get(x) ?? []).flat();
  score.parts.forEach((part, p) => {
    const staves = Array.from({ length: part.staves }, (_, k) => firstStaff[p] + k);
    const carrier = (own: Staff, t: number): { g: Group; t: number } | undefined => {
      const attack = (x: Staff) => groups(x).find((g) => g.start === t);
      const here = attack(own) ?? (barStarts.has(t) ? groups(own).find((g) => g.start < t && t < g.end) : undefined);
      if (here) return { g: here, t };
      const other = staves.map(attack).find(Boolean);
      if (other) return { g: other, t };
      const before = groups(own).filter((g) => g.start < t);
      const last = before.reduce<Group | undefined>((a, g) => (!a || g.start > a.start ? g : a), undefined);
      return last && { g: last, t: last.start };
    };
    const slurs = score.slurs
      .filter((s) => staves.includes(s.staff))
      .flatMap((s) => {
        const a = carrier(s.staff, s.start), b = carrier(s.staff, s.end);
        return a && b && b.t > a.t ? [{ a, b }] : [];
      })
      .sort((x, y) => x.a.t - y.a.t || y.b.t - x.b.t);
    const open: { end: number; number: number }[] = [];
    for (const { a, b } of slurs) {
      for (let i = open.length - 1; i >= 0; i--) if (open[i].end < a.t) open.splice(i, 1);
      let number = 1;
      while (open.some((o) => o.number === number)) number++;
      open.push({ end: b.t, number });
      const add = (c: { g: Group; t: number }, type: string) => marks.set(c.g, [...(marks.get(c.g) ?? []), { t: c.t, xml: `<slur type="${type}" number="${number}"/>` }]);
      add(b, "stop");
      add(a, "start");
    }
  });
  return marks;
}

/** Les paroles d'une note : chaque couplet, la syllabe avec sa place dans le mot. */
function lyricsXml(score: Score, staff: Staff, t: number): string {
  return score.lyrics
    .filter((l) => l.staff === staff && l.t === t)
    .sort((a, b) => a.verse - b.verse)
    .map((l) => {
      const before = previousSyllable(score.lyrics, l);
      const continued = !!before?.hyphen;
      const syllabic = continued ? (l.hyphen ? "middle" : "end") : l.hyphen ? "begin" : "single";
      return `<lyric number="${l.verse}"><syllabic>${syllabic}</syllabic><text>${esc(l.text)}</text>${l.extend ? "<extend/>" : ""}</lyric>`;
    })
    .join("");
}
const previousSyllable = (lyrics: Lyric[], l: Lyric) =>
  lyrics.filter((x) => x.staff === l.staff && x.verse === l.verse && x.t < l.t).sort((a, b) => b.t - a.t)[0];

/* ---------------------------------------------------------------- indications */

type Direction = { t: number; xml: (offset: number) => string };

/** Les indications d'une portée dans une mesure, dans l'ordre : nuances, textes, soufflets, pédale, et pour la première portée de la partie, les accords et les textes du système. */
function directionsOf(ctx: Ctx, p: number, staff: Staff, bar: Bar): Direction[] {
  const { score } = ctx;
  const inBar = (t: number) => t >= bar.start && t < bar.end;
  // la fin d'un soufflet ou d'une pédale sur une barre s'écrit au bout de la mesure qu'elle termine :
  // la mesure suivante dans le texte n'est pas toujours celle qui suit à l'écoute
  const atEnd = (t: number) => t > bar.start && t <= bar.end;
  const staffNo = score.parts[p].staves > 1 ? `<staff>${staff - ctx.firstStaff[p] + 1}</staff>` : "";
  const dir = (t: number, placement: "above" | "below", type: string, sound = "") => ({
    t,
    xml: (offset: number) => `      <direction placement="${placement}"><direction-type>${type}</direction-type>${offset ? `<offset sound="yes">${offset}</offset>` : ""}${staffNo}${sound}</direction>`,
  });
  const out: Direction[] = [];
  const firstOfPart = staff === ctx.firstStaff[p];
  if (firstOfPart && p === 0) {
    for (const x of score.texts.filter((x) => inBar(x.t))) out.push(dir(x.t, "above", `<words>${esc(x.text)}</words>`));
  }
  if (firstOfPart && p === 0) {
    for (const c of score.chords.filter((x) => inBar(x.t))) {
      const xml = harmonyXml(c.text);
      if (xml) out.push({ t: c.t, xml: (offset: number) => `      ${xml.replace("</harmony>", `${offset ? `<offset>${offset}</offset>` : ""}${staffNo}</harmony>`)}` });
    }
  }
  for (const x of score.expressions.filter((x) => x.staff === staff && inBar(x.t))) {
    if (x.kind === "dynamic") {
      const plain = /^\(.*\)$/.test(x.text) ? `<other-dynamics>${esc(x.text)}</other-dynamics>` : `<${x.text}/>`;
      out.push(dir(x.t, "below", `<dynamics>${plain}</dynamics>`));
    } else out.push(dir(x.t, "below", `<words>${esc(x.text)}</words>`));
  }
  for (const h of score.hairpins.filter((x) => x.staff === staff)) {
    if (inBar(h.start)) out.push(dir(h.start, "below", `<wedge type="${h.kind === "<" ? "crescendo" : "diminuendo"}"/>`));
    if (atEnd(h.end) && h.end > h.start) out.push(dir(h.end, "below", '<wedge type="stop"/>'));
  }
  const pedals = score.pedals.filter((x) => x.staff === staff && !x.implied);
  for (const pd of pedals) {
    const joined = pedals.some((o) => o.end === pd.start);
    if (inBar(pd.start)) out.push(dir(pd.start, "below", `<pedal type="${joined ? "change" : "start"}" line="yes"/>`));
    const continued = pedals.some((o) => o.start === pd.end);
    if (atEnd(pd.end) && !continued) out.push(dir(pd.end, "below", '<pedal type="stop" line="yes"/>'));
  }
  for (const x of score.pedalTexts.filter((x) => x.staff === staff && inBar(x.t))) out.push(dir(x.t, "below", `<words>${esc(x.text)}</words>`));
  return out.sort((a, b) => a.t - b.t);
}

/** Les qualités d'accord MusicXML (<kind>) de chaque suffixe. */
const KINDS: Record<string, string> = {
  "": "major", m: "minor", aug: "augmented", dim: "diminished", "7": "dominant", maj7: "major-seventh", m7: "minor-seventh",
  dim7: "diminished-seventh", aug7: "augmented-seventh", m7b5: "half-diminished", mMaj7: "major-minor", "6": "major-sixth",
  m6: "minor-sixth", "9": "dominant-ninth", maj9: "major-ninth", m9: "minor-ninth", "11": "dominant-11th", m11: "minor-11th",
  "13": "dominant-13th", maj13: "major-13th", m13: "minor-13th", sus2: "suspended-second", sus4: "suspended-fourth", "5": "power",
};
const ROOT = ["C", "C", "D", "E", "E", "F", "F", "G", "A", "A", "B", "B"];
const ROOT_ALTER = [0, 1, 0, -1, 0, 0, 1, 0, -1, 0, -1, 0];

/** Un accord d'accompagnement en <harmony> : sa fondamentale, sa qualité, sa basse ; undefined s'il n'a pas de qualité MusicXML. */
function harmonyXml(text: string): string | undefined {
  const notes = chordNotes(text);
  const r = notes && recognize(notes);
  if (!r || KINDS[r.quality] === undefined) return undefined;
  const note = (tag: string, p: number) => `<${tag}><${tag}-step>${ROOT[p]}</${tag}-step>${ROOT_ALTER[p] ? `<${tag}-alter>${ROOT_ALTER[p]}</${tag}-alter>` : ""}</${tag}>`;
  return `<harmony>${note("root", r.root)}<kind>${KINDS[r.quality]}</kind>${r.bass !== r.root ? note("bass", r.bass) : ""}</harmony>`;
}
