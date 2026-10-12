/**
 * Import MusicXML (format « score-partwise ») vers le modèle.
 *
 * - Première partie uniquement. Portée 1 = main droite, portées 2 et suivantes = main gauche.
 * - Reprises et cases 1/2 conservées telles qu'écrites (barres de reprise, cases, nombre de passages).
 * - Mesures composées (6/8, 9/8, 12/8) comptées en noires pointées, découpage ternaire.
 * - Anacrouse : la première mesure incomplète commence au temps voulu (ex. temps 3 en 3/4).
 * - Liaisons de tenue fusionnées. Petites notes ignorées.
 */
import { XMLParser } from "fast-xml-parser";
import { TICKS_PER_BEAT, sortNotes } from "./model.ts";
import type { Beat, Division, Ending, Hand, Meta, Note, Repeat, Score } from "./model.ts";

type XNode = Record<string, any>;
const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: "" });

const tag = (node: XNode) => Object.keys(node).find((k) => k !== ":@") ?? "";
const kids = (node: XNode | undefined): XNode[] => (node ? node[tag(node)] ?? [] : []);
const find = (list: XNode[], name: string) => list.find((n) => tag(n) === name);
const findAll = (list: XNode[], name: string) => list.filter((n) => tag(n) === name);
const attr = (node: XNode | undefined, a: string): string | undefined => node?.[":@"]?.[a];
const text = (node: XNode | undefined): string => {
  const t = kids(node).find((x) => "#text" in x);
  return t ? String(t["#text"]) : "";
};
const num = (node: XNode | undefined, def = 0) => {
  const s = text(node);
  return s === "" ? def : Number(s);
};

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** Pulsation déduite d'une métrique. */
export function pulse(beats: number, beatType: number): { count: number; quarters: number; division: Division } {
  if (beatType === 8 && beats % 3 === 0 && beats > 3) return { count: beats / 3, quarters: 1.5, division: 3 };
  return { count: beats, quarters: 4 / beatType, division: 2 };
}

type RawNote = { hand: Hand; midi: number; on: number; off: number; tieStart: boolean; tieStop: boolean };
type RawMeasure = {
  number: string;
  divisions: number;
  beats: number;
  beatType: number;
  /** Durée réelle du contenu, en noires. */
  length: number;
  implicit: boolean;
  notes: RawNote[]; // positions en noires depuis le début de la mesure
  startRepeat: boolean;
  endRepeat: boolean;
  times: number;
  endings?: number[];
  /** La case se termine sans crochet de fin (« discontinue » en MusicXML). */
  endingOpen?: boolean;
};

