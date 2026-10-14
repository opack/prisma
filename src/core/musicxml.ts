/**
 * Import MusicXML (format « score-partwise ») vers le modèle.
 *
 * - Première partie uniquement. Portée 1 = main droite, portées 2 et suivantes = main gauche.
 * - Structure : le morceau est déroulé (reprises, cases, D.C., D.S., To Coda, Fine), puis
 *   découpé en sections et en ordre de jeu ; seules restent des reprises simples.
 * - Mesures composées (6/8, 9/8, 12/8) comptées en noires pointées, découpage ternaire.
 * - Anacrouse : la première mesure incomplète commence au temps voulu (ex. temps 3 en 3/4).
 *   Elle est numérotée 0 seulement si le fichier l'exclut du décompte (implicit="yes") ;
 *   sinon la numérotation du fichier est suivie, à partir du numéro de sa première mesure.
 * - Liaisons de tenue fusionnées. Petites notes ignorées.
 * - Nuances, soufflets et textes de chaque main ; les indications de tempo et de structure
 *   (rit., a tempo…) vont au-dessus du système. Pédale de résonance.
 */
import { XMLParser } from "fast-xml-parser";
import { chordNameNotes } from "./chords.ts";
import { TICKS_PER_BEAT, isDynamic, isPedalText, sortGraces, sortNotes } from "./model.ts";
import type { Arpeggio, Beat, Division, Expression, Grace, Hairpin, Slur, Hand, Marker, Meta, Note, Pedal, Repeat, Score, TextMark } from "./model.ts";

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
const LETTERS = "CDEFGAB";
const SHARP_ORDER = "FCGDAEB"; // ordre des dièses à la clé ; les bémols dans l'ordre inverse

/** Altération d'une lettre d'après l'armure : fifths > 0 dièses, < 0 bémols. */
const keyAlter = (fifths: number, letter: string) => {
  const i = SHARP_ORDER.indexOf(letter);
  return fifths > 0 && i < fifths ? 1 : fifths < 0 && i >= 7 + fifths ? -1 : 0;
};

/** Altération dessinée sur un ornement (<accidental-mark>). */
const ACCIDENTAL: Record<string, number> = { sharp: 1, natural: 0, flat: -1, "double-sharp": 2, "sharp-sharp": 2, "flat-flat": -2, "double-flat": -2 };

/** Ornements réalisés en petites notes : la suite des notes jouées avant la note (0 : elle-même, 1 : voisine du dessus, -1 : du dessous). */
const ORNAMENT_GRACES: Record<string, number[]> = {
  "inverted-mordent": [0, 1], // note, dessus, puis la note
  mordent: [0, -1], // note, dessous, puis la note
  turn: [1, 0, -1], // dessus, note, dessous, puis la note
  "inverted-turn": [-1, 0, 1],
};
/** Gruppetto après la note : joué juste avant la note suivante. */
const DELAYED_TURNS: Record<string, number[]> = { "delayed-turn": [1, 0, -1, 0], "delayed-inverted-turn": [-1, 0, 1, 0] };

/** Pulsation déduite d'une métrique. */
export function pulse(beats: number, beatType: number): { count: number; quarters: number; division: Division } {
  if (beatType === 8 && beats % 3 === 0 && beats > 3) return { count: beats / 3, quarters: 1.5, division: 3 };
  return { count: beats, quarters: 4 / beatType, division: 2 };
}

/** Indication d'une direction MusicXML, positionnée en noires depuis le début de la mesure. */
type RawDirection = { hand: Hand; at: number; kind: "dynamic" | "words" | "wedge" | "pedal" | "fermata" | "slur" | "chord"; text: string; number?: string };

/** Qualités MusicXML (<kind>) en suffixes d'accord ; une qualité absente n'est pas importée. */
const HARMONY_KIND: Record<string, string> = {
  major: "", minor: "m", augmented: "aug", diminished: "dim", dominant: "7", "major-seventh": "maj7", "minor-seventh": "m7",
  "diminished-seventh": "dim7", "augmented-seventh": "aug7", "half-diminished": "m7b5", "major-minor": "mMaj7",
  "major-sixth": "6", "minor-sixth": "m6", "dominant-ninth": "9", "major-ninth": "maj9", "minor-ninth": "m9",
  "dominant-11th": "11", "minor-11th": "m11", "dominant-13th": "13", "major-13th": "maj13", "minor-13th": "m13",
  "suspended-second": "sus2", "suspended-fourth": "sus4", power: "5",
};
const STEP_NAME = (step: string, alter: number) => step + (alter > 0 ? "#" : alter < 0 ? "b" : "");

/** Textes qui concernent tout le système : le tempo (la structure devient repères et sauts). */
const SYSTEM_WORDS =
  /^(rit|ritard|ritardando|rall|rallentando|accel|accelerando|a tempo|tempo|tempo primo|tempo i|rubato|meno mosso|più mosso|piu mosso|poco rit|molto rit|allarg|allargando|fermata|grave|largo|larghetto|lento|adagio|andante|andantino|moderato|allegretto|allegro|vivace|presto|prestissimo|lent|très lent|modéré|vif|animé|cédez|retenu|en retenant|en serrant)(?![a-zà-ÿ])/i;

