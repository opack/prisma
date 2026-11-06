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
import { gridStrings, parseShape, splitShape } from "./shapes.ts";
import { isPick } from "./model.ts";
import { guessInstrument } from "./instruments.ts";
import type { InstrumentName } from "./instruments.ts";
import { guessKey, parseKey } from "./key.ts";
import type { Key } from "./key.ts";
import { TICKS_PER_BEAT, firstStaves } from "./model.ts";
import type { Lyric, Note, Score, Staff } from "./model.ts";
import { fretOf } from "./strings.ts";
import type { Strings } from "./strings.ts";

/** Divisions MusicXML par noire : un tick vaut 2 divisions dans une mesure simple, 3 dans une composée. */
const DIVISIONS = 5760;

const esc = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Programme General MIDI (1 à 128) de chaque instrument de l'écoute. */
const PROGRAM: Record<InstrumentName, number> = {
  piano: 1,
  "electric-piano": 5,
  harpsichord: 7,
  organ: 20,
  accordion: 22,
  guitar: 25,
  "electric-bass": 34,
  harp: 47,
  violin: 41,
  viola: 42,
  cello: 43,
  "double-bass": 44,
  strings: 49,
  flute: 74,
  oboe: 69,
  clarinet: 72,
  bassoon: 71,
  saxophone: 66,
  trumpet: 57,
  horn: 61,
  trombone: 58,
  voice: 53,
  marimba: 13,
  vibraphone: 12,
};

/**
 * Le son de chaque instrument, dans la liste standard de MusicXML (`<instrument-sound>`) : c'est
 * lui qui fait choisir l'instrument à MuseScore (sa tessiture, sa clé), plus sûrement que le nom.
 */
const SOUND: Record<InstrumentName, string> = {
  piano: "keyboard.piano",
  "electric-piano": "keyboard.piano.electric",
  harpsichord: "keyboard.harpsichord",
  organ: "keyboard.organ",
  accordion: "keyboard.accordion",
  guitar: "pluck.guitar.nylon-string",
  "electric-bass": "pluck.bass.electric",
  harp: "pluck.harp",
  violin: "strings.violin",
  viola: "strings.viola",
  cello: "strings.cello",
  "double-bass": "strings.contrabass",
  strings: "strings.group",
  flute: "wind.flutes.flute",
  oboe: "wind.reed.oboe",
  clarinet: "wind.reed.clarinet",
  bassoon: "wind.reed.bassoon",
  saxophone: "wind.reed.saxophone.alto",
  trumpet: "brass.trumpet",
  horn: "brass.french-horn",
  trombone: "brass.trombone",
  voice: "voice.vocals",
  marimba: "pitched-percussion.marimba",
  vibraphone: "pitched-percussion.vibraphone",
};

/* ---------------------------------------------------------------- noms des notes */

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const SHARP_ORDER = "FCGDAEB";
const pitchClassOf = (number: number) => ((number % 12) + 12) % 12;

/** L'armure d'une tonalité : le nombre de dièses (> 0) ou de bémols (< 0). */
function fifthsOf(key: Key): number {
  const major = pitchClassOf(key.tonic - 1 + (key.minor ? 3 : 0));
  const fifths = pitchClassOf(major * 7);
  // fa♯ majeur (6 dièses) plutôt que sol♭, mais ré♭ (5 bémols) plutôt que do♯ (7 dièses)
  return fifths > 6 ? fifths - 12 : fifths;
}

/** L'altération d'une lettre à l'armure. */
const keyAlter = (fifths: number, letter: string) => {
  const index = SHARP_ORDER.indexOf(letter);
  return fifths > 0 && index < fifths ? 1 : fifths < 0 && index >= 7 + fifths ? -1 : 0;
};