function readMeasures(part: XNode): RawMeasure[] {
  const out: RawMeasure[] = [];
  let divisions = 1, beats = 4, beatType = 4;
  let openEnding: number[] | undefined;

  for (const measure of findAll(kids(part), "measure")) {
    const items = kids(measure);
    let cursor = 0, lastStart = 0, maxCursor = 0;
    const notes: RawNote[] = [];
    let startRepeat = false, endRepeat = false, times = 2;
    let endings = openEnding;
    let closeEndingAfter = false;
    let endingOpen = false;

    for (const item of items) {
      const t = tag(item);
      if (t === "attributes") {
        const a = kids(item);
        if (find(a, "divisions")) divisions = num(find(a, "divisions"), divisions);
        const time = find(a, "time");
        if (time) {
          beats = num(find(kids(time), "beats"), beats);
          beatType = num(find(kids(time), "beat-type"), beatType);
        }
      } else if (t === "backup") {
        cursor -= num(find(kids(item), "duration")) / divisions;
      } else if (t === "forward") {
        cursor += num(find(kids(item), "duration")) / divisions;
      } else if (t === "barline") {
        const b = kids(item);
        const rep = find(b, "repeat");
        if (rep && attr(rep, "direction") === "forward") startRepeat = true;
        if (rep && attr(rep, "direction") === "backward") {
          endRepeat = true;
          times = Number(attr(rep, "times") ?? 2);
        }
        const ending = find(b, "ending");
        if (ending) {
          const type = attr(ending, "type");
          const nums = String(attr(ending, "number") ?? "1").split(/[,\s]+/).filter(Boolean).map(Number);
          if (type === "start") {
            openEnding = nums;
            endings = nums;
          } else if (type === "stop" || type === "discontinue") {
            endings = endings ?? nums;
            closeEndingAfter = true;
            if (type === "discontinue") endingOpen = true;
          }
        }
      } else if (t === "note") {
        const n = kids(item);
        if (find(n, "grace") || find(n, "cue")) continue;
        const isChord = !!find(n, "chord");
        const dur = num(find(n, "duration")) / divisions;
        const on = isChord ? lastStart : cursor;
        if (!isChord) {
          lastStart = cursor;
          cursor += dur;
        }
        const pitch = find(n, "pitch");
        if (pitch) {
          const p = kids(pitch);
          const midi = 12 * (num(find(p, "octave")) + 1) + STEP[text(find(p, "step"))] + num(find(p, "alter"));
          const ties = findAll(n, "tie").map((x) => attr(x, "type"));
          notes.push({
            hand: num(find(n, "staff"), 1) === 1 ? "D" : "G",
            midi: Math.round(midi),
            on,
            off: on + dur,
            tieStart: ties.includes("start"),
            tieStop: ties.includes("stop"),
          });
        }
      }
      maxCursor = Math.max(maxCursor, cursor);
    }
    if (closeEndingAfter) openEnding = undefined;
    out.push({
      number: String(attr(measure, "number") ?? out.length + 1),
      divisions, beats, beatType,
      length: maxCursor,
      implicit: attr(measure, "implicit") === "yes",
      notes, startRepeat, endRepeat, times, endings, endingOpen,
    });
  }
  return out;
}

/** Ordre de lecture des mesures, reprises et cases déroulées. */
export function unfold(ms: Pick<RawMeasure, "startRepeat" | "endRepeat" | "times" | "endings">[]): number[] {
  const order: number[] = [];
  let i = 0, sectionStart = 0, pass = 1, lastEnding = -1;
  let guard = 0;
  while (i < ms.length && guard++ < 100000) {
    const m = ms[i];
    if (m.startRepeat && i !== sectionStart) {
      sectionStart = i;
      pass = 1;
    }
    if (!m.endings && lastEnding >= 0 && i > lastEnding) {
      // on a dépassé le dernier bloc de cases : la section suivante repart de zéro
      lastEnding = -1;
      pass = 1;
      sectionStart = i;
    }
    if (m.endings) {
      lastEnding = Math.max(lastEnding, i);
      if (!m.endings.includes(pass)) {
        i++;
        continue;
      }
    }
    order.push(i);
    if (m.endRepeat && pass < m.times) {
      pass++;
      i = sectionStart;
      continue;
    }
    if (m.endRepeat && !m.endings) {
      pass = 1;
      sectionStart = i + 1;
    }
    i++;
  }
  if (i < ms.length) throw new Error("Reprises incohérentes dans le MusicXML : impossible de dérouler le morceau.");
  return order;
}