/** Indications d'octave (« 8va », « (sol 8vb) », « loco »…) : inutiles, chaque note porte déjà son octave. */
const OCTAVE_WORDS = /(^|[^0-9a-z])(8|15|22)\s*(va|vb|ma|mb|ve|a|b)(?![a-z])|\b(loco|ottava|bassa)\b/i;

/** Indication de structure : repère (segno, coda) ou saut (D.C., D.S., To Coda, Fine). */
type RawStructure = { kind: "segno" | "coda" | "codaSign" | "tocoda" | "dalsegno" | "dacapo" | "fine"; id: string; at: number };

const SOUND_STRUCTURE = ["segno", "coda", "tocoda", "dalsegno", "dacapo", "fine"] as const;

/** Indications de structure d'une direction : d'après <sound> si présent, sinon d'après les signes et les mots. */
function structureOf(d: XNode[], words: string[], at: number): RawStructure[] {
  const out: RawStructure[] = [];
  const sounds = findAll(d, "sound");
  for (const snd of sounds) {
    for (const k of SOUND_STRUCTURE) {
      const v = attr(snd, k);
      if (v !== undefined) out.push({ kind: k, id: k === "dacapo" || k === "fine" ? "" : String(v), at });
    }
  }
  if (out.length) return out;
  const glyphs = findAll(d, "direction-type").flatMap((dt) => kids(dt).map(tag));
  const w = words.join(" ").trim();
  if (glyphs.includes("segno")) out.push({ kind: "segno", id: "", at });
  if (/to\s*coda/i.test(w)) out.push({ kind: "tocoda", id: "", at });
  else if (glyphs.includes("coda")) out.push({ kind: "codaSign", id: "", at });
  else if (/^coda$/i.test(w)) out.push({ kind: "coda", id: "", at });
  if (/^d\.\s*c\./i.test(w) || /^da capo/i.test(w)) out.push({ kind: "dacapo", id: "", at });
  if (/^d\.\s*s\./i.test(w) || /^dal segno/i.test(w)) out.push({ kind: "dalsegno", id: "", at });
  if (/^fine$/i.test(w)) out.push({ kind: "fine", id: "", at });
  return out;
}

type RawNote = { hand: Hand; midi: number; on: number; off: number; tieStart: boolean; tieStop: boolean; trill?: number; finger?: number };
/** Arpège : number regroupe les notes d'un même arpège, d'une portée à l'autre. */
type RawArpeggio = { hand: Hand; on: number; number?: string; down: boolean };
/** Petite note, jouée juste avant l'instant on (en noires depuis le début de la mesure). */
type RawGrace = { hand: Hand; midi: number; on: number; slot: number };
type RawMeasure = {
  number: string;
  graces: RawGrace[];
  arpeggios: RawArpeggio[];
  divisions: number;
  beats: number;
  beatType: number;
  /** Durée réelle du contenu, en noires. */
  length: number;
  implicit: boolean;
  notes: RawNote[]; // positions en noires depuis le début de la mesure
  directions: RawDirection[];
  structure: RawStructure[];
  startRepeat: boolean;
  endRepeat: boolean;
  times: number;
  endings?: number[];
};