/** Le nom d'une hauteur dans une armure : la lettre de l'armure, sinon la note naturelle, sinon un dièse (ou un bémol en tonalité bémolisée). */
function spell(midi: number, fifths: number): { step: string; alter: number; octave: number } {
  const pitchClass = pitchClassOf(midi);
  const candidates = LETTERS.flatMap((letter) => [-1, 0, 1].filter((offset) => pitchClassOf(STEP[letter] + offset) === pitchClass).map((alter) => ({ letter, alter })));
  const rank = (candidate: { letter: string; alter: number }) =>
    candidate.alter === keyAlter(fifths, candidate.letter) ? 0 : candidate.alter === 0 ? 1 : (fifths >= 0 ? candidate.alter > 0 : candidate.alter < 0) ? 2 : 3;
  const best = candidates.sort((first, second) => rank(first) - rank(second))[0];
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
const SHAPES = TYPES.flatMap(([type, quarters]) =>
  [0, 1, 2].map((dots) => ({ type, dots, div: Math.round(quarters * DIVISIONS * (2 - 1 / 2 ** dots)) })),
).sort((first, second) => second.div - first.div);
const shapeOf = (div: number) => SHAPES.find((shape) => shape.div === div);

/** Une durée en figures liées, de la plus longue à la plus courte ; undefined si aucune suite de figures ne la rend. */
function figures(div: number): { type: string; dots: number; div: number }[] | undefined {
  const out = [];
  let rest = div;
  while (rest > 0) {
    // la durée entière d'une seule figure, sinon la plus longue figure simple qui y tient
    const pick = shapeOf(rest) ?? SHAPES.find((shape) => shape.div <= rest && shape.dots === 0);
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
  score.beats.forEach((beat, index) => {
    const last = bars[bars.length - 1];
    if (last && last.index === beat.barIndex) {
      last.end = (index + 1) * TICKS_PER_BEAT;
      last.beats++;
    } else
      bars.push({ index: beat.barIndex, number: beat.bar, start: index * TICKS_PER_BEAT, end: (index + 1) * TICKS_PER_BEAT, beats: 1, compound, implicit: index === 0 && beat.label > 1 });
  });
  return bars;
}

/** La métrique d'une mesure complète : ses temps, en noires (2/4, 3/4…) ou en noires pointées (6/8, 9/8…). */
function timeOf(bar: Bar, full: number) {
  return bar.compound ? { beats: full * 3, type: 8 } : { beats: full, type: 4 };
}

/**
 * Les options de l'export. repeats : un ordre de jeu s'écrit déroulé, ses sections à la suite,
 * comme Prisma l'affiche (« sections ») ; ou, quand c'est possible, en reprises et en cases, comme
 * une partition classique (« traditional ») : une suite de sections jouée plusieurs fois de suite
 * devient une reprise, une section reprise avec des fins différentes (A B A C) une reprise avec
 * des cases 1 et 2. Le reste de l'ordre se déroule. letters : en reprises, la lettre de chaque
 * section (A, B…) s'écrit aussi, en repère, au début de la section (par défaut) ; déroulé, elle
 * s'écrit toujours, l'import s'en sert pour retrouver les sections.
 */
export type ExportOptions = { repeats?: "sections" | "traditional"; letters?: boolean };

/**
 * Une mesure à écrire : la mesure de Prisma (bi, son rang dans bars), la lettre de sa section, et
 * ses barres : début de reprise, fin de reprise (et le nombre de passages), début et fin d'une case.
 */
type Written = {
  bi: number;
  marker?: string;
  forward?: boolean;
  backward?: number;
  ending?: number;
  endingStart?: boolean;
  endingStop?: "stop" | "discontinue";
};

/** Les mesures à écrire, dans l'ordre. */
function writtenBars(score: Score, bars: Bar[], options: ExportOptions): Written[] {
  // les reprises écrites dans Prisma, sur leurs mesures
  const plain = (bi: number): Written => {
    const repeat = score.repeats.find((candidate) => candidate.barIndex === bars[bi].index);
    return { bi, ...(repeat?.start ? { forward: true } : {}), ...(repeat?.end ? { backward: repeat.times ?? 2 } : {}) };
  };
  if (!score.order.length) return bars.map((_, index) => plain(index));
  const starts = score.markers.map((marker) => ({ ...marker, at: bars.findIndex((bar) => bar.index === marker.barIndex) }));
  const span = (label: string) => {
    const start = starts.find((candidate) => candidate.label === label);
    if (!start) return [];
    const next = starts.filter((candidate) => candidate.at > start.at).sort((first, second) => first.at - second.at)[0];
    return Array.from({ length: (next ? next.at : bars.length) - start.at }, (_, index) => start.at + index);
  };
  // une section qui a ses propres reprises ne s'emboîte pas dans une autre
  const repeated = (label: string) => span(label).some((bi) => score.repeats.some((repeat) => repeat.barIndex === bars[bi].index));
  const section = (label: string) => span(label).map((bi, index) => ({ ...plain(bi), ...(index === 0 ? { marker: label } : {}) }));
  const order = score.order;
  const out: Written[] = [];
  for (let index = 0; index < order.length;) {
    if (options.repeats === "traditional") {
      // une suite de sections jouée plusieurs fois de suite (la plus courte d'abord) : une reprise
      let done = false;
      for (let len = 1; len <= 3 && !done; len++) {
        const block = order.slice(index, index + len);
        if (block.length < len || block.some(repeated)) continue;
        let times = 1;
        while (order.slice(index + times * len, index + (times + 1) * len).join(" ") === block.join(" ")) times++;
        if (times < 2) continue;
        const written = block.flatMap(section);
        if (!written.length) continue;
        written[0].forward = true;
        written[written.length - 1].backward = times;
        out.push(...written);
        index += times * len;
        done = true;
      }
      if (done) continue;
      // une section reprise avec des fins différentes : X E1 X E2 (X E3…), en cases 1, 2…
      const refrain = order[index];
      let endings = 0;
      while (order[index + 2 * endings] === refrain && order[index + 2 * endings + 1] !== undefined && order[index + 2 * endings + 1] !== refrain) endings++;
      const ends = Array.from({ length: endings }, (_, endingIndex) => order[index + 2 * endingIndex + 1]);
      // les cases qui reprennent ne s'emboîtent pas ; la dernière, qui ne reprend pas, le peut
      if (endings >= 2 && !repeated(refrain) && !ends.slice(0, -1).some(repeated)) {
        const head = section(refrain);
        if (head.length) {
          head[0].forward = true;
          out.push(...head);
          for (let ending = 0; ending < endings; ending++) {
            const end = section(ends[ending]);
            if (!end.length) continue;
            end[0].ending = ending + 1;
            end[0].endingStart = true;
            // la dernière case s'arrête où commence une reprise de sa section : la suite n'est plus une fin
            const inner = ending < endings - 1 ? -1 : end.findIndex((entry, innerIndex) => innerIndex > 0 && entry.forward);
            const last = end[(inner > 0 ? inner : end.length) - 1];
            last.ending = ending + 1;
            if (ending < endings - 1) {
              last.endingStop = "stop";
              last.backward = 2;
            } else last.endingStop = "discontinue";
            out.push(...end);
          }
          index += 2 * endings;
          continue;
        }
      }
    }
    out.push(...section(order[index]));
    index++;
  }
  return out;
}

/* ---------------------------------------------------------------- voix */

/** Un accord d'une voix : des notes qui commencent et finissent ensemble. */
type Group = { start: number; end: number; notes: Note[] };

/** Les voix d'une portée : chaque accord dans la première voix libre à son début, l'accord le plus aigu d'abord ; la voix du dessus en premier. */
function voicesOf(notes: Note[]): Group[][] {
  const groups: Group[] = [];
  for (const current of [...notes].sort((first, second) => first.start - second.start || first.end - second.end || first.midi - second.midi)) {
    const group = groups.find((candidate) => candidate.start === current.start && candidate.end === current.end);
    if (group) group.notes.push(current);
    else groups.push({ start: current.start, end: current.end, notes: [current] });
  }
  // à un même instant, l'accord le plus aigu d'abord : la mélodie prend la première voix
  const top = (group: Group) => Math.max(...group.notes.map((note) => note.midi));
  const voices: Group[][] = [];
  for (const group of groups.sort((first, second) => first.start - second.start || top(second) - top(first))) {
    const voice = voices.find((candidate) => candidate[candidate.length - 1].end <= group.start);
    if (voice) voice.push(group);
    else voices.push([group]);
  }
  // la voix du dessus en premier, comme sur une partition : hampes en haut pour elle, en bas pour la suivante
  const mean = (voice: Group[]) => voice.reduce((total, group) => total + top(group), 0) / voice.length;
  return voices.sort((first, second) => mean(second) - mean(first));
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
export function exportMusicXml(score: Score, options: ExportOptions = {}): string {
  const key = (score.meta.key ? parseKey(score.meta.key) : undefined) ?? guessKey(score) ?? { tonic: 1, minor: false };
  const fifths = fifthsOf(key);
  const bars = barsOf(score);
  const voices = new Map([...new Set(score.notes.map((note) => note.staff))].map((staff) => [staff, voicesOf(score.notes.filter((note) => note.staff === staff))]));
  const firstStaff = firstStaves(score.parts);
  const ctx: Ctx = { score, fifths, bars, firstStaff, voices, slurMarks: slurMarks(score, voices, firstStaff, bars) };
  const order = writtenBars(score, bars, options);
  const fullBeats = Math.max(1, ...bars.filter((bar) => !bar.implicit).map((bar) => bar.beats));

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
  score.parts.forEach((part, index) => {
    const instrument = part.instrument ?? guessInstrument(part.name);
    const name = part.name ?? (score.parts.length > 1 ? `Partie ${index + 1}` : "Piano");
    out.push(`    <score-part id="P${index + 1}">`);
    out.push(`      <part-name>${esc(name)}</part-name>`);
    out.push(
      `      <score-instrument id="P${index + 1}-I1"><instrument-name>${esc(name)}</instrument-name><instrument-sound>${SOUND[instrument]}</instrument-sound></score-instrument>`,
    );
    out.push(
      `      <midi-instrument id="P${index + 1}-I1"><midi-channel>${(index % 15) + 1 + (index >= 9 ? 1 : 0)}</midi-channel><midi-program>${PROGRAM[instrument]}</midi-program></midi-instrument>`,
    );
    out.push("    </score-part>");
  });
  out.push("  </part-list>");

  score.parts.forEach((part, partIndex) => {
    // un instrument à cordes : sa portée deux fois, en partition puis en tablature (la seconde porte les cordes)
    const strings = part.strings;
    const staves = strings ? [ctx.firstStaff[partIndex], ctx.firstStaff[partIndex]] : Array.from({ length: part.staves }, (_, index) => ctx.firstStaff[partIndex] + index);
    const voices = staves.map((staff) => ctx.voices.get(staff) ?? []);
    const clefs = strings ? [] : staves.map((staff) => clefOf(score.notes.filter((note) => note.staff === staff)));
    out.push(`  <part id="P${partIndex + 1}">`);
    let lastTime = "";
    order.forEach((written, position) => {
      const bar = bars[written.bi];
      // déroulé, les mesures se numérotent à la suite, à partir du numéro de la première
      const number = score.order.length ? String((Number(bars[0].number) || 0) + position) : bar.number;
      // une anacrouse numérotée 0 est hors décompte ; numérotée 1, elle compte
      out.push(`    <measure number="${esc(number)}"${bar.implicit && position === 0 && bar.number === "0" ? ' implicit="yes"' : ""}>`);
      // à gauche : le début d'une reprise, d'une case
      if (written.forward || written.endingStart) {
        const ending = written.endingStart ? `<ending number="${written.ending}" type="start">${written.ending}.</ending>` : "";
        out.push(
          `      <barline location="left">${written.forward ? "<bar-style>heavy-light</bar-style>" : ""}${ending}${written.forward ? '<repeat direction="forward"/>' : ""}</barline>`,
        );
      }
      const time = timeOf(bar, bar.implicit ? fullBeats : bar.beats);
      const timeText = `${time.beats}/${time.type}`;
      if (position === 0 || timeText !== lastTime) {
        out.push("      <attributes>");
        if (position === 0) {
          out.push(`        <divisions>${DIVISIONS}</divisions>`);
          out.push(`        <key><fifths>${fifths}</fifths><mode>${key.minor ? "minor" : "major"}</mode></key>`);
        }
        out.push(`        <time><beats>${time.beats}</beats><beat-type>${time.type}</beat-type></time>`);
        if (position === 0) {
          if (staves.length > 1) out.push(`        <staves>${staves.length}</staves>`);
          clefs.forEach((clef, index) =>
            out.push(`        <clef${part.staves > 1 ? ` number="${index + 1}"` : ""}><sign>${clef.sign}</sign><line>${clef.line}</line></clef>`),
          );
          if (strings) out.push(...tablatureAttributes(strings));
        }
        out.push("      </attributes>");
        lastTime = timeText;
      }
      // en tête du morceau : le tempo ; au début d'une section : sa lettre
      if (partIndex === 0 && position === 0 && score.meta.bpm) {
        const quarters = bar.compound ? 1.5 : 1;
        out.push(
          `      <direction placement="above"><direction-type><metronome><beat-unit>quarter</beat-unit>${bar.compound ? "<beat-unit-dot/>" : ""}<per-minute>${score.meta.bpm}</per-minute></metronome></direction-type><sound tempo="${+(score.meta.bpm * quarters).toFixed(2)}"/></direction>`,
        );
      }
      if (partIndex === 0 && written.marker && (options.repeats !== "traditional" || options.letters !== false))
        out.push(`      <direction placement="above"><direction-type><rehearsal>${written.marker}</rehearsal></direction-type></direction>`);
      out.push(...measureBody(ctx, partIndex, staves, voices, bar, !!strings));
      // à droite : la fin d'une case, d'une reprise, du morceau
      const final = position === order.length - 1;
      const ending = written.endingStop ? `<ending number="${written.ending}" type="${written.endingStop}"/>` : "";
      const backward = written.backward !== undefined ? `<repeat direction="backward"${written.backward !== 2 ? ` times="${written.backward}"` : ""}/>` : "";
      if (backward || final || ending)
        out.push(
          `      <barline location="right">${backward || final ? "<bar-style>light-heavy</bar-style>" : ""}${ending}${backward}</barline>`,
        );
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
function tablatureAttributes(strings: Strings): string[] {
  const bass = strings.open.length === 4;
  const lines = [...strings.open].reverse().map((midi, index) => {
    const spelled = spell(midi, 0);
    return `<staff-tuning line="${index + 1}"><tuning-step>${spelled.step}</tuning-step>${spelled.alter ? `<tuning-alter>${spelled.alter}</tuning-alter>` : ""}<tuning-octave>${spelled.octave}</tuning-octave></staff-tuning>`;
  });
  return [
    `        <clef number="1"><sign>${bass ? "F" : "G"}</sign><line>${bass ? 4 : 2}</line><clef-octave-change>-1</clef-octave-change></clef>`,
    '        <clef number="2"><sign>TAB</sign><line>5</line></clef>',
    `        <staff-details number="2"><staff-lines>${strings.open.length}</staff-lines>${lines.join("")}${strings.capo ? `<capo>${strings.capo}</capo>` : ""}</staff-details>`,
  ];
}

/** La clé d'une portée : de sol si ses notes sont plutôt au-dessus du si grave, de fa sinon. */
function clefOf(notes: Note[]) {
  if (!notes.length) return { sign: "G", line: 2 };
  const mean = notes.reduce((total, note) => total + note.midi, 0) / notes.length;
  return mean >= 57 ? { sign: "G", line: 2 } : { sign: "F", line: 4 };
}

/* ---------------------------------------------------------------- le contenu d'une mesure */

/** Un événement d'une voix dans la mesure : un accord (ou une note), ou un silence, sur [start, end[. */
type Event = { start: number; end: number; group?: Group };
/** Un morceau d'événement, écrit par une figure : un tuplet s'ouvre ou se ferme peut-être sur lui. */
type Piece = {
  event: Event;
  div: number;
  type: string;
  dots: number;
  tuplet?: [number, number];
  beat: number;
  first: boolean;
  last: boolean;
  open?: boolean;
  close?: boolean;
};

/** tab : la seconde portée est la tablature de la première. */
function measureBody(ctx: Ctx, partIndex: number, staves: Staff[], voices: Group[][][], bar: Bar, tab = false): string[] {
  const out: string[] = [];
  const toDiv = (ticks: number) => ticks * (bar.compound ? 3 : 2);
  let cursor = 0; // en divisions depuis le début de la mesure
  const blocks: { staff: Staff; staffIndex: number; voice: number; events: Event[]; tab: boolean }[] = [];
  staves.forEach((staff, staffIndex) => {
    voices[staffIndex].forEach((groups, voiceIndex) => {
      const inBar = groups.filter((group) => group.start < bar.end && group.end > bar.start);
      if (voiceIndex > 0 && !inBar.length) return;
      const events: Event[] = [];
      let tick = bar.start;
      for (const group of inBar) {
        const start = Math.max(group.start, bar.start),
          end = Math.min(group.end, bar.end);
        if (start > tick) events.push({ start: tick, end: start });
        events.push({ start, end, group });
        tick = end;
      }
      if (tick < bar.end) events.push({ start: tick, end: bar.end });
      blocks.push({ staff, staffIndex, voice: staffIndex * 4 + voiceIndex + 1, events, tab: tab && staffIndex === 1 });
    });
  });
  blocks.forEach((block, index) => {
    if (index > 0 && cursor > 0) {
      out.push(`      <backup><duration>${cursor}</duration></backup>`);
      cursor = 0;
    }
    const secondary = (block.voice - 1) % 4 !== 0;
    const first = blocks.findIndex((candidate) => candidate.staff === block.staff) === index;
    const directions = first ? directionsOf(ctx, partIndex, block.staff, bar) : [];
    const measureRest = block.events.length === 1 && !block.events[0].group;
    // les morceaux de la voix, puis les tuplets : un crochet par temps, du premier au dernier de ses morceaux
    const all = piecesOf(block.events, bar);
    all.forEach((piece, pieceIndex) => {
      if (!piece.tuplet) return;
      const prev = all[pieceIndex - 1],
        next = all[pieceIndex + 1];
      piece.open = !prev?.tuplet || prev.beat !== piece.beat;
      piece.close = !next?.tuplet || next.beat !== piece.beat;
    });
    for (const event of block.events) {
      // les indications qui tombent avant la fin de cet événement, à leur place
      const from = toDiv(event.start - bar.start);
      while (directions.length && directions[0].t < event.end) {
        const direction = directions.shift()!;
        const offset = toDiv(direction.t - bar.start) - from;
        out.push(direction.xml(offset > 0 ? offset : 0));
      }
      if (!event.group && secondary) {
        // un silence d'une voix secondaire : un simple saut
        out.push(`      <forward><duration>${toDiv(event.end - event.start)}</duration></forward>`);
      } else
        out.push(
          ...eventXml(
            ctx,
            block.staff,
            block.staffIndex,
            block.voice,
            event,
            bar,
            measureRest,
            all.filter((piece) => piece.event === event),
            tab ? (block.tab ? "tab" : "notation") : undefined,
          ),
        );
      cursor += toDiv(event.end - event.start);
    }
    // les indications à la fin de la mesure (la fin d'un soufflet, d'une pédale)
    for (const direction of directions) out.push(direction.xml(0));
  });
  return out;
}

/** Les morceaux des événements d'une voix : coupés aux temps où un tuplet est nécessaire, puis en figures liées. */
function piecesOf(events: Event[], bar: Bar): Piece[] {
  const toDiv = (ticks: number) => ticks * (bar.compound ? 3 : 2);
  const grid = DIVISIONS / 32; // la plus petite figure : la quadruple croche
  const beatOf = (tick: number) => Math.floor((tick - bar.start) / TICKS_PER_BEAT);
  // un temps où un début ou une fin d'événement tombe hors de la grille des figures : un tuplet
  const tupletBeats = new Set(
    events
      .flatMap((event) => [event.start, event.end])
      .filter((tick) => toDiv(tick - bar.start) % grid !== 0)
      .map(beatOf),
  );
  const out: Piece[] = [];
  for (const event of events) {
    const cuts = [event.start];
    for (let beat = beatOf(event.start) + 1; bar.start + beat * TICKS_PER_BEAT < event.end; beat++)
      if (tupletBeats.has(beat) || tupletBeats.has(beat - 1)) cuts.push(bar.start + beat * TICKS_PER_BEAT);
    cuts.push(event.end);
    for (let index = 0; index + 1 < cuts.length; index++) {
      const start = cuts[index],
        end = cuts[index + 1];
      const beat = beatOf(start);
      const div = toDiv(end - start);
      let ratio: [number, number] | undefined;
      let shapes = tupletBeats.has(beat) ? undefined : figures(div);
      if (!shapes) {
        for (const tuplet of TUPLETS) {
          const scaled = (div * tuplet[0]) / tuplet[1];
          const scaledShapes = Number.isInteger(scaled) ? figures(scaled) : undefined;
          if (scaledShapes) {
            ratio = tuplet;
            shapes = scaledShapes.map((shape) => ({ ...shape, div: (shape.div * tuplet[1]) / tuplet[0] }));
            break;
          }
        }
      }
      // aucune figure ne la rend (un découpage très fin) : une seule note, de sa vraie durée
      if (!shapes) shapes = [{ type: "128th", dots: 0, div }];
      shapes.forEach((shape, shapeIndex) =>
        out.push({
          event: event,
          div: shape.div,
          type: shape.type,
          dots: shape.dots,
          tuplet: ratio,
          beat,
          first: index === 0 && shapeIndex === 0,
          last: index + 2 === cuts.length && shapeIndex === shapes!.length - 1,
        }),
      );
    }
  }
  return out;
}

/**
 * Un événement d'une voix. Pour un instrument à cordes (layer), la partition ou la tablature : la
 * tablature porte la corde et la case de chaque note, et les liaisons ; la partition, les paroles.
 */
function eventXml(
  ctx: Ctx,
  staff: Staff,
  staffIndex: number,
  voice: number,
  event: Event,
  bar: Bar,
  measureRest: boolean,
  pieces: Piece[],
  layer?: "notation" | "tab",
): string[] {
  const { score, fifths } = ctx;
  const out: string[] = [];
  const part = ctx.firstStaff.findIndex((first, index) => first <= staff && staff < first + score.parts[index].staves);
  const strings = score.parts[part].strings;
  const staffTag = score.parts[part].staves > 1 || layer ? `<staff>${staffIndex + 1}</staff>` : "";
  // la corde et la case d'une note, sur la tablature
  const onString = (note: { midi: number; string?: number }) =>
    layer === "tab" && strings && note.string !== undefined
      ? `<technical><string>${note.string}</string><fret>${fretOf(strings, note.string, note.midi)}</fret></technical>`
      : "";
  const tuplet = (piece: Piece) =>
    piece.tuplet ? (piece.open ? '<tuplet type="start" bracket="yes"/>' : "") + (piece.close ? '<tuplet type="stop"/>' : "") : "";
  if (!event.group) {
    if (measureRest) {
      out.push(
        `      <note><rest measure="yes"/><duration>${(event.end - event.start) * (bar.compound ? 3 : 2)}</duration><voice>${voice}</voice>${staffTag}</note>`,
      );
      return out;
    }
    for (const piece of pieces) {
      const notations = tuplet(piece);
      out.push(
        `      <note><rest/><duration>${piece.div}</duration><voice>${voice}</voice><type>${piece.type}</type>${"<dot/>".repeat(piece.dots)}${timeMod(piece.tuplet)}${staffTag}${notations ? `<notations>${notations}</notations>` : ""}</note>`,
      );
    }
    return out;
  }
  const group = event.group;
  const tick = group.start;
  const starts = event.start === group.start; // l'attaque de la note est dans cette mesure
  const ends = event.end === group.end;
  // petites notes, avant l'attaque
  if (starts) {
    const graces = score.graces.filter((grace) => grace.staff === staff && grace.t === tick).sort((first, second) => first.slot - second.slot || first.midi - second.midi);
    graces.forEach((grace, index) => {
      const chord = index > 0 && graces[index - 1].slot === grace.slot ? "<chord/>" : "";
      const tech = onString(grace);
      out.push(
        `      <note><grace slash="yes"/>${chord}${pitchXml(spell(grace.midi, fifths))}<voice>${voice}</voice><type>eighth</type>${staffTag}${tech ? `<notations>${tech}</notations>` : ""}</note>`,
      );
    });
  }
  const notes = [...group.notes].sort((first, second) => first.midi - second.midi);
  // les liaisons, sur le premier morceau : l'attaque, ou la suite d'une note tenue en début de mesure
  const slurs = layer === "notation" ? [] : (ctx.slurMarks.get(group) ?? []).filter((mark) => mark.t === (starts ? tick : event.start)).map((mark) => mark.xml);
  for (const piece of pieces) {
    const tieStart = !(ends && piece.last);
    const tieStop = !(starts && piece.first);
    notes.forEach((note, innerIndex) => {
      const spelled = spell(note.midi, fifths);
      const notations: string[] = [];
      if (tieStop) notations.push('<tied type="stop"/>');
      if (tieStart) notations.push('<tied type="start"/>');
      if (innerIndex === 0) notations.push(tuplet(piece));
      if (starts && piece.first) notations.push(...attackNotations(ctx, staff, tick, note, spelled, innerIndex === 0));
      if (piece.first && innerIndex === 0) notations.push(...slurs);
      notations.push(onString(note));
      if (strings && note.string !== undefined && starts && piece.first) notations.push(...techniqueXml(ctx, staff, note, layer));
      const ties = (tieStop ? '<tie type="stop"/>' : "") + (tieStart ? '<tie type="start"/>' : "");
      const lyric = starts && piece.first && innerIndex === 0 && layer !== "tab" ? lyricsXml(score, staff, tick) : "";
      const notationsXml = notations.join("");
      out.push(
        `      <note>${innerIndex > 0 ? "<chord/>" : ""}${pitchXml(spelled)}<duration>${piece.div}</duration>${ties}<voice>${voice}</voice><type>${piece.type}</type>${"<dot/>".repeat(piece.dots)}${timeMod(piece.tuplet)}${note.dead ? "<notehead>x</notehead>" : ""}${staffTag}${notationsXml ? `<notations>${notationsXml}</notations>` : ""}${lyric}</note>`,
      );
    });
  }
  return out;
}

const accidentalName = (alter: number) => (alter > 0 ? "sharp" : alter < 0 ? "flat" : "natural");
const pitchXml = (spelled: { step: string; alter: number; octave: number }) =>
  `<pitch><step>${spelled.step}</step>${spelled.alter ? `<alter>${spelled.alter}</alter>` : ""}<octave>${spelled.octave}</octave></pitch>`;
const timeMod = (ratio?: [number, number]) =>
  ratio ? `<time-modification><actual-notes>${ratio[0]}</actual-notes><normal-notes>${ratio[1]}</normal-notes></time-modification>` : "";

/** Ce qui s'attache à l'attaque d'une note : point d'orgue, arpège, articulations, doigté, trille. */
function attackNotations(
  ctx: Ctx,
  staff: Staff,
  tick: number,
  note: Note,
  spelled: { step: string; alter: number; octave: number },
  first: boolean,
): string[] {
  const { score } = ctx;
  const out: string[] = [];
  const top = ctx.firstStaff.includes(staff) && ctx.firstStaff.indexOf(staff) === 0;
  if (first && top && score.fermatas.includes(tick)) out.push('<fermata type="upright"/>');
  const arpeggiated = score.arpeggios.find((arpeggio) => arpeggio.t === tick && (arpeggio.staff === undefined || arpeggio.staff === staff));
  if (arpeggiated) out.push(arpeggiated.down ? '<arpeggiate direction="down"/>' : "<arpeggiate/>");
  if (first) {
    const all = score.articulations.filter((articulation) => articulation.staff === staff && articulation.t === tick);
    const accents = all.filter((articulation) => !isPick(articulation.kind));
    if (accents.length)
      out.push(
        `<articulations>${accents.map((articulation) => (articulation.kind === "staccato" ? "<staccato/>" : articulation.kind === "accent" ? "<accent/>" : "<strong-accent/>")).join("")}</articulations>`,
      );
    // le sens du médiator : celui de l'archet, en MusicXML
    const picks = all.filter((articulation) => isPick(articulation.kind));
    if (picks.length) out.push(`<technical>${picks.map((articulation) => (articulation.kind === "down" ? "<down-bow/>" : "<up-bow/>")).join("")}</technical>`);
  }
  if (note.finger) out.push(`<technical><fingering>${note.finger}</fingering></technical>`);
  if (note.trill !== undefined) {
    // la voisine du dessus, son altération dessinée : la note de la lettre suivante qui sonne comme la trille
    const index = LETTERS.indexOf(spelled.step) + 1;
    const letter = LETTERS[index % 7];
    const oct = spelled.octave + (index > 6 ? 1 : 0);
    const alter = note.trill - (12 * (oct + 1) + STEP[letter]);
    const mark =
      Math.abs(alter) <= 1 && alter !== keyAlter(ctx.fifths, letter)
        ? `<accidental-mark placement="above">${accidentalName(alter)}</accidental-mark>`
        : "";
    out.push(`<ornaments><trill-mark/>${mark}</ornaments>`);
  }
  return out;
}

/**
 * Les techniques d'une note sur une corde : sur la tablature, le bend, l'harmonique, et le
 * hammer-on ou le pull-off (deux notes liées de la même corde) ; sur les deux portées, le glissé
 * jusqu'à la note suivante de la corde, ceux qui viennent de rien ou y vont, et le vibrato (une ondulation, de la première note à la
 * dernière qu'il couvre).
 */
function techniqueXml(ctx: Ctx, staff: Staff, played: Note, layer?: "notation" | "tab"): string[] {
  const { score } = ctx;
  const out: string[] = [];
  const same = (note: Note) => note !== played && note.staff === staff && note.string === played.string;
  const next = score.notes.filter((note) => same(note) && note.start > played.start).sort((first, second) => first.start - second.start)[0];
  const prev = score.notes.filter((note) => same(note) && note.start < played.start).sort((first, second) => second.start - first.start)[0];
  const tied = (firstNote: Note, secondNote: Note) =>
    score.slurs.some((slur) => slur.staff === staff && slur.start <= firstNote.start && secondNote.start <= slur.end) && firstNote.midi !== secondNote.midi;
  if (layer !== "notation") {
    const tech: string[] = [];
    if (played.bend !== undefined) {
      tech.push(`<bend><bend-alter>${played.bend - played.midi}</bend-alter></bend>`);
      if (played.release) tech.push(`<bend><bend-alter>${played.midi - played.bend}</bend-alter><release/></bend>`);
    }
    if (played.harmonic) tech.push("<harmonic><natural/></harmonic>");
    const legato = (firstNote: Note, secondNote: Note) => (secondNote.midi > firstNote.midi ? "hammer-on" : "pull-off");
    if (prev && tied(prev, played)) tech.push(`<${legato(prev, played)} type="stop" number="1"/>`);
    if (next && tied(played, next))
      tech.push(`<${legato(played, next)} type="start" number="1">${next.midi > played.midi ? "H" : "P"}</${legato(played, next)}>`);
    if (tech.length) out.push(`<technical>${tech.join("")}</technical>`);
  }
  if (prev?.slide) out.push('<slide type="stop" number="1"/>');
  if (played.slide && next) out.push('<slide type="start" number="1" line-type="solid"/>');
  // glissés vers rien et depuis rien : les articulations de MusicXML (la chute, la montée finale ; l'arrivée d'en dessous, d'au-dessus)
  const straight = (text: string) => `<${text} line-shape="straight"/>`;
  const slides = [
    played.slideIn && straight(played.slideIn === "up" ? "scoop" : "plop"),
    played.slideOut && straight(played.slideOut === "down" ? "falloff" : "doit"),
  ].filter(Boolean);
  if (slides.length) out.push(`<articulations>${slides.join("")}</articulations>`);
  // le vibrato : commencé sur la première note qu'il couvre, fini sur la dernière
  for (const effect of score.effects.filter((candidate) => candidate.staff === staff && candidate.kind === "vibrato")) {
    const covered = score.notes.filter((note) => note.staff === staff && note.start >= effect.start && note.start < effect.end).sort((first, second) => first.start - second.start);
    if (covered[0] === played) out.push('<ornaments><wavy-line type="start" number="1"/></ornaments>');
    if (covered.length && covered[covered.length - 1] === played) out.push('<ornaments><wavy-line type="stop" number="1"/></ornaments>');
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
function slurMarks(
  score: Score,
  voices: Map<Staff, Group[][]>,
  firstStaff: number[],
  bars: Bar[],
): Map<Group, { t: number; xml: string }[]> {
  const marks = new Map<Group, { t: number; xml: string }[]>();
  const barStarts = new Set(bars.map((bar) => bar.start));
  const groups = (staff: Staff) => (voices.get(staff) ?? []).flat();
  score.parts.forEach((part, partIndex) => {
    const staves = Array.from({ length: part.staves }, (_, index) => firstStaff[partIndex] + index);
    const carrier = (own: Staff, tick: number): { group: Group; t: number } | undefined => {
      const attack = (staff: Staff) => groups(staff).find((group) => group.start === tick);
      const here = attack(own) ?? (barStarts.has(tick) ? groups(own).find((group) => group.start < tick && tick < group.end) : undefined);
      if (here) return { group: here, t: tick };
      const other = staves.map(attack).find(Boolean);
      if (other) return { group: other, t: tick };
      const before = groups(own).filter((group) => group.start < tick);
      const last = before.reduce<Group | undefined>((group, candidate) => (!group || candidate.start > group.start ? candidate : group), undefined);
      return last && { group: last, t: last.start };
    };
    const slurs = score.slurs
      .filter((slur) => staves.includes(slur.staff))
      .flatMap((slur) => {
        const opening = carrier(slur.staff, slur.start),
          closing = carrier(slur.staff, slur.end);
        return opening && closing && closing.t > opening.t ? [{ opening, closing }] : [];
      })
      .sort((first, second) => first.opening.t - second.opening.t || second.closing.t - first.closing.t);
    const open: { end: number; number: number }[] = [];
    for (const { opening, closing } of slurs) {
      for (let index = open.length - 1; index >= 0; index--) if (open[index].end < opening.t) open.splice(index, 1);
      let number = 1;
      while (open.some((entry) => entry.number === number)) number++;
      open.push({ end: closing.t, number });
      const add = (end: { group: Group; t: number }, type: string) =>
        marks.set(end.group, [...(marks.get(end.group) ?? []), { t: end.t, xml: `<slur type="${type}" number="${number}"/>` }]);
      add(closing, "stop");
      add(opening, "start");
    }
  });
  return marks;
}

/** Les paroles d'une note : chaque couplet, la syllabe avec sa place dans le mot. */
function lyricsXml(score: Score, staff: Staff, tick: number): string {
  return score.lyrics
    .filter((lyric) => lyric.staff === staff && lyric.t === tick)
    .sort((first, second) => first.verse - second.verse)
    .map((lyric) => {
      const before = previousSyllable(score.lyrics, lyric);
      const continued = !!before?.hyphen;
      const syllabic = continued ? (lyric.hyphen ? "middle" : "end") : lyric.hyphen ? "begin" : "single";
      return `<lyric number="${lyric.verse}"><syllabic>${syllabic}</syllabic><text>${esc(lyric.text)}</text>${lyric.extend ? "<extend/>" : ""}</lyric>`;
    })
    .join("");
}
const previousSyllable = (lyrics: Lyric[], lyric: Lyric) =>
  lyrics.filter((candidate) => candidate.staff === lyric.staff && candidate.verse === lyric.verse && candidate.t < lyric.t).sort((first, second) => second.t - first.t)[0];

/* ---------------------------------------------------------------- indications */

type Direction = { t: number; xml: (offset: number) => string };

/** Les indications d'une portée dans une mesure, dans l'ordre : nuances, textes, soufflets, pédale, et pour la première portée de la partie, les accords et les textes du système. */
function directionsOf(ctx: Ctx, partIndex: number, staff: Staff, bar: Bar): Direction[] {
  const { score } = ctx;
  const inBar = (tick: number) => tick >= bar.start && tick < bar.end;
  // la fin d'un soufflet ou d'une pédale sur une barre s'écrit au bout de la mesure qu'elle termine :
  // la mesure suivante dans le texte n'est pas toujours celle qui suit à l'écoute
  const atEnd = (tick: number) => tick > bar.start && tick <= bar.end;
  const staffNo = score.parts[partIndex].staves > 1 ? `<staff>${staff - ctx.firstStaff[partIndex] + 1}</staff>` : "";
  const direction = (tick: number, placement: "above" | "below", type: string, sound = "") => ({
    t: tick,
    xml: (offset: number) =>
      `      <direction placement="${placement}"><direction-type>${type}</direction-type>${offset ? `<offset sound="yes">${offset}</offset>` : ""}${staffNo}${sound}</direction>`,
  });
  const out: Direction[] = [];
  const firstOfPart = staff === ctx.firstStaff[partIndex];
  if (firstOfPart && partIndex === 0) {
    for (const textMark of score.texts.filter((textMark) => inBar(textMark.t))) out.push(direction(textMark.t, "above", `<words>${esc(textMark.text)}</words>`));
  }
  if (firstOfPart && partIndex === 0) {
    for (const textMark of score.chords.filter((candidate) => inBar(candidate.t))) {
      const xml = harmonyXml(textMark.text, gridStrings(score.parts.map((part) => part.strings)));
      if (xml)
        out.push({
          t: textMark.t,
          xml: (offset: number) =>
            `      ${xml.replace("</harmony>", `${offset ? `<offset>${offset}</offset>` : ""}${staffNo}</harmony>`)}`,
        });
    }
  }
  for (const expression of score.expressions.filter((expression) => expression.staff === staff && inBar(expression.t))) {
    if (expression.kind === "dynamic") {
      const plain = /^\(.*\)$/.test(expression.text) ? `<other-dynamics>${esc(expression.text)}</other-dynamics>` : `<${expression.text}/>`;
      out.push(direction(expression.t, "below", `<dynamics>${plain}</dynamics>`));
    } else out.push(direction(expression.t, "below", `<words>${esc(expression.text)}</words>`));
  }
  // l'étouffé de la paume : « P.M. », puis des tirets jusqu'à sa fin (le vibrato s'écrit sur les notes)
  for (const effect of score.effects.filter((candidate) => candidate.staff === staff && candidate.kind === "palmMute")) {
    if (inBar(effect.start))
      out.push(direction(effect.start, "above", '<words>P.M.</words></direction-type><direction-type><dashes type="start" number="1"/>'));
    if (atEnd(effect.end) && effect.end > effect.start) out.push(direction(effect.end, "above", '<dashes type="stop" number="1"/>'));
  }
  for (const hairpin of score.hairpins.filter((candidate) => candidate.staff === staff)) {
    if (inBar(hairpin.start)) out.push(direction(hairpin.start, "below", `<wedge type="${hairpin.kind === "<" ? "crescendo" : "diminuendo"}"/>`));
    if (atEnd(hairpin.end) && hairpin.end > hairpin.start) out.push(direction(hairpin.end, "below", '<wedge type="stop"/>'));
  }
  const pedals = score.pedals.filter((pedal) => pedal.staff === staff && !pedal.implied);
  for (const current of pedals) {
    const joined = pedals.some((pedal) => pedal.end === current.start);
    if (inBar(current.start)) out.push(direction(current.start, "below", `<pedal type="${joined ? "change" : "start"}" line="yes"/>`));
    const continued = pedals.some((pedal) => pedal.start === current.end);
    if (atEnd(current.end) && !continued) out.push(direction(current.end, "below", '<pedal type="stop" line="yes"/>'));
  }
  for (const pedalText of score.pedalTexts.filter((pedalText) => pedalText.staff === staff && inBar(pedalText.t)))
    out.push(direction(pedalText.t, "below", `<words>${esc(pedalText.text)}</words>`));
  return out.sort((first, second) => first.t - second.t);
}

/** Les qualités d'accord MusicXML (<kind>) de chaque suffixe. */
const KINDS: Record<string, string> = {
  "": "major",
  m: "minor",
  aug: "augmented",
  dim: "diminished",
  "7": "dominant",
  maj7: "major-seventh",
  m7: "minor-seventh",
  dim7: "diminished-seventh",
  aug7: "augmented-seventh",
  m7b5: "half-diminished",
  mMaj7: "major-minor",
  "6": "major-sixth",
  m6: "minor-sixth",
  "9": "dominant-ninth",
  maj9: "major-ninth",
  m9: "minor-ninth",
  "11": "dominant-11th",
  m11: "minor-11th",
  "13": "dominant-13th",
  maj13: "major-13th",
  m13: "minor-13th",
  sus2: "suspended-second",
  sus4: "suspended-fourth",
  "5": "power",
};
const ROOT = ["C", "C", "D", "E", "E", "F", "F", "G", "A", "A", "B", "B"];
const ROOT_ALTER = [0, 1, 0, -1, 0, 0, 1, 0, -1, 0, -1, 0];

/**
 * Un accord d'accompagnement en <harmony> : sa fondamentale, sa qualité, sa basse, et sa grille si
 * elle est écrite (<frame> : la case de chaque corde jouée, la 1 l'aiguë) ; undefined s'il n'a pas
 * de qualité MusicXML.
 */
function harmonyXml(text: string, strings: Strings): string | undefined {
  const notes = chordNotes(text);
  const recognized = notes && recognize(notes);
  if (!recognized || KINDS[recognized.quality] === undefined) return undefined;
  const note = (tag: string, pitchClass: number) =>
    `<${tag}><${tag}-step>${ROOT[pitchClass]}</${tag}-step>${ROOT_ALTER[pitchClass] ? `<${tag}-alter>${ROOT_ALTER[pitchClass]}</${tag}-alter>` : ""}</${tag}>`;
  const { shape } = splitShape(text);
  const frets = shape === undefined ? undefined : parseShape(shape);
  let frame = "";
  if (frets) {
    const pressed = frets.filter((fret): fret is number => !!fret);
    const first = pressed.length && Math.max(...pressed) > 4 ? Math.min(...pressed) : 1;
    const notesXml = frets
      .map((fret, index) => (fret === null ? "" : `<frame-note><string>${frets.length - index}</string><fret>${fret}</fret></frame-note>`))
      .join("");
    frame = `<frame><frame-strings>${strings.open.length}</frame-strings><frame-frets>4</frame-frets>${first > 1 ? `<first-fret>${first}</first-fret>` : ""}${notesXml}</frame>`;
  }
  return `<harmony>${note("root", recognized.root)}<kind>${KINDS[recognized.quality]}</kind>${recognized.bass !== recognized.root ? note("bass", recognized.bass) : ""}${frame}</harmony>`;
}