export function importMusicXml(xml: string, fileName?: string): Score {
  const doc = parser.parse(xml) as XNode[];
  const root = doc.find((n) => tag(n) === "score-partwise");
  if (!root) throw new Error("Seul le MusicXML « score-partwise » est pris en charge (exporte en .musicxml non compressé).");
  const rootKids = kids(root);
  const part = find(rootKids, "part");
  if (!part) throw new Error("Aucune partie trouvée dans le fichier MusicXML.");

  const meta: Meta = {};
  const work = find(rootKids, "work");
  const title = text(find(kids(work), "work-title")) || text(find(rootKids, "movement-title"));
  if (title) meta.title = title;
  const ident = kids(find(rootKids, "identification"));
  const composer = findAll(ident, "creator").find((c) => attr(c, "type") === "composer");
  if (composer && text(composer)) meta.composer = text(composer);
  if (fileName) meta.source = fileName;

  const measures = readMeasures(part);
  const beats: Beat[] = [];
  const raw: (Note & { tieStart: boolean; tieStop: boolean })[] = [];
  const EPS = 1e-6;

  // Mesures numérotées dans l'ordre d'écriture : 0 pour une anacrouse, puis 1, 2, 3…
  let barNumber = 0;
  const repeats: Repeat[] = [];
  const endings: Ending[] = [];
  measures.forEach((m, barIndex) => {
    if (m.startRepeat || m.endRepeat) {
      const r: Repeat = { barIndex };
      if (m.startRepeat) r.start = true;
      if (m.endRepeat) {
        r.end = true;
        if (m.times !== 2) r.times = m.times;
      }
      repeats.push(r);
    }
    // les mesures d'une même case partagent le même tableau de numéros
    if (m.endings) {
      const prev = endings[endings.length - 1];
      if (prev && prev.lastBar === barIndex - 1 && measures[barIndex - 1].endings === m.endings) prev.lastBar = barIndex;
      else endings.push({ numbers: [...m.endings], firstBar: barIndex, lastBar: barIndex });
      if (m.endingOpen) endings[endings.length - 1].open = true;
    }
    const p = pulse(m.beats, m.beatType);
    const nominal = p.count * p.quarters;
    const length = m.length > EPS ? Math.min(m.length, nominal) : nominal;
    const incomplete = length < nominal - EPS;
    const present = incomplete ? Math.ceil(length / p.quarters - EPS) : p.count;
    // Anacrouse : seule la toute première mesure incomplète est alignée sur la fin.
    const pickup = incomplete && (barIndex === 0 || m.implicit);
    const firstLabel = pickup ? p.count - present + 1 : 1;
    const firstBeat = beats.length;
    const bar = pickup ? "0" : String(++barNumber);
    for (let k = 0; k < present; k++) {
      beats.push({ bar, barIndex, label: firstLabel + k, division: p.division });
    }
    // position (en noires) du premier temps affiché dans la mesure virtuelle complète
    const shift = pickup ? nominal - length - (firstLabel - 1) * p.quarters : 0;
    const ticksPerQuarter = TICKS_PER_BEAT / p.quarters;
    const base = firstBeat * TICKS_PER_BEAT;
    for (const n of m.notes) {
      raw.push({
        hand: n.hand,
        midi: n.midi,
        start: base + Math.round((n.on + shift) * ticksPerQuarter),
        end: base + Math.round((n.off + shift) * ticksPerQuarter),
        tieStart: n.tieStart,
        tieStop: n.tieStop,
      });
    }
  });

  // fusion des liaisons de tenue
  raw.sort((a, b) => a.start - b.start || b.midi - a.midi);
  const merged: typeof raw = [];
  for (const n of raw) {
    if (n.end <= n.start) continue;
    if (n.tieStop) {
      const prev = merged.find((m) => m.hand === n.hand && m.midi === n.midi && m.end === n.start && m.tieStart);
      if (prev) {
        prev.end = n.end;
        prev.tieStart = n.tieStart;
        continue;
      }
    }
    merged.push({ ...n });
  }
  // deux notes identiques superposées dans la même main (voix différentes) : on n'en garde qu'une
  const notes: Note[] = [];
  for (const n of merged) {
    const dup = notes.find((m) => m.hand === n.hand && m.midi === n.midi && m.start < n.end && n.start < m.end);
    if (dup) {
      dup.start = Math.min(dup.start, n.start);
      dup.end = Math.max(dup.end, n.end);
      continue;
    }
    notes.push({ hand: n.hand, midi: n.midi, start: n.start, end: n.end });
  }
  return { meta, beats, notes: sortNotes(notes), repeats, endings, texts: [] };
}