function readMeasures(part: XNode): RawMeasure[] {
  const out: RawMeasure[] = [];
  let divisions = 1, beats = 4, beatType = 4, fifths = 0;
  let openEnding: number[] | undefined;

  for (const measure of findAll(kids(part), "measure")) {
    const items = kids(measure);
    let cursor = 0, lastStart = 0, maxCursor = 0;
    const notes: RawNote[] = [];
    const graces: RawGrace[] = [];
    const arpeggios: RawArpeggio[] = [];
    const measureAlter = new Map<string, number>(); // altérations déjà posées dans la mesure, par lettre et octave
    // petites notes en attente de leur note principale, par voix
    const waiting = new Map<string, Omit<RawGrace, "on">[]>();
    const directions: RawDirection[] = [];
    const structure: RawStructure[] = [];
    let startRepeat = false, endRepeat = false, times = 2;
    let endings = openEnding;
    let closeEndingAfter = false;

    for (const item of items) {
      const t = tag(item);
      if (t === "attributes") {
        const a = kids(item);
        if (find(a, "divisions")) divisions = num(find(a, "divisions"), divisions);
        const key = find(a, "key");
        if (key && find(kids(key), "fifths")) fifths = num(find(kids(key), "fifths"));
        const time = find(a, "time");
        if (time) {
          beats = num(find(kids(time), "beats"), beats);
          beatType = num(find(kids(time), "beat-type"), beatType);
        }
      } else if (t === "backup") {
        cursor -= num(find(kids(item), "duration")) / divisions;
      } else if (t === "forward") {
        cursor += num(find(kids(item), "duration")) / divisions;
      } else if (t === "harmony") {
        // accord d'accompagnement : fondamentale, qualité, basse éventuelle
        const h = kids(item);
        const root = kids(find(h, "root"));
        const kind = text(find(h, "kind"));
        const suffix = HARMONY_KIND[kind];
        if (root.length && suffix !== undefined) {
          const bass = kids(find(h, "bass"));
          const name =
            STEP_NAME(text(find(root, "root-step")), num(find(root, "root-alter"))) +
            suffix +
            (bass.length ? "/" + STEP_NAME(text(find(bass, "bass-step")), num(find(bass, "bass-alter"))) : "");
          const offset = find(h, "offset") ? num(find(h, "offset")) / divisions : 0;
          directions.push({ hand: "D", at: cursor + offset, kind: "chord", text: name });
        }
      } else if (t === "direction") {
        const d = kids(item);
        const at = cursor + num(find(d, "offset")) / divisions;
        const hand: Hand = num(find(d, "staff"), 1) === 1 ? "D" : "G";
        const words: string[] = [];
        for (const dt of findAll(d, "direction-type")) {
          for (const c of kids(dt)) {
            const ct = tag(c);
            if (ct === "dynamics") {
              for (const k of kids(c)) {
                const kt = tag(k);
                if (!kt || kt === "#text") continue;
                const value = kt === "other-dynamics" ? text(k).trim() : kt;
                if (value) directions.push({ hand, at, kind: "dynamic", text: value });
              }
            } else if (ct === "wedge") {
              directions.push({ hand, at, kind: "wedge", text: attr(c, "type") ?? "", number: String(attr(c, "number") ?? "1") });
            } else if (ct === "pedal") {
              directions.push({ hand, at, kind: "pedal", text: attr(c, "type") ?? "" });
            } else if (ct === "words") {
              // certains logiciels laissent des balises de mise en forme dans le texte (« <font …> »)
              const w = text(c).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
              if (w && !OCTAVE_WORDS.test(w)) words.push(w);
            }
          }
        }
        const st = structureOf(d, words, at);
        structure.push(...st);
        // les mots d'une indication de structure (« D.S. al Coda »…) deviennent un saut, pas un texte
        if (words.length && !st.length) directions.push({ hand, at, kind: "words", text: words.join(" ") });
      } else if (t === "sound") {
        structure.push(...structureOf([item], [], cursor));
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
          }
        }
      } else if (t === "note") {
        const n = kids(item);
        const isChord = !!find(n, "chord");
        const hand: Hand = num(find(n, "staff"), 1) === 1 ? "D" : "G";
        const voice = hand + ":" + (text(find(n, "voice")) || "1");
        const pitchOf = (p: XNode[]) => Math.round(12 * (num(find(p, "octave")) + 1) + STEP[text(find(p, "step"))] + num(find(p, "alter")));
        if (find(n, "grace")) {
          // sans durée : ne fait pas avancer le temps ; attend la note principale de sa voix
          const pitch = find(n, "pitch");
          if (!pitch || find(n, "cue") || attr(item, "print-object") === "no") continue;
          if (!waiting.has(voice)) waiting.set(voice, []);
          const list = waiting.get(voice)!;
          const last = list[list.length - 1];
          list.push({ hand, midi: pitchOf(kids(pitch)), slot: isChord && last ? last.slot : (last ? last.slot + 1 : 0) });
          continue;
        }
        const dur = num(find(n, "duration")) / divisions;
        const on = isChord ? lastStart : cursor;
        if (!isChord && waiting.has(voice)) {
          graces.push(...waiting.get(voice)!.map((g) => ({ ...g, on })));
          waiting.delete(voice);
        }
        if (!isChord) {
          lastStart = cursor;
          cursor += dur;
        }
        // notes à ne pas lire : réplique en petites notes (cue), note cachée (réalisation
        // d'un arpège ou d'un ornement pour la lecture audio) ; elles occupent quand même leur temps
        const hidden = !!find(n, "cue") || attr(find(n, "type"), "size") === "cue" || attr(item, "print-object") === "no";
        // point d'orgue sur une note ou un silence : une fois par instant (pas sur chaque note d'un accord)
        if (!hidden && !isChord && findAll(n, "notations").some((x) => find(kids(x), "fermata"))) {
          directions.push({ hand: num(find(n, "staff"), 1) === 1 ? "D" : "G", at: on, kind: "fermata", text: "" });
        }
        const pitch = find(n, "pitch");
        if (pitch && !hidden) {
          const p = kids(pitch);
          const step = text(find(p, "step"));
          const octave = num(find(p, "octave"));
          const midi = Math.round(12 * (octave + 1) + STEP[step] + num(find(p, "alter")));
          if (find(p, "alter")) measureAlter.set(step + octave, num(find(p, "alter")));
          const ties = findAll(n, "tie").map((x) => attr(x, "type"));
          const raw: RawNote = { hand, midi, on, off: on + dur, tieStart: ties.includes("start"), tieStop: ties.includes("stop") };
          const notations = findAll(n, "notations").flatMap((x) => kids(x));
          // voisine dans la gamme : armure, altération déjà posée dans la mesure, ou altération dessinée sur l'ornement
          const ornaments = notations.filter((x) => tag(x) === "ornaments").flatMap((x) => kids(x));
          const marks = ornaments.filter((x) => tag(x) === "accidental-mark");
          const markFor = (dir: number) => {
            const m = marks.find((x) => attr(x, "placement") === (dir > 0 ? "above" : "below")) ?? (marks.length === 1 && !attr(marks[0], "placement") ? marks[0] : undefined);
            return m ? ACCIDENTAL[text(m)] : undefined;
          };
          const neighbor = (dir: number) => {
            if (!dir) return midi;
            const i = LETTERS.indexOf(step) + dir;
            const oct = octave + (i > 6 ? 1 : i < 0 ? -1 : 0);
            const letter = LETTERS[(i + 7) % 7];
            const alter = markFor(dir) ?? measureAlter.get(letter + oct) ?? keyAlter(fifths, letter);
            return 12 * (oct + 1) + STEP[letter] + alter;
          };
          for (const o of ornaments) {
            const name = tag(o);
            if (name === "trill-mark") raw.trill = neighbor(1);
            else if (ORNAMENT_GRACES[name]) {
              const base = Math.max(-1, ...graces.filter((g) => g.hand === hand && g.on === on).map((g) => g.slot)) + 1;
              ORNAMENT_GRACES[name].forEach((dir, k) => graces.push({ hand, midi: neighbor(dir), on, slot: base + k }));
            } else if (DELAYED_TURNS[name]) {
              if (!waiting.has(voice)) waiting.set(voice, []);
              const list = waiting.get(voice)!;
              const base = list.length ? list[list.length - 1].slot + 1 : 0;
              DELAYED_TURNS[name].forEach((dir, k) => list.push({ hand, midi: neighbor(dir), slot: base + k }));
            }
          }
          // liaisons d'expression : appariées par numéro, propre à la partie (une liaison peut
          // passer d'une voix à l'autre) ; une prolongation <tie> n'en est pas une
          for (const sl of notations.filter((x) => tag(x) === "slur")) {
            const type = String(attr(sl, "type") ?? "");
            if (type === "start" || type === "stop") directions.push({ hand, at: on, kind: "slur", text: type, number: String(attr(sl, "number") ?? "1") });
          }
          // doigté : le premier doigt (une substitution « 4-3 » sur une note tenue garde le 4)
          const fingering = notations.filter((x) => tag(x) === "technical").flatMap((x) => kids(x)).find((x) => tag(x) === "fingering");
          const finger = fingering ? Number(text(fingering).match(/[1-5]/)?.[0]) : NaN;
          if (finger) raw.finger = finger;
          const arp = notations.find((x) => tag(x) === "arpeggiate");
          if (arp && !arpeggios.some((x) => x.hand === hand && x.on === on)) {
            arpeggios.push({ hand, on, number: attr(arp, "number") as string | undefined, down: attr(arp, "direction") === "down" });
          }
          notes.push(raw);
        }
      }
      maxCursor = Math.max(maxCursor, cursor);
    }
    // petites notes sans note principale dans la mesure : jouées juste avant la mesure suivante
    for (const list of waiting.values()) graces.push(...list.map((g) => ({ ...g, on: maxCursor })));
    if (closeEndingAfter) openEnding = undefined;
    out.push({
      number: String(attr(measure, "number") ?? out.length + 1),
      divisions, beats, beatType,
      length: maxCursor,
      implicit: attr(measure, "implicit") === "yes",
      notes, graces, arpeggios, directions, structure, startRepeat, endRepeat, times, endings,
    });
  }
  return out;
}

type PlayMeasure = Pick<RawMeasure, "startRepeat" | "endRepeat" | "times" | "endings"> & { structure?: RawStructure[]; length?: number };

/**
 * Ordre de jeu des mesures, tout déroulé : reprises, cases, D.C., D.S., To Coda et Fine.
 * Comme le veut l'usage, après un D.C. ou un D.S. on ne refait pas les reprises, et l'on
 * prend directement la dernière case.
 * Un segno ou une coda se place au début de sa mesure (de la suivante s'il est écrit sur la
 * barre de fin) ; un saut à la fin de sa mesure (de la précédente s'il est écrit tout au début).
 */
export function playOrder(ms: PlayMeasure[]): number[] {
  const EPS = 1e-6;
  const n = ms.length;
  const items = ms.flatMap((m, barIndex) => (m.structure ?? []).map((x) => ({ ...x, barIndex, length: m.length ?? 0 })));
  // signe coda sans <sound> : le dernier marque la coda, les précédents l'endroit d'où l'on y saute
  const signs = items.filter((x) => x.kind === "codaSign");
  signs.forEach((x, i) => (x.kind = i === signs.length - 1 ? "coda" : "tocoda"));
  const place = new Map<string, number>(); // « segno:id », « coda:id » → mesure
  const atEnd: { kind: string; id: string }[][] = ms.map(() => []);
  for (const x of items) {
    if (x.kind === "segno" || x.kind === "coda") {
      const onEnd = x.at > EPS && x.at >= x.length - EPS;
      place.set(`${x.kind}:${x.id}`, Math.min(onEnd ? x.barIndex + 1 : x.barIndex, n - 1));
    } else atEnd[Math.max(x.at <= EPS ? x.barIndex - 1 : x.barIndex, 0)].push({ kind: x.kind, id: x.id });
  }
  // un identifiant inconnu désigne le seul repère de son espèce, s'il n'y en a qu'un
  const placeOf = (kind: string, id: string) => {
    if (place.has(`${kind}:${id}`)) return place.get(`${kind}:${id}`);
    const same = [...place.entries()].filter(([k]) => k.startsWith(kind + ":"));
    return same.length === 1 ? same[0][1] : undefined;
  };
  // plus grand numéro de chaque bloc de cases consécutives (pour « la dernière case »)
  const lastEnding: number[] = ms.map(() => 0);
  for (let i = 0; i < n; i++) {
    if (!ms[i].endings) continue;
    let j = i;
    while (j < n && ms[j].endings) j++;
    const max = Math.max(...ms.slice(i, j).flatMap((m) => m.endings!));
    for (let k = i; k < j; k++) lastEnding[k] = max;
    i = j - 1;
  }

  const order: number[] = [];
  let i = 0, repeatStart = 0, pass = 1, back = false, jumped = false;
  // une reprise terminée garde son dernier passage pour les cases qui la suivent
  let passDone = false;
  for (let guard = 0; i < n; guard++) {
    if (guard > 100000) throw new Error("Reprises ou renvois incohérents dans le MusicXML : impossible de dérouler le morceau.");
    const m = ms[i];
    if (m.startRepeat && !back) {
      repeatStart = i;
      pass = 1;
    }
    back = false;
    if (passDone && !m.endings) {
      pass = 1;
      passDone = false;
    }
    if (m.endings && !m.endings.includes(jumped ? lastEnding[i] : pass)) {
      i++;
      continue;
    }
    order.push(i);
    const signsHere = atEnd[i];
    if (jumped && signsHere.some((x) => x.kind === "fine")) break;
    const toCoda = jumped ? signsHere.find((x) => x.kind === "tocoda") : undefined;
    const coda = toCoda && placeOf("coda", toCoda.id);
    if (coda !== undefined) {
      i = coda;
      continue;
    }
    const jump = jumped ? undefined : signsHere.find((x) => x.kind === "dacapo" || x.kind === "dalsegno");
    const target = jump && (jump.kind === "dacapo" ? 0 : placeOf("segno", jump.id));
    if (target !== undefined) {
      jumped = true;
      i = target;
      continue;
    }
    if (m.endRepeat && !jumped && pass < m.times) {
      pass++;
      i = repeatStart;
      back = true;
      continue;
    }
    if (m.endRepeat) {
      repeatStart = i + 1;
      passDone = true;
    }
    i++;
  }
  return order;
}

/**
 * Sections et ordre de jeu, à partir de l'ordre de jeu des mesures. Une section commence
 * partout où l'on arrive autrement qu'en venant de la mesure précédente, et partout où l'on
 * repart ailleurs. Une section toujours jouée plusieurs fois de suite devient une reprise
 * simple ; deux sections toujours jouées l'une après l'autre sont réunies.
 * Un morceau qui se joue d'un bout à l'autre n'a pas de section.
 */
export function sectionsOf(seq: number[], n: number): { repeats: Repeat[]; markers: Marker[]; order: string[] } {
  const starts = new Set([0]);
  for (let k = 0; k + 1 < seq.length; k++) {
    if (seq[k + 1] === seq[k] + 1) continue;
    starts.add(seq[k + 1]);
    if (seq[k] + 1 < n) starts.add(seq[k] + 1);
  }
  type Section = { from: number; to: number; times: number };
  let sections: Section[] = [...starts].sort((a, b) => a - b).map((from, i, all) => ({ from, to: (all[i + 1] ?? n) - 1, times: 1 }));
  // ordre : une entrée à chaque début de section
  let order: Section[] = seq.filter((b) => starts.has(b)).map((b) => sections.find((s) => s.from === b)!);

  // une section toujours jouée r fois de suite : reprise simple, jouée r fois
  for (const s of sections) {
    const runs: number[] = [];
    for (let k = 0; k < order.length; k++) {
      if (order[k] !== s) continue;
      let r = 1;
      while (order[k + r] === s) r++;
      runs.push(r);
      k += r - 1;
    }
    if (runs.length && runs[0] > 1 && runs.every((r) => r === runs[0])) {
      s.times = runs[0];
      order = order.filter((x, k) => x !== s || order[k - 1] !== s);
    }
  }
  // deux sections voisines toujours jouées l'une après l'autre : une seule section
  const parts = new Map<Section, Section[]>(sections.map((s) => [s, [s]]));
  for (let merged = true; merged; ) {
    merged = false;
    for (let k = 0; k + 1 < sections.length; k++) {
      const x = sections[k], y = sections[k + 1];
      const together = order.every((s, i) => (s === x ? order[i + 1] === y : true) && (s === y ? order[i - 1] === x : true));
      if (!together || !order.includes(x)) continue;
      x.to = y.to;
      parts.get(x)!.push(...parts.get(y)!);
      sections.splice(k + 1, 1);
      order = order.filter((s) => s !== y);
      merged = true;
      break;
    }
  }
  const repeats: Repeat[] = [];
  for (const p of sections.flatMap((x) => parts.get(x)!)) {
    if (p.times < 2) continue;
    const end: Repeat = { barIndex: p.to, end: true, ...(p.times !== 2 ? { times: p.times } : {}) };
    if (p.from === p.to) repeats.push({ ...end, start: true });
    else repeats.push({ barIndex: p.from, start: true }, end);
  }
  repeats.sort((a, b) => a.barIndex - b.barIndex);
  // une seule section jouée une fois : pas de section du tout
  if (sections.length === 1 && order.length === 1) return { repeats, markers: [], order: [] };
  if (sections.length > 26) throw new Error("Structure trop complexe : plus de 26 sections.");
  const letter = (s: Section) => String.fromCharCode(65 + sections.indexOf(s));
  return {
    repeats,
    markers: sections.map((s) => ({ label: letter(s), barIndex: s.from })),
    order: order.map(letter),
  };
}

/** Découpages possibles d'un temps à l'import : jusqu'à 48 cases (doubles croches, triolets de doubles croches). */
const DIVISIONS = Array.from({ length: 48 }, (_, i) => i + 1).filter((n) => TICKS_PER_BEAT % n === 0);

/**
 * Cale les instants des notes, temps par temps, sur le plus petit découpage qui garde tous
 * les instants distincts et dans l'ordre. Un septolet, impossible à écrire exactement,
 * prend ainsi 8 cases plutôt que 48 : une valeur irrégulière ne fait pas exploser la
 * largeur de son temps.
 */
function quantizer(times: number[]): (t: number) => number {
  const byBeat = new Map<number, Set<number>>();
  for (const t of times) {
    const b = Math.floor(t / TICKS_PER_BEAT);
    if (!byBeat.has(b)) byBeat.set(b, new Set());
    byBeat.get(b)!.add(t - b * TICKS_PER_BEAT);
  }
  const step = new Map<number, number>();
  const NOISE = 2; // écart d'arrondi, en ticks, toléré pour un découpage exact
  for (const [b, set] of byBeat) {
    const offsets = [...set].sort((x, y) => x - y);
    const snap = (s: number) => offsets.map((o) => Math.round(o / s) * s);
    // d'abord le plus petit découpage exact ; à défaut (septolet…), le plus petit qui
    // garde tous les instants distincts et dans l'ordre, en les déplaçant de peu
    const exact = DIVISIONS.find((n) => offsets.every((o) => Math.abs(o - Math.round(o / (TICKS_PER_BEAT / n)) * (TICKS_PER_BEAT / n)) <= NOISE));
    const readable = DIVISIONS.find((n) => {
      const v = snap(TICKS_PER_BEAT / n);
      return v.every((x, i) => Math.abs(x - offsets[i]) <= TICKS_PER_BEAT / 16 && (i === 0 || x > v[i - 1]));
    });
    step.set(b, TICKS_PER_BEAT / (exact ?? readable ?? 48));
  }
  return (t) => {
    const b = Math.floor(t / TICKS_PER_BEAT);
    const s = step.get(b) ?? TICKS_PER_BEAT;
    return b * TICKS_PER_BEAT + Math.round((t - b * TICKS_PER_BEAT) / s) * s;
  };
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
  const clean = (s: string) => s.replace(/\s+/g, " ").trim();
  // texte de page d'un type donné (titre, sous-titre) : ses morceaux se suivent, et un
  // suffixe d'ordinal (« 3 » puis « rd ») se colle au nombre
  const creditText = (type: string) => {
    const credit = findAll(rootKids, "credit").find((c) => text(find(kids(c), "credit-type")) === type);
    const pieces = credit ? findAll(kids(credit), "credit-words").map((w) => clean(text(w))).filter(Boolean) : [];
    return pieces.reduce((s, p) => (s && /\d$/.test(s) && /^(st|nd|rd|th|e|er|re|ème|eme)\b/i.test(p) ? s + p : s ? s + " " + p : p), "");
  };
  const title = clean(text(find(kids(work), "work-title")) || text(find(rootKids, "movement-title"))) || creditText("title");
  if (title) meta.title = title;
  // sous-titre : le texte de page marqué comme tel, sinon le titre du mouvement s'il complète celui de l'œuvre
  const fromCredit = creditText("subtitle");
  const movement = clean(text(find(rootKids, "movement-title")));
  const subtitle = fromCredit || (movement && movement !== title ? movement : "");
  if (subtitle && subtitle !== title) meta.subtitle = subtitle;
  const ident = kids(find(rootKids, "identification"));
  const composer = findAll(ident, "creator").find((c) => attr(c, "type") === "composer");
  if (composer && text(composer)) meta.composer = text(composer);
  if (fileName) meta.source = fileName;

  const measures = readMeasures(part);
  const beats: Beat[] = [];
  const raw: (Note & { tieStart: boolean; tieStop: boolean })[] = [];
  const rawGraces: Grace[] = [];
  const rawArpeggios: (RawArpeggio & { t: number })[] = [];
  const rawDirections: (RawDirection & { t: number })[] = [];
  const EPS = 1e-6;

  // Mesures numérotées comme dans le fichier : à partir du numéro de la première mesure,
  // ou 0 pour une anacrouse exclue du décompte (implicit="yes"), puis à la suite.
  const first = measures[0];
  const firstNumber = Number(first?.number);
  const uncounted = !!first?.implicit;
  let barNumber = uncounted || !Number.isInteger(firstNumber) ? 0 : firstNumber - 1;
  measures.forEach((m, barIndex) => {
    const p = pulse(m.beats, m.beatType);
    const nominal = p.count * p.quarters;
    const length = m.length > EPS ? Math.min(m.length, nominal) : nominal;
    const incomplete = length < nominal - EPS;
    const present = incomplete ? Math.ceil(length / p.quarters - EPS) : p.count;
    // Anacrouse : seule la toute première mesure incomplète est alignée sur la fin.
    const pickup = incomplete && (barIndex === 0 || m.implicit);
    const firstLabel = pickup ? p.count - present + 1 : 1;
    const firstBeat = beats.length;
    const bar = barIndex === 0 && uncounted ? "0" : String(++barNumber);
    for (let k = 0; k < present; k++) {
      beats.push({ bar, barIndex, label: firstLabel + k, division: p.division });
    }
    // position (en noires) du premier temps affiché dans la mesure virtuelle complète
    const shift = pickup ? nominal - length - (firstLabel - 1) * p.quarters : 0;
    const ticksPerQuarter = TICKS_PER_BEAT / p.quarters;
    const base = firstBeat * TICKS_PER_BEAT;
    for (const d of m.directions) rawDirections.push({ ...d, t: base + Math.round((d.at + shift) * ticksPerQuarter) });
    for (const x of m.arpeggios) rawArpeggios.push({ ...x, t: base + Math.round((x.on + shift) * ticksPerQuarter) });
    for (const g of m.graces) rawGraces.push({ hand: g.hand, midi: g.midi, t: base + Math.round((g.on + shift) * ticksPerQuarter), slot: g.slot });
    for (const n of m.notes) {
      raw.push({
        hand: n.hand,
        midi: n.midi,
        start: base + Math.round((n.on + shift) * ticksPerQuarter),
        end: base + Math.round((n.off + shift) * ticksPerQuarter),
        tieStart: n.tieStart,
        tieStop: n.tieStop,
        ...(n.trill !== undefined ? { trill: n.trill } : {}),
        ...(n.finger ? { finger: n.finger } : {}),
      });
    }
  });

  // instants calés sur un découpage lisible de chaque temps
  const q = quantizer(raw.flatMap((n) => [n.start, n.end]));
  for (const n of raw) {
    const start = q(n.start), end = q(n.end);
    // une note écrasée par le calage (rare : à cheval sur une fin de temps) garde une durée
    n.start = start;
    n.end = Math.max(end, start + TICKS_PER_BEAT / 48);
  }
  // fusion des liaisons de tenue
  raw.sort((a, b) => a.start - b.start || b.midi - a.midi);
  const merged: typeof raw = [];
  for (const n of raw) {
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
      if (n.trill !== undefined) dup.trill = n.trill;
      if (n.finger && !dup.finger) dup.finger = n.finger;
      continue;
    }
    notes.push({
      hand: n.hand, midi: n.midi, start: n.start, end: n.end,
      ...(n.trill !== undefined ? { trill: n.trill } : {}),
      ...(n.finger ? { finger: n.finger } : {}),
    });
  }
  const sorted = sortNotes(notes);
  // petites notes : calées comme les notes, une seule par main, instant, rang et hauteur
  const graces: Grace[] = [];
  const end = beats.length * TICKS_PER_BEAT;
  for (const g of rawGraces) {
    const t = q(g.t);
    if (t >= end) continue;
    if (!graces.some((x) => x.hand === g.hand && x.t === t && x.slot === g.slot && x.midi === g.midi)) graces.push({ ...g, t });
  }
  // arpèges : un même numéro sur les deux portées au même instant égrène les deux mains d'un seul geste
  const arpeggios: Arpeggio[] = [];
  for (const x of rawArpeggios) {
    const t = q(x.t);
    if (t >= end || arpeggios.some((y) => y.t === t && (!y.hand || y.hand === x.hand))) continue;
    const other = x.number !== undefined && rawArpeggios.find((y) => y.hand !== x.hand && q(y.t) === t && y.number === x.number);
    const down = x.down ? { down: true } : {};
    if (other) {
      for (let i = arpeggios.length - 1; i >= 0; i--) if (arpeggios[i].t === t) arpeggios.splice(i, 1);
      arpeggios.push({ t, ...down });
    } else arpeggios.push({ t, hand: x.hand, ...down });
  }
  arpeggios.sort((a, b) => a.t - b.t || (a.hand ?? "").localeCompare(b.hand ?? ""));
  return { meta, beats, notes: sorted, graces: sortGraces(graces), arpeggios, ...directionsOf(rawDirections, sorted, beats.length), ...sectionsOf(playOrder(measures), measures.length) };
}

/**
 * Nuances, soufflets et textes. Chaque indication est calée sur l'attaque ou le début de
 * temps le plus proche, pour ne jamais imposer de découpage plus fin que les notes.
 */
function directionsOf(dirs: (RawDirection & { t: number })[], notes: Note[], beatCount: number) {
  const end = beatCount * TICKS_PER_BEAT;
  const grid = [...new Set([...notes.map((n) => n.start), ...Array.from({ length: beatCount + 1 }, (_, i) => i * TICKS_PER_BEAT)])].sort((a, b) => a - b);
  const snap = (t: number) => grid.reduce((best, g) => (Math.abs(g - t) < Math.abs(best - t) ? g : best), grid[0]);
  const texts: TextMark[] = [];
  const expressions: Expression[] = [];
  const hairpins: Hairpin[] = [];
  const open: (Hairpin & { number: string })[] = [];
  const slurs: Slur[] = [];
  const openSlurs: (Slur & { number: string })[] = [];
  const pedals: Pedal[] = [];
  let pedal: Pedal | undefined;
  const pedalUp = (t: number) => {
    if (pedal && t > pedal.start) {
      pedal.end = t;
      pedals.push(pedal);
    }
    pedal = undefined;
  };
  const fermatas: number[] = [];
  const chords: TextMark[] = [];
  const pedalTexts: TextMark[] = [];
  const seen = new Set<string>();
  // à un même instant, une liaison se referme avant qu'une autre ne commence sur la même note
  const rank = (d: RawDirection) => (d.kind === "slur" && d.text === "start" ? 1 : 0);
  for (const d of [...dirs].sort((a, b) => a.t - b.t || rank(a) - rank(b))) {
    const t = Math.min(snap(d.t), end);
    if (d.kind === "slur") {
      if (d.text === "start") {
        if (t < end) openSlurs.push({ hand: d.hand, start: t, end: -1, number: d.number! });
      } else {
        const i = openSlurs.findIndex((s) => s.number === d.number);
        if (i < 0) continue;
        const [s] = openSlurs.splice(i, 1);
        if (t > s.start && !slurs.some((x) => x.hand === s.hand && x.start === s.start && x.end === t)) slurs.push({ hand: s.hand, start: s.start, end: t });
      }
      continue;
    }
    // un accord peut aussi être écrit en simple texte (« A7 » au-dessus de la portée) : tout le texte doit être un nom d'accord
    if (d.kind === "chord" || (d.kind === "words" && chordNameNotes(d.text.trim()))) {
      if (t < end && !chords.some((c) => c.t === t)) chords.push({ t, text: d.text.trim() });
      continue;
    }
    if (d.kind === "fermata") {
      if (t < end && !fermatas.includes(t)) fermatas.push(t);
      continue;
    }
    if (d.kind === "pedal") {
      // start et resume enfoncent, stop et discontinue relâchent, change fait les deux
      if (d.text === "stop" || d.text === "discontinue" || d.text === "change") pedalUp(t);
      if (d.text === "start" || d.text === "resume" || d.text === "change") {
        if (pedal) pedalUp(t); // déjà enfoncée : on la change
        if (t < end) pedal = { start: t, end };
      }
      continue;
    }
    if (d.kind === "wedge") {
      if (d.text === "crescendo" || d.text === "diminuendo") {
        open.push({ hand: d.hand, kind: d.text === "crescendo" ? "<" : ">", start: Math.min(t, end - 1), end, number: d.number! });
      } else if (d.text === "stop") {
        const i = open.findIndex((w) => w.number === d.number && w.hand === d.hand);
        const j = i >= 0 ? i : open.findIndex((w) => w.number === d.number);
        if (j < 0) continue;
        const [w] = open.splice(j, 1);
        if (t > w.start) hairpins.push({ hand: w.hand, kind: w.kind, start: w.start, end: t });
      }
      continue;
    }
    if (t >= end) continue;
    // une même indication répétée dans les deux portées n'est gardée qu'une fois par main
    const key = `${d.hand}|${t}|${d.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (d.kind === "words" && SYSTEM_WORDS.test(d.text)) {
      if (!texts.some((x) => x.t === t && x.text === d.text)) texts.push({ t, text: d.text });
    } else if (d.kind === "words" && isPedalText(d.text)) {
      // consigne de pédale : sur la ligne de pédale, quelle que soit la portée qui la porte
      if (!pedalTexts.some((x) => x.t === t && x.text === d.text)) pedalTexts.push({ t, text: d.text });
    } else {
      const prev = expressions[expressions.length - 1];
      // parenthèses écrites à part autour d'une nuance (« ( », « mp », « ) ») : une seule nuance « (mp) »
      if (d.kind === "dynamic" && prev && prev.hand === d.hand && prev.t === t && (prev.text.endsWith("(") || d.text === ")")) {
        prev.text += d.text;
        prev.kind = isDynamic(prev.text) ? "dynamic" : "text";
      } else {
        expressions.push({ hand: d.hand, t, text: d.text, kind: d.kind === "dynamic" && isDynamic(d.text) ? "dynamic" : "text" });
      }
    }
  }
  // soufflet jamais refermé : jusqu'à la fin du morceau
  for (const w of open) hairpins.push({ hand: w.hand, kind: w.kind, start: w.start, end: w.end });
  hairpins.sort((a, b) => a.start - b.start);
  if (pedal) pedalUp(end);
  slurs.sort((a, b) => a.start - b.start || (a.hand === b.hand ? a.end - b.end : a.hand === "D" ? -1 : 1));
  return { texts, expressions, hairpins, slurs, pedals, pedalTexts, fermatas, chords: chords.sort((a, b) => a.t - b.t) };
}
