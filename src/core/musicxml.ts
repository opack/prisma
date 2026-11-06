/**
 * Import MusicXML (format « score-partwise ») vers le modèle.
 *
 * - Une partie par <part>, une portée par <staff> (le piano en a deux) ; les parties nommées d'après
 *   <part-name> quand il y a plusieurs parties.
 * - Structure : le morceau est déroulé (reprises, cases, D.C., D.S., To Coda, Fine), puis
 *   découpé en sections et en ordre de jeu ; seules restent des reprises simples. Une partie
 *   écrite plusieurs fois, sous le même repère de répétition, n'est gardée qu'une fois.
 * - Mesures composées (6/8, 9/8, 12/8) comptées en noires pointées, découpage ternaire.
 * - Anacrouse : la première mesure incomplète commence au temps voulu (ex. temps 3 en 3/4).
 *   Elle est numérotée 0 seulement si le fichier l'exclut du décompte (implicit="yes") ;
 *   sinon la numérotation du fichier est suivie, à partir du numéro de sa première mesure.
 * - Liaisons de tenue fusionnées.
 * - Nuances, soufflets et textes de chaque portée ; les indications de tempo et de structure
 *   (rit., a tempo…) vont au-dessus du système. Pédale de résonance.
 */
import { XMLParser } from "fast-xml-parser";
import { chordNameNotes, chordNotes, prismaNameOf } from "./chords.ts";
import { SHAPE_SEPARATOR, gridStrings, parseShape, shapePitches, shapeText, splitShape } from "./shapes.ts";
import type { Shape } from "./shapes.ts";
import { guessKey, keysOfSignature, prismaKey } from "./key.ts";
import {
  TICKS_PER_BEAT,
  dynamicInWords,
  isPick,
  sortArticulations,
  isDynamic,
  isPedalText,
  staffCount,
  sortGraces,
  sortLyrics,
  sortNotes,
  stringsOfStaff,
} from "./model.ts";
import { guessInstrument, instrumentOfProgram } from "./instruments.ts";
import { stringParts, tuningOf } from "./strings.ts";
import type {
  Arpeggio,
  Articulation,
  ArticulationKind,
  Beat,
  Division,
  Effect,
  Expression,
  Grace,
  Hairpin,
  Part,
  Slur,
  Staff,
  Lyric,
  Marker,
  Meta,
  Note,
  Pedal,
  PedalText,
  Repeat,
  Score,
  TextMark,
} from "./model.ts";

/**
 * Paroles : les couplets numérotés à la suite (1, 2…) dans l'ordre de leurs numéros, une
 * syllabe par portée, couplet et instant. Un mélisme (extend) court jusqu'à la fin de la
 * dernière note de sa voix avant la syllabe suivante du couplet, s'il en couvre plusieurs.
 */
function lyricsOf(
  raw: (RawLyric & { t: number })[],
  voiceNotes: (RawVoiceNote & { start: number; end: number })[],
  quantize: (t: number) => number,
  end: number,
): Lyric[] {
  const numbers = [...new Set(raw.map((lyric) => lyric.number))].sort((first, second) => (Number(first) || 0) - (Number(second) || 0) || first.localeCompare(second));
  const out: (Lyric & { voice: string; melisma: boolean })[] = [];
  for (const lyric of raw) {
    const tick = quantize(lyric.t);
    const verse = numbers.indexOf(lyric.number) + 1;
    if (tick >= end || out.some((other) => other.staff === lyric.staff && other.verse === verse && other.t === tick)) continue;
    out.push({
      staff: lyric.staff,
      verse,
      t: tick,
      text: lyric.text,
      ...(lyric.hyphen ? { hyphen: true } : {}),
      voice: lyric.voice,
      melisma: lyric.extend && !lyric.hyphen,
    });
  }
  const notes = voiceNotes.map((note) => ({ ...note, start: quantize(note.start), end: quantize(note.end) }));
  for (const lyric of out) {
    if (!lyric.melisma) continue;
    const next = Math.min(end, ...out.filter((other) => other.staff === lyric.staff && other.verse === lyric.verse && other.t > lyric.t).map((other) => other.t));
    const sung = notes.filter((note) => note.staff === lyric.staff && note.voice === lyric.voice && note.start >= lyric.t && note.start < next);
    if (sung.some((note) => note.start > lyric.t)) lyric.extend = Math.min(next, Math.max(...sung.map((note) => note.end)));
  }
  return sortLyrics(out.map(({ voice, melisma, ...lyric }) => lyric));
}

// l'arbre que rend fast-xml-parser : sa forme est celle du fichier lu, inconnue d'avance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type XNode = Record<string, any>;
const parser = new XMLParser({ preserveOrder: true, ignoreAttributes: false, attributeNamePrefix: "" });

const tag = (node: XNode) => Object.keys(node).find((key) => key !== ":@") ?? "";
const kids = (node: XNode | undefined): XNode[] => (node ? (node[tag(node)] ?? []) : []);
const find = (list: XNode[], name: string) => list.find((xNode) => tag(xNode) === name);
const findAll = (list: XNode[], name: string) => list.filter((xNode) => tag(xNode) === name);
const attr = (node: XNode | undefined, name: string): string | undefined => node?.[":@"]?.[name];
const text = (node: XNode | undefined): string => {
  const xNode = kids(node).find((child) => "#text" in child);
  return xNode ? String(xNode["#text"]) : "";
};
const num = (node: XNode | undefined, def = 0) => {
  const content = text(node);
  return content === "" ? def : Number(content);
};

const STEP: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const LETTERS = "CDEFGAB";
const SHARP_ORDER = "FCGDAEB"; // ordre des dièses à la clé ; les bémols dans l'ordre inverse

/** Altération d'une lettre d'après l'armure : fifths > 0 dièses, < 0 bémols. */
const keyAlter = (fifths: number, letter: string) => {
  const index = SHARP_ORDER.indexOf(letter);
  return fifths > 0 && index < fifths ? 1 : fifths < 0 && index >= 7 + fifths ? -1 : 0;
};

/** Altération dessinée sur un ornement (<accidental-mark>). */
const ACCIDENTAL: Record<string, number> = {
  sharp: 1,
  natural: 0,
  flat: -1,
  "double-sharp": 2,
  "sharp-sharp": 2,
  "flat-flat": -2,
  "double-flat": -2,
};

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
type RawDirection = {
  staff: Staff;
  at: number;
  kind: "dynamic" | "words" | "wedge" | "pedal" | "fermata" | "slur" | "legato" | "palmMute" | "vibrato" | "chord";
  text: string;
  number?: string;
};

/** Qualités MusicXML (<kind>) en suffixes d'accord ; une qualité absente n'est pas importée. */
const HARMONY_KIND: Record<string, string> = {
  major: "",
  minor: "m",
  augmented: "aug",
  diminished: "dim",
  dominant: "7",
  "major-seventh": "maj7",
  "minor-seventh": "m7",
  "diminished-seventh": "dim7",
  "augmented-seventh": "aug7",
  "half-diminished": "m7b5",
  "major-minor": "mMaj7",
  "major-sixth": "6",
  "minor-sixth": "m6",
  "dominant-ninth": "9",
  "major-ninth": "maj9",
  "minor-ninth": "m9",
  "dominant-11th": "11",
  "minor-11th": "m11",
  "dominant-13th": "13",
  "major-13th": "maj13",
  "minor-13th": "m13",
  "suspended-second": "sus2",
  "suspended-fourth": "sus4",
  power: "5",
};
const STEP_NAME = (step: string, alter: number) => step + (alter > 0 ? "#" : alter < 0 ? "b" : "");

/** Textes qui concernent tout le système : le tempo (la structure devient repères et sauts). */
const SYSTEM_WORDS =
  /^(rit|ritard|ritardando|rall|rallentando|accel|accelerando|a tempo|tempo|tempo primo|tempo i|rubato|meno mosso|più mosso|piu mosso|poco rit|molto rit|allarg|allargando|fermata|grave|largo|larghetto|lento|adagio|andante|andantino|moderato|allegretto|allegro|vivace|presto|prestissimo|lent|très lent|modéré|vif|animé|cédez|retenu|en retenant|en serrant)(?![a-zà-ÿ])/i;

/**
 * Lettres de nuance de la police musicale SMuFL (U+E520…), que certains logiciels écrivent
 * dans les textes (« pp con sordina ») : remplacées par les lettres ordinaires.
 */
const SMUFL_DYNAMICS: Record<number, string> = {
  0xe520: "p",
  0xe521: "m",
  0xe522: "f",
  0xe523: "r",
  0xe524: "s",
  0xe525: "z",
  0xe526: "n",
  0xe527: "pppppp",
  0xe528: "ppppp",
  0xe529: "pppp",
  0xe52a: "ppp",
  0xe52b: "pp",
  0xe52c: "mp",
  0xe52d: "mf",
  0xe52e: "pf",
  0xe52f: "ff",
  0xe530: "fff",
  0xe531: "ffff",
  0xe532: "fffff",
  0xe533: "ffffff",
  0xe534: "fp",
  0xe535: "fz",
  0xe536: "sf",
  0xe537: "sfp",
  0xe538: "sfpp",
  0xe539: "sfz",
  0xe53a: "sfzp",
  0xe53b: "sffz",
  0xe53c: "rf",
  0xe53d: "rfz",
};
const plainDynamics = (value: string) => value.replace(/[\ue520-\ue53d]/g, (cell) => SMUFL_DYNAMICS[cell.codePointAt(0)!] ?? "");

/** Indications d'octave (« 8va », « (sol 8vb) », « loco »…) : inutiles, chaque note porte déjà son octave. */
const OCTAVE_WORDS = /(^|[^0-9a-z])(8|15|22)\s*(va|vb|ma|mb|ve|a|b)(?![a-z])|\b(loco|ottava|bassa)\b/i;

/** Indication de structure : repère (segno, coda) ou saut (D.C., D.S., To Coda, Fine). */
type RawStructure = { kind: "segno" | "coda" | "codaSign" | "tocoda" | "dalsegno" | "dacapo" | "fine"; id: string; at: number };

const SOUND_STRUCTURE = ["segno", "coda", "tocoda", "dalsegno", "dacapo", "fine"] as const;

/** Indications de structure d'une direction : d'après <sound> si présent, sinon d'après les signes et les mots. */
function structureOf(xNodes: XNode[], words: string[], at: number): RawStructure[] {
  const out: RawStructure[] = [];
  const sounds = findAll(xNodes, "sound");
  for (const sound of sounds) {
    for (const key of SOUND_STRUCTURE) {
      const value = attr(sound, key);
      if (value !== undefined) out.push({ kind: key, id: key === "dacapo" || key === "fine" ? "" : String(value), at });
    }
  }
  if (out.length) return out;
  const glyphs = findAll(xNodes, "direction-type").flatMap((directionType) => kids(directionType).map(tag));
  const word = words.join(" ").trim();
  if (glyphs.includes("segno")) out.push({ kind: "segno", id: "", at });
  if (/to\s*coda/i.test(word)) out.push({ kind: "tocoda", id: "", at });
  else if (glyphs.includes("coda")) out.push({ kind: "codaSign", id: "", at });
  else if (/^coda$/i.test(word)) out.push({ kind: "coda", id: "", at });
  if (/^d\.\s*c\./i.test(word) || /^da capo/i.test(word)) out.push({ kind: "dacapo", id: "", at });
  if (/^d\.\s*s\./i.test(word) || /^dal segno/i.test(word)) out.push({ kind: "dalsegno", id: "", at });
  if (/^fine$/i.test(word)) out.push({ kind: "fine", id: "", at });
  return out;
}

type RawNote = {
  staff: Staff;
  midi: number;
  on: number;
  off: number;
  tieStart: boolean;
  tieStop: boolean;
  trill?: number;
  finger?: number;
  string?: number;
  tech?: Pick<Note, "dead" | "harmonic" | "slide" | "slideOut" | "slideIn" | "bend" | "release">;
};
/** Arpège : number regroupe les notes d'un même arpège, d'une portée à l'autre. */
type RawArpeggio = { staff: Staff; on: number; number?: string; down: boolean };
/** Petite note, jouée juste avant l'instant on (en noires depuis le début de la mesure). */
type RawGrace = { staff: Staff; midi: number; on: number; slot: number; string?: number };
/**
 * Syllabe portée par une note : number désigne le couplet ; voice la voix de la note, pour
 * suivre un mélisme (extend) sur les notes suivantes de cette voix.
 */
type RawLyric = { staff: Staff; voice: string; on: number; number: string; text: string; hyphen: boolean; extend: boolean };
/** Note jouée, réduite à sa voix et à sa durée : sert à mesurer les mélismes. */
type RawVoiceNote = { staff: Staff; voice: string; on: number; off: number };
/** Articulation d'une note : staccato, accent ou marcato (le tenuto est la durée écrite). */
type RawArticulation = { staff: Staff; on: number; kind: ArticulationKind };
/** Articulations MusicXML retenues ; le détaché-lié (tenuto et staccato) reste un staccato. */
const ARTICULATIONS: Record<string, ArticulationKind> = {
  staccato: "staccato",
  staccatissimo: "staccato",
  spiccato: "staccato",
  "detached-legato": "staccato",
  accent: "accent",
  "strong-accent": "marcato",
};
type RawMeasure = {
  number: string;
  articulations: RawArticulation[];
  lyrics: RawLyric[];
  voiceNotes: RawVoiceNote[];
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
  /** Repère de répétition (<rehearsal>) en tête de mesure : « A », « B »… */
  rehearsal?: string;
};

/** Les syllabes d'une note : une par couplet ; une élision (deux syllabes sur une note) s'écrit « ‿ ». */
function lyricsOfNote(xNodes: XNode[], staff: Staff, voice: string, on: number): RawLyric[] {
  const out: RawLyric[] = [];
  for (const ly of findAll(xNodes, "lyric")) {
    const parts = kids(ly);
    const words = findAll(parts, "text")
      .map((child) => text(child).trim())
      .filter(Boolean);
    if (!words.length) continue;
    const syllabic = findAll(parts, "syllabic").map(text);
    const last = syllabic[syllabic.length - 1];
    const ext = find(parts, "extend");
    out.push({
      staff,
      voice,
      on,
      number: String(attr(ly, "number") ?? "1"),
      // seules les espaces séparent les syllabes d'une ligne @l : celles d'une syllabe deviennent insécables
      text: words.join("‿").replace(/\s+/g, "\u00A0"),
      hyphen: last === "begin" || last === "middle",
      extend: !!ext && attr(ext, "type") !== "stop",
    });
  }
  return out;
}

/**
 * La portée de tablature d'une partie (clé TAB), son accordage et son capo : la hauteur à vide de
 * chaque corde, de la 1 (l'aiguë) à la plus grave.
 */
function tabStaffOf(measures: XNode[]): { staff: number; open: number[]; capo: number } | undefined {
  for (const xNodes of measures.flatMap((xNode) => findAll(kids(xNode), "attributes")).map(kids)) {
    const clef = findAll(xNodes, "clef").find((xNode) => text(find(kids(xNode), "sign")) === "TAB");
    if (!clef) continue;
    const staff = Number(attr(clef, "number") ?? 1);
    const details = findAll(xNodes, "staff-details").find((xNode) => Number(attr(xNode, "number") ?? 1) === staff);
    const lines = findAll(kids(details), "staff-tuning")
      .map((xNode) => ({
        line: Number(attr(xNode, "line")),
        midi:
          12 * (num(find(kids(xNode), "tuning-octave")) + 1) + STEP[text(find(kids(xNode), "tuning-step"))] + num(find(kids(xNode), "tuning-alter")),
      }))
      .sort((first, second) => second.line - first.line);
    if (!lines.length) return undefined;
    return { staff, open: lines.map((tuning) => tuning.midi), capo: num(find(kids(details), "capo"), 0) };
  }
  return undefined;
}

/**
 * Les mesures d'une partie. tab : le numéro de sa portée de tablature ; ses notes, avec leur
 * corde, sont alors les seules lues, sur une seule portée (la partition classique qui la double
 * n'en est que la copie) ; nuances, textes et paroles viennent de toutes les portées.
 */
function readMeasures(partNode: XNode, base: Staff, staves: number, tab?: number): RawMeasure[] {
  const out: RawMeasure[] = [];
  // une portée Prisma par <staff> : le staff 1 est la portée base, le 2 la suivante…
  const staffPart = (staff: number) => (tab !== undefined ? base : base + Math.min(Math.max(staff, 1), staves) - 1);
  let divisions = 1,
    beats = 4,
    beatType = 4,
    fifths = 0;
  // instrument transpositeur : écart entre la hauteur écrite et la hauteur qui sonne (en demi-tons)
  let transpose = 0;
  let openEnding: number[] | undefined;

  for (const measure of findAll(kids(partNode), "measure")) {
    const items = kids(measure);
    let cursor = 0,
      lastStart = 0,
      maxCursor = 0;
    const notes: RawNote[] = [];
    const graces: RawGrace[] = [];
    const arpeggios: RawArpeggio[] = [];
    const lyrics: RawLyric[] = [];
    const voiceNotes: RawVoiceNote[] = [];
    const articulations: RawArticulation[] = [];
    const measureAlter = new Map<string, number>(); // altérations déjà posées dans la mesure, par lettre et octave
    // petites notes en attente de leur note principale, par voix
    const waiting = new Map<string, Omit<RawGrace, "on">[]>();
    const directions: RawDirection[] = [];
    let rehearsal: string | undefined;
    const structure: RawStructure[] = [];
    let startRepeat = false,
      endRepeat = false,
      times = 2;
    let endings = openEnding;
    let closeEndingAfter = false;

    for (const item of items) {
      const nodeTag = tag(item);
      if (nodeTag === "attributes") {
        const xNodes = kids(item);
        if (find(xNodes, "divisions")) divisions = num(find(xNodes, "divisions"), divisions);
        const key = find(xNodes, "key");
        if (key && find(kids(key), "fifths")) fifths = num(find(kids(key), "fifths"));
        // <transpose> : ce qu'il faut ajouter à la note écrite pour obtenir celle qui sonne
        const tr = find(xNodes, "transpose");
        if (tr) transpose = num(find(kids(tr), "chromatic")) + 12 * num(find(kids(tr), "octave-change"));
        const time = find(xNodes, "time");
        if (time) {
          beats = num(find(kids(time), "beats"), beats);
          beatType = num(find(kids(time), "beat-type"), beatType);
        }
      } else if (nodeTag === "backup") {
        cursor -= num(find(kids(item), "duration")) / divisions;
      } else if (nodeTag === "forward") {
        cursor += num(find(kids(item), "duration")) / divisions;
      } else if (nodeTag === "harmony") {
        // accord d'accompagnement : fondamentale, qualité, basse éventuelle
        const xNodes = kids(item);
        const root = kids(find(xNodes, "root"));
        const kind = text(find(xNodes, "kind"));
        const suffix = HARMONY_KIND[kind];
        if (root.length && suffix !== undefined) {
          const bass = kids(find(xNodes, "bass"));
          const name =
            STEP_NAME(text(find(root, "root-step")), num(find(root, "root-alter"))) +
            suffix +
            (bass.length ? "/" + STEP_NAME(text(find(bass, "bass-step")), num(find(bass, "bass-alter"))) : "");
          const offset = find(xNodes, "offset") ? num(find(xNodes, "offset")) / divisions : 0;
          // sa grille, s'il en a une : la case de chaque corde jouée (la 1, l'aiguë) ; les autres ne se jouent pas
          const frame = kids(find(xNodes, "frame"));
          const count = num(find(frame, "frame-strings"));
          const shape: Shape = new Array(count).fill(null);
          for (const frameNote of findAll(frame, "frame-note")) {
            const string = num(find(kids(frameNote), "string")),
              fret = num(find(kids(frameNote), "fret"));
            if (string >= 1 && string <= count) shape[count - string] = fret;
          }
          const grid = count && shape.some((fret) => fret !== null) ? SHAPE_SEPARATOR + shapeText(shape) : "";
          directions.push({ staff: base, at: cursor + offset, kind: "chord", text: name + grid });
        }
      } else if (nodeTag === "direction") {
        const xNodes = kids(item);
        const at = cursor + num(find(xNodes, "offset")) / divisions;
        const staff = staffPart(num(find(xNodes, "staff"), 1));
        const words: string[] = [];
        for (const directionType of findAll(xNodes, "direction-type")) {
          for (const typeNode of kids(directionType)) {
            const typeTag = tag(typeNode);
            if (typeTag === "dynamics") {
              for (const xNode of kids(typeNode)) {
                const dynamicTag = tag(xNode);
                if (!dynamicTag || dynamicTag === "#text") continue;
                const value = dynamicTag === "other-dynamics" ? plainDynamics(text(xNode)).trim() : dynamicTag;
                if (value) directions.push({ staff, at, kind: "dynamic", text: value });
              }
            } else if (typeTag === "wedge") {
              directions.push({ staff, at, kind: "wedge", text: attr(typeNode, "type") ?? "", number: String(attr(typeNode, "number") ?? "1") });
            } else if (typeTag === "dashes" && attr(typeNode, "type") === "stop") {
              // la fin des tirets d'un « P.M. »
              directions.push({ staff, at, kind: "palmMute", text: "stop", number: String(attr(typeNode, "number") ?? "1") });
            } else if (typeTag === "pedal") {
              directions.push({ staff, at, kind: "pedal", text: attr(typeNode, "type") ?? "" });
            } else if (typeTag === "rehearsal") {
              rehearsal ??= text(typeNode).trim() || undefined;
            } else if (typeTag === "words") {
              // certains logiciels laissent des balises de mise en forme dans le texte (« <font …> »)
              const content = plainDynamics(text(typeNode))
                .replace(/<[^>]*>/g, "")
                .replace(/\s+/g, " ")
                .trim();
              // l'étouffé de la paume, avec ou sans tirets
              if (/^P\.?\s*M\.?$/i.test(content))
                directions.push({
                  staff,
                  at,
                  kind: "palmMute",
                  text: "start",
                  number: String(
                    attr(
                      findAll(xNodes, "direction-type")
                        .flatMap((child) => kids(child))
                        .find((child) => tag(child) === "dashes") ?? typeNode,
                      "number",
                    ) ?? "1",
                  ),
                });
              else if (content && !OCTAVE_WORDS.test(content)) words.push(content);
            }
          }
        }
        const st = structureOf(xNodes, words, at);
        structure.push(...st);
        // les mots d'une indication de structure (« D.S. al Coda »…) deviennent un saut, pas un texte
        if (words.length && !st.length) {
          // une nuance en tête de texte (« pp con sordina ») : la nuance, puis le texte
          const all = words.join(" ");
          const lead = all.match(/^(\S+) (.+)$/);
          if (lead && isDynamic(lead[1])) {
            directions.push({ staff, at, kind: "dynamic", text: lead[1] });
            directions.push({ staff, at, kind: "words", text: lead[2] });
          } else {
            // une nuance en toutes lettres (« sempre pianissimo ») : son signe, et le texte en entier
            const sign = dynamicInWords(all);
            if (sign && !directions.some((direction) => direction.kind === "dynamic" && direction.staff === staff && direction.at === at))
              directions.push({ staff, at, kind: "dynamic", text: sign });
            directions.push({ staff, at, kind: "words", text: all });
          }
        }
      } else if (nodeTag === "sound") {
        structure.push(...structureOf([item], [], cursor));
      } else if (nodeTag === "barline") {
        const xNodes = kids(item);
        const rep = find(xNodes, "repeat");
        if (rep && attr(rep, "direction") === "forward") {
          startRepeat = true;
          // une nouvelle reprise ferme la case restée ouverte (une 2e case sans fin écrite)
          if (endings === openEnding) endings = openEnding = undefined;
        }
        if (rep && attr(rep, "direction") === "backward") {
          endRepeat = true;
          times = Number(attr(rep, "times") ?? 2);
        }
        const ending = find(xNodes, "ending");
        if (ending) {
          const type = attr(ending, "type");
          const nums = String(attr(ending, "number") ?? "1")
            .split(/[,\s]+/)
            .filter(Boolean)
            .map(Number);
          if (type === "start") {
            openEnding = nums;
            endings = nums;
          } else if (type === "stop" || type === "discontinue") {
            endings = endings ?? nums;
            closeEndingAfter = true;
          }
        }
      } else if (nodeTag === "note") {
        const noteNodes = kids(item);
        const isChord = !!find(noteNodes, "chord");
        // une note de la partition qui double la tablature : seules ses paroles comptent
        const copy = tab !== undefined && num(find(noteNodes, "staff"), 1) !== tab;
        const staff = staffPart(num(find(noteNodes, "staff"), 1));
        const technical = findAll(noteNodes, "notations")
          .flatMap((child) => kids(child))
          .filter((child) => tag(child) === "technical")
          .flatMap((child) => kids(child));
        const stringNode = technical.find((child) => tag(child) === "string");
        const onString = tab !== undefined && stringNode ? { string: num(stringNode) } : {};
        const voice = staff + ":" + (text(find(noteNodes, "voice")) || "1");
        const pitchOf = (xNodes: XNode[]) => Math.round(12 * (num(find(xNodes, "octave")) + 1) + STEP[text(find(xNodes, "step"))] + num(find(xNodes, "alter")));
        if (find(noteNodes, "grace")) {
          // sans durée : ne fait pas avancer le temps ; attend la note principale de sa voix
          const pitch = find(noteNodes, "pitch");
          if (!pitch || copy || find(noteNodes, "cue") || attr(item, "print-object") === "no") continue;
          if (!waiting.has(voice)) waiting.set(voice, []);
          const list = waiting.get(voice)!;
          const last = list[list.length - 1];
          list.push({ staff, midi: pitchOf(kids(pitch)), slot: isChord && last ? last.slot : last ? last.slot + 1 : 0, ...onString });
          continue;
        }
        const dur = num(find(noteNodes, "duration")) / divisions;
        const on = isChord ? lastStart : cursor;
        if (!isChord && waiting.has(voice)) {
          graces.push(...waiting.get(voice)!.map((grace) => ({ ...grace, on })));
          waiting.delete(voice);
        }
        if (!isChord) {
          lastStart = cursor;
          cursor += dur;
        }
        // notes à ne pas lire : réplique en petites notes (cue), note cachée (réalisation
        // d'un arpège ou d'un ornement pour la lecture audio) ; elles occupent quand même leur temps
        const hidden = !!find(noteNodes, "cue") || attr(find(noteNodes, "type"), "size") === "cue" || attr(item, "print-object") === "no";
        // point d'orgue sur une note ou un silence : une fois par instant (pas sur chaque note d'un accord)
        if (!hidden && !copy && !isChord && findAll(noteNodes, "notations").some((child) => find(kids(child), "fermata"))) {
          directions.push({ staff, at: on, kind: "fermata", text: "" });
        }
        const pitch = find(noteNodes, "pitch");
        if (pitch && !hidden && copy) {
          lyrics.push(...lyricsOfNote(noteNodes, staff, staff + ":" + (text(find(noteNodes, "voice")) || "1"), on));
          voiceNotes.push({ staff, voice: staff + ":" + (text(find(noteNodes, "voice")) || "1"), on, off: on + dur });
        } else if (pitch && !hidden) {
          const xNodes = kids(pitch);
          const step = text(find(xNodes, "step"));
          const octave = num(find(xNodes, "octave"));
          const midi = Math.round(12 * (octave + 1) + STEP[step] + num(find(xNodes, "alter")));
          if (find(xNodes, "alter")) measureAlter.set(step + octave, num(find(xNodes, "alter")));
          const ties = findAll(noteNodes, "tie").map((tie) => attr(tie, "type"));
          const raw: RawNote = {
            staff,
            midi,
            on,
            off: on + dur,
            tieStart: ties.includes("start"),
            tieStop: ties.includes("stop"),
            ...onString,
          };
          const notations = findAll(noteNodes, "notations").flatMap((child) => kids(child));
          // voisine dans la gamme : armure, altération déjà posée dans la mesure, ou altération dessinée sur l'ornement
          const ornaments = notations.filter((child) => tag(child) === "ornaments").flatMap((child) => kids(child));
          const marks = ornaments.filter((child) => tag(child) === "accidental-mark");
          const markFor = (dir: number) => {
            const xNode =
              marks.find((child) => attr(child, "placement") === (dir > 0 ? "above" : "below")) ??
              (marks.length === 1 && !attr(marks[0], "placement") ? marks[0] : undefined);
            return xNode ? ACCIDENTAL[text(xNode)] : undefined;
          };
          const neighbor = (dir: number) => {
            if (!dir) return midi;
            const index = LETTERS.indexOf(step) + dir;
            const oct = octave + (index > 6 ? 1 : index < 0 ? -1 : 0);
            const letter = LETTERS[(index + 7) % 7];
            const alter = markFor(dir) ?? measureAlter.get(letter + oct) ?? keyAlter(fifths, letter);
            return 12 * (oct + 1) + STEP[letter] + alter;
          };
          for (const xNode of ornaments) {
            const name = tag(xNode);
            if (name === "trill-mark") raw.trill = neighbor(1);
            else if (ORNAMENT_GRACES[name]) {
              const base = Math.max(-1, ...graces.filter((rawGrace) => rawGrace.staff === staff && rawGrace.on === on).map((rawGrace) => rawGrace.slot)) + 1;
              ORNAMENT_GRACES[name].forEach((dir, index) => graces.push({ staff, midi: neighbor(dir), on, slot: base + index }));
            } else if (DELAYED_TURNS[name]) {
              if (!waiting.has(voice)) waiting.set(voice, []);
              const list = waiting.get(voice)!;
              const base = list.length ? list[list.length - 1].slot + 1 : 0;
              DELAYED_TURNS[name].forEach((dir, index) => list.push({ staff, midi: neighbor(dir), slot: base + index }));
            }
          }
          // liaisons d'expression : appariées par numéro, propre à la portée (une liaison peut
          // passer d'une voix à l'autre) ; une prolongation <tie> n'en est pas une
          for (const sl of notations.filter((child) => tag(child) === "slur")) {
            const type = String(attr(sl, "type") ?? "");
            if (type === "start" || type === "stop")
              directions.push({ staff, at: on, kind: "slur", text: type, number: String(attr(sl, "number") ?? "1") });
          }
          // les techniques des cordes : note étouffée, harmonique, bend (et son relâché), glissé ;
          // hammer-on et pull-off, deux notes liées ; vibrato, une ondulation sur les notes ; médiator
          const tech = notations.filter((child) => tag(child) === "technical").flatMap((child) => kids(child));
          const t2: NonNullable<RawNote["tech"]> = {};
          if (text(find(noteNodes, "notehead")) === "x") t2.dead = true;
          if (tech.some((child) => tag(child) === "harmonic")) t2.harmonic = true;
          for (const xNode of tech.filter((child) => tag(child) === "bend")) {
            const alter = Math.round(num(find(kids(xNode), "bend-alter")));
            if (find(kids(xNode), "release")) t2.release = t2.bend !== undefined || undefined;
            else if (alter > 0) t2.bend = midi + alter;
          }
          if (!t2.release) delete t2.release;
          // le glissé vers la note suivante : son sens se lit sur elle (settleSlides) ; vers rien ou
          // depuis rien, les articulations de MusicXML : falloff et doit, scoop et plop
          if (notations.some((child) => (tag(child) === "slide" || tag(child) === "glissando") && attr(child, "type") === "start")) t2.slide = "up";
          const arts = notations
            .filter((child) => tag(child) === "articulations")
            .flatMap((child) => kids(child))
            .map(tag);
          if (arts.includes("falloff")) t2.slideOut = "down";
          else if (arts.includes("doit")) t2.slideOut = "up";
          if (arts.includes("scoop")) t2.slideIn = "up";
          else if (arts.includes("plop")) t2.slideIn = "down";
          if (Object.keys(t2).length) raw.tech = t2;
          for (const legatoNode of tech.filter((child) => tag(child) === "hammer-on" || tag(child) === "pull-off")) {
            const type = String(attr(legatoNode, "type") ?? "");
            if (type === "start" || type === "stop")
              directions.push({ staff, at: on, kind: "legato", text: type, number: String(attr(legatoNode, "number") ?? "1") });
          }
          for (const wavyLine of ornaments.filter((child) => tag(child) === "wavy-line")) {
            const type = String(attr(wavyLine, "type") ?? "");
            if (type === "start") directions.push({ staff, at: on, kind: "vibrato", text: type, number: String(attr(wavyLine, "number") ?? "1") });
            else if (type === "stop")
              directions.push({ staff, at: on + dur, kind: "vibrato", text: type, number: String(attr(wavyLine, "number") ?? "1") });
          }
          for (const technique of tech) {
            const kind = tag(technique) === "down-bow" ? "down" : tag(technique) === "up-bow" ? "up" : undefined;
            if (kind && !articulations.some((existing) => existing.staff === staff && existing.on === on && existing.kind === kind))
              articulations.push({ staff, on, kind });
          }
          // doigté : le premier doigt (une substitution « 4-3 » sur une note tenue garde le 4)
          const fingering = notations
            .filter((child) => tag(child) === "technical")
            .flatMap((child) => kids(child))
            .find((child) => tag(child) === "fingering");
          const finger = fingering ? Number(text(fingering).match(/[1-5]/)?.[0]) : NaN;
          if (finger) raw.finger = finger;
          const arpeggiate = notations.find((child) => tag(child) === "arpeggiate");
          if (arpeggiate && !arpeggios.some((existing) => existing.staff === staff && existing.on === on)) {
            arpeggios.push({ staff, on, number: attr(arpeggiate, "number") as string | undefined, down: attr(arpeggiate, "direction") === "down" });
          }
          voiceNotes.push({ staff, voice, on, off: on + dur });
          // articulations : une par portée et instant (un accord n'en porte qu'une de chaque)
          for (const articulationNode of notations.filter((child) => tag(child) === "articulations").flatMap((child) => kids(child))) {
            const kind = ARTICULATIONS[tag(articulationNode)];
            if (kind && !articulations.some((existing) => existing.staff === staff && existing.on === on && existing.kind === kind))
              articulations.push({ staff, on, kind });
          }
          lyrics.push(...lyricsOfNote(noteNodes, staff, voice, on));
          notes.push(raw);
        }
      }
      maxCursor = Math.max(maxCursor, cursor);
    }
    // petites notes sans note principale dans la mesure : jouées juste avant la mesure suivante
    for (const list of waiting.values()) graces.push(...list.map((grace) => ({ ...grace, on: maxCursor })));
    // Prisma note ce qui sonne : la hauteur écrite d'une instrument transpositeur est décalée (armure,
    // altérations et voisines d'ornement se lisent d'abord sur la partition écrite)
    if (transpose) {
      for (const rawNote of notes) {
        rawNote.midi += transpose;
        if (rawNote.trill !== undefined) rawNote.trill += transpose;
      }
      for (const rawGrace of graces) rawGrace.midi += transpose;
    }
    if (closeEndingAfter) openEnding = undefined;
    out.push({
      number: String(attr(measure, "number") ?? out.length + 1),
      divisions,
      beats,
      beatType,
      length: maxCursor,
      implicit: attr(measure, "implicit") === "yes",
      notes,
      graces,
      arpeggios,
      articulations,
      lyrics,
      voiceNotes,
      directions,
      structure,
      startRepeat,
      endRepeat,
      times,
      endings,
      ...(rehearsal ? { rehearsal } : {}),
    });
  }
  return out;
}

/**
 * Un morceau écrit tout déroulé, dont les repères de répétition reviennent (« A », « B », « A »…) :
 * c'est ainsi que Prisma exporte un ordre de jeu. Une partie dont le repère revient avec
 * exactement les mêmes mesures n'est gardée qu'une fois, et rejouée à son tour : on retrouve
 * les sections et l'ordre. Undefined si aucun repère ne revient à l'identique.
 */
function foldRehearsals(rawMeasures: RawMeasure[]): { measures: RawMeasure[]; kept: number[] } | undefined {
  const starts = rawMeasures.flatMap((rawMeasure, index) => (index === 0 || rawMeasure.rehearsal ? [index] : []));
  const spans = starts.map((from, index) => ({ label: rawMeasures[from].rehearsal, bars: rawMeasures.slice(from, starts[index + 1] ?? rawMeasures.length) }));
  // le contenu d'une mesure, hors numéros (de mesure, de liaison, de soufflet) et barres de reprise :
  // une partie reprise une fois, et écrite à nouveau plus loin, reste la même partie
  const BARS = new Set(["number", "rehearsal", "implicit", "startRepeat", "endRepeat", "times", "endings"]);
  const content = (rawMeasure: RawMeasure) => JSON.stringify(rawMeasure, (key, value) => (BARS.has(key) ? undefined : value));
  const measures: RawMeasure[] = [];
  const kept: number[] = []; // la mesure gardée pour chaque mesure du fichier
  const first = new Map<string, { at: number; bars: string[] }>();
  let folded = false;
  for (const span of spans) {
    const bars = span.bars.map(content);
    const seen = span.label !== undefined ? first.get(span.label) : undefined;
    if (seen && seen.bars.length === bars.length && seen.bars.every((bar, index) => bar === bars[index])) {
      kept.push(...bars.map((_, index) => seen.at + index));
      folded = true;
      continue;
    }
    if (span.label !== undefined && !seen) first.set(span.label, { at: measures.length, bars });
    kept.push(...span.bars.map((_, index) => measures.length + index));
    measures.push(...span.bars);
  }
  return folded ? { measures, kept } : undefined;
}

type PlayMeasure = Pick<RawMeasure, "startRepeat" | "endRepeat" | "times" | "endings"> & { structure?: RawStructure[]; length?: number };

/**
 * Ordre de jeu des mesures, tout déroulé : reprises, cases, D.C., D.S., To Coda et Fine.
 * Comme le veut l'usage, après un D.C. ou un D.S. on ne refait pas les reprises, et l'on
 * prend directement la dernière case.
 * Un segno ou une coda se place au début de sa mesure (de la suivante s'il est écrit sur la
 * barre de fin) ; un saut à la fin de sa mesure (de la précédente s'il est écrit tout au début).
 */
export function playOrder(playMeasures: PlayMeasure[]): number[] {
  const EPS = 1e-6;
  const count = playMeasures.length;
  const items = playMeasures.flatMap((playMeasure, barIndex) => (playMeasure.structure ?? []).map((structure) => ({ ...structure, barIndex, length: playMeasure.length ?? 0 })));
  // signe coda sans <sound> : le dernier marque la coda, les précédents l'endroit d'où l'on y saute
  const signs = items.filter((sign) => sign.kind === "codaSign");
  signs.forEach((sign, index) => (sign.kind = index === signs.length - 1 ? "coda" : "tocoda"));
  const place = new Map<string, number>(); // « segno:id », « coda:id » → mesure
  const atEnd: { kind: string; id: string }[][] = playMeasures.map(() => []);
  for (const item of items) {
    if (item.kind === "segno" || item.kind === "coda") {
      const onEnd = item.at > EPS && item.at >= item.length - EPS;
      place.set(`${item.kind}:${item.id}`, Math.min(onEnd ? item.barIndex + 1 : item.barIndex, count - 1));
    } else atEnd[Math.max(item.at <= EPS ? item.barIndex - 1 : item.barIndex, 0)].push({ kind: item.kind, id: item.id });
  }
  // un identifiant inconnu désigne le seul repère de son espèce, s'il n'y en a qu'un
  const placeOf = (kind: string, id: string) => {
    if (place.has(`${kind}:${id}`)) return place.get(`${kind}:${id}`);
    const same = [...place.entries()].filter(([name]) => name.startsWith(kind + ":"));
    return same.length === 1 ? same[0][1] : undefined;
  };
  // plus grand numéro de chaque bloc de cases consécutives (pour « la dernière case »)
  const lastEnding: number[] = playMeasures.map(() => 0);
  for (let index = 0; index < count; index++) {
    if (!playMeasures[index].endings) continue;
    let innerIndex = index;
    while (innerIndex < count && playMeasures[innerIndex].endings) innerIndex++;
    const max = Math.max(...playMeasures.slice(index, innerIndex).flatMap((playMeasure) => playMeasure.endings!));
    for (let bar = index; bar < innerIndex; bar++) lastEnding[bar] = max;
    index = innerIndex - 1;
  }

  const order: number[] = [];
  let current = 0,
    repeatStart = 0,
    pass = 1,
    back = false,
    jumped = false;
  // une reprise terminée garde son dernier passage pour les cases qui la suivent
  let passDone = false;
  for (let guard = 0; current < count; guard++) {
    if (guard > 100000) throw new Error("Reprises ou renvois incohérents dans le MusicXML : impossible de dérouler le morceau.");
    const playMeasure = playMeasures[current];
    if (playMeasure.startRepeat && !back) {
      repeatStart = current;
      pass = 1;
    }
    back = false;
    if (passDone && !playMeasure.endings) {
      pass = 1;
      passDone = false;
    }
    if (playMeasure.endings && !playMeasure.endings.includes(jumped ? lastEnding[current] : pass)) {
      current++;
      continue;
    }
    order.push(current);
    const signsHere = atEnd[current];
    if (jumped && signsHere.some((sign) => sign.kind === "fine")) break;
    const toCoda = jumped ? signsHere.find((sign) => sign.kind === "tocoda") : undefined;
    const coda = toCoda && placeOf("coda", toCoda.id);
    if (coda !== undefined) {
      current = coda;
      continue;
    }
    const jump = jumped ? undefined : signsHere.find((sign) => sign.kind === "dacapo" || sign.kind === "dalsegno");
    const target = jump && (jump.kind === "dacapo" ? 0 : placeOf("segno", jump.id));
    if (target !== undefined) {
      jumped = true;
      current = target;
      continue;
    }
    if (playMeasure.endRepeat && !jumped && pass < playMeasure.times) {
      pass++;
      current = repeatStart;
      back = true;
      continue;
    }
    if (playMeasure.endRepeat) {
      repeatStart = current + 1;
      passDone = true;
    }
    current++;
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
export function sectionsOf(sequence: number[], count: number): { repeats: Repeat[]; markers: Marker[]; order: string[] } {
  const starts = new Set([0]);
  for (let index = 0; index + 1 < sequence.length; index++) {
    if (sequence[index + 1] === sequence[index] + 1) continue;
    starts.add(sequence[index + 1]);
    if (sequence[index] + 1 < count) starts.add(sequence[index] + 1);
  }
  type Section = { from: number; to: number; times: number };
  const sections: Section[] = [...starts].sort((first, second) => first - second).map((from, index, all) => ({ from, to: (all[index + 1] ?? count) - 1, times: 1 }));
  // ordre : une entrée à chaque début de section
  let order: Section[] = sequence.filter((bar) => starts.has(bar)).map((bar) => sections.find((section) => section.from === bar)!);

  // une section toujours jouée r fois de suite : reprise simple, jouée r fois
  for (const section of sections) {
    const runs: number[] = [];
    for (let index = 0; index < order.length; index++) {
      if (order[index] !== section) continue;
      let run = 1;
      while (order[index + run] === section) run++;
      runs.push(run);
      index += run - 1;
    }
    if (runs.length && runs[0] > 1 && runs.every((run) => run === runs[0])) {
      section.times = runs[0];
      order = order.filter((entry, index) => entry !== section || order[index - 1] !== section);
    }
  }
  // deux sections voisines toujours jouées l'une après l'autre : une seule section
  // chaque section garde sa propre étendue pour ses reprises : la réunion allonge la section, pas ses morceaux
  const staves = new Map<Section, Section[]>(sections.map((section) => [section, [{ ...section }]]));
  for (let merged = true; merged;) {
    merged = false;
    for (let position = 0; position + 1 < sections.length; position++) {
      const current = sections[position],
        following = sections[position + 1];
      const together = order.every((section, index) => (section === current ? order[index + 1] === following : true) && (section === following ? order[index - 1] === current : true));
      if (!together || !order.includes(current)) continue;
      current.to = following.to;
      staves.get(current)!.push(...staves.get(following)!);
      sections.splice(position + 1, 1);
      order = order.filter((section) => section !== following);
      merged = true;
      break;
    }
  }
  const repeats: Repeat[] = [];
  for (const section of sections.flatMap((entry) => staves.get(entry)!)) {
    if (section.times < 2) continue;
    const end: Repeat = { barIndex: section.to, end: true, ...(section.times !== 2 ? { times: section.times } : {}) };
    if (section.from === section.to) repeats.push({ ...end, start: true });
    else repeats.push({ barIndex: section.from, start: true }, end);
  }
  repeats.sort((first, second) => first.barIndex - second.barIndex);
  // une seule section jouée une fois : pas de section du tout
  if (sections.length === 1 && order.length === 1) return { repeats, markers: [], order: [] };
  if (sections.length > 26) throw new Error("Structure trop complexe : plus de 26 sections.");
  const letter = (section: Section) => String.fromCharCode(65 + sections.indexOf(section));
  return {
    repeats,
    markers: sections.map((section) => ({ label: letter(section), barIndex: section.from })),
    order: order.map(letter),
  };
}

/** Découpages possibles d'un temps à l'import : jusqu'à 48 cases (doubles croches, triolets de doubles croches). */
const DIVISIONS = Array.from({ length: 48 }, (_, index) => index + 1).filter((count) => TICKS_PER_BEAT % count === 0);

/**
 * Cale les instants des notes, temps par temps, sur le plus petit découpage qui garde tous
 * les instants distincts et dans l'ordre. Un septolet, impossible à écrire exactement,
 * prend ainsi 8 cases plutôt que 48 : une valeur irrégulière ne fait pas exploser la
 * largeur de son temps.
 */
function quantizer(times: number[]): (t: number) => number {
  const byBeat = new Map<number, Set<number>>();
  for (const tick of times) {
    const beat = Math.floor(tick / TICKS_PER_BEAT);
    if (!byBeat.has(beat)) byBeat.set(beat, new Set());
    byBeat.get(beat)!.add(tick - beat * TICKS_PER_BEAT);
  }
  const step = new Map<number, number>();
  const NOISE = 2; // écart d'arrondi, en ticks, toléré pour un découpage exact
  for (const [beat, set] of byBeat) {
    const offsets = [...set].sort((first, second) => first - second);
    const snap = (size: number) => offsets.map((offset) => Math.round(offset / size) * size);
    // d'abord le plus petit découpage exact ; à défaut (septolet…), le plus petit qui
    // garde tous les instants distincts et dans l'ordre, en les déplaçant de peu
    const exact = DIVISIONS.find((count) =>
      offsets.every((offset) => Math.abs(offset - Math.round(offset / (TICKS_PER_BEAT / count)) * (TICKS_PER_BEAT / count)) <= NOISE),
    );
    const readable = DIVISIONS.find((count) => {
      const snapped = snap(TICKS_PER_BEAT / count);
      return snapped.every((value, index) => Math.abs(value - offsets[index]) <= TICKS_PER_BEAT / 16 && (index === 0 || value > snapped[index - 1]));
    });
    step.set(beat, TICKS_PER_BEAT / (exact ?? readable ?? 48));
  }
  return (tick) => {
    const beat = Math.floor(tick / TICKS_PER_BEAT);
    const size = step.get(beat) ?? TICKS_PER_BEAT;
    return beat * TICKS_PER_BEAT + Math.round((tick - beat * TICKS_PER_BEAT) / size) * size;
  };
}

export function importMusicXml(xml: string, fileName?: string): Score {
  const doc = parser.parse(xml) as XNode[];
  const root = doc.find((xNode) => tag(xNode) === "score-partwise");
  if (!root) throw new Error("Seul le MusicXML « score-partwise » est pris en charge (exporte en .musicxml non compressé).");
  const rootKids = kids(root);
  const partNodes = findAll(rootKids, "part");
  if (!partNodes.length) throw new Error("Aucune partie trouvée dans le fichier MusicXML.");

  const meta: Meta = {};
  const work = find(rootKids, "work");
  const clean = (value: string) => value.replace(/\s+/g, " ").trim();
  // texte de page d'un type donné (titre, sous-titre) : ses morceaux se suivent, et un
  // suffixe d'ordinal (« 3 » puis « rd ») se colle au nombre
  const creditText = (type: string) => {
    const credit = findAll(rootKids, "credit").find((xNode) => text(find(kids(xNode), "credit-type")) === type);
    const pieces = credit
      ? findAll(kids(credit), "credit-words")
          .map((xNode) => clean(text(xNode)))
          .filter(Boolean)
      : [];
    return pieces.reduce((joined, piece) => (joined && /\d$/.test(joined) && /^(st|nd|rd|th|e|er|re|ème|eme)\b/i.test(piece) ? joined + piece : joined ? joined + " " + piece : piece), "");
  };
  const title = clean(text(find(kids(work), "work-title")) || text(find(rootKids, "movement-title"))) || creditText("title");
  if (title) meta.title = title;
  // sous-titre : le texte de page marqué comme tel, sinon le titre du mouvement s'il complète celui de l'œuvre
  const fromCredit = creditText("subtitle");
  const movement = clean(text(find(rootKids, "movement-title")));
  const subtitle = fromCredit || (movement && movement !== title ? movement : "");
  if (subtitle && subtitle !== title) meta.subtitle = subtitle;
  const ident = kids(find(rootKids, "identification"));
  const composer = findAll(ident, "creator").find((xNode) => attr(xNode, "type") === "composer");
  if (composer && text(composer)) meta.composer = text(composer);
  if (fileName) meta.source = fileName;

  // parties : une par <part>, une portée par <staff> ; nommées seulement s'il y en a plusieurs
  const scoreParts = findAll(kids(find(rootKids, "part-list")), "score-part");
  const staffNames = new Map(scoreParts.map((sp) => [String(attr(sp, "id")), clean(text(find(kids(sp), "part-name")))]));
  // l'instrument de chaque partie, d'après son programme General MIDI, quand il y en a un
  const programs = new Map(
    scoreParts.map((sp) => {
      const program = num(find(kids(find(kids(sp), "midi-instrument")), "midi-program"), 0);
      return [String(attr(sp, "id")), program ? instrumentOfProgram(program) : undefined];
    }),
  );
  const parts: Part[] = [];
  const perPart: RawMeasure[][] = [];
  for (const node of partNodes) {
    const measuresOf = findAll(kids(node), "measure");
    const staves = Math.max(
      1,
      ...measuresOf.flatMap((measure) => findAll(kids(measure), "attributes").map((xNode) => num(find(kids(xNode), "staves"), 1))),
      ...measuresOf.flatMap((measure) => findAll(kids(measure), "note").map((xNode) => num(find(kids(xNode), "staff"), 1))),
    );
    // une tablature d'un accordage connu : la partie se lit sur elle, en cordes, sur une seule portée
    const tab = tabStaffOf(measuresOf);
    const tuned = tab && tuningOf(tab.open, tab.capo);
    perPart.push(readMeasures(node, staffCount(parts), tuned ? 1 : staves, tuned ? tab!.staff : undefined));
    const id = String(attr(node, "id")),
      name = staffNames.get(id) ?? "";
    // écrit seulement s'il diffère de celui que son nom fait deviner : le fichier reste sobre
    const instrument = tuned?.instrument ?? programs.get(id);
    parts.push({
      name,
      staves: tuned ? 1 : staves,
      ...(instrument && instrument !== guessInstrument(name) ? { instrument } : {}),
      ...(tuned ? { strings: tuned.strings } : {}),
    });
  }
  if (parts.length > 1) {
    // noms uniques, sans virgule (elle sépare les noms dans « parts »)
    parts.forEach((part, index) => {
      const base = (part.name ?? "").replace(/,/g, " ").replace(/\s+/g, " ").trim() || `Partie ${index + 1}`;
      let name = base;
      for (let suffix = 2; parts.slice(0, index).some((other) => other.name === name); suffix++) name = `${base} ${suffix}`;
      part.name = name;
    });
  } else if ((parts[0].instrument ?? guessInstrument(parts[0].name)) !== "piano") {
    // une seule partie : nommée seulement pour porter son instrument, quand ce n'est pas le piano
    parts[0].name = (parts[0].name ?? "").replace(/,/g, " ").replace(/\s+/g, " ").trim() || "Partie 1";
  } else {
    delete parts[0].name;
    delete parts[0].instrument;
  }
  // mesures : la première portée donne la métrique, les reprises et la structure ; les autres y ajoutent leur contenu
  const measures = perPart[0];
  for (const other of perPart.slice(1)) {
    other.forEach((rawMeasure, index) => {
      const into = measures[index];
      if (!into) return;
      into.notes.push(...rawMeasure.notes);
      into.graces.push(...rawMeasure.graces);
      into.arpeggios.push(...rawMeasure.arpeggios);
      into.lyrics.push(...rawMeasure.lyrics);
      into.articulations.push(...rawMeasure.articulations);
      into.voiceNotes.push(...rawMeasure.voiceNotes);
      // accords et points d'orgue : une seule fois, déjà donnés par la première portée
      into.directions.push(...rawMeasure.directions.filter((rawDirection) => rawDirection.kind !== "chord" || !into.directions.some((existing) => existing.kind === "chord")));
      into.length = Math.max(into.length, rawMeasure.length);
    });
  }
  // l'ordre de jeu : celui des reprises et renvois, puis des repères qui reviennent
  let sequence = playOrder(measures);
  const folded = foldRehearsals(measures);
  if (folded) {
    measures.splice(0, measures.length, ...folded.measures);
    sequence = sequence.map((index) => folded.kept[index]);
  }
  const lastStaff = (staff: Staff) => {
    let end = 0;
    for (const part of parts) {
      end += part.staves;
      if (staff < end) return end - 1;
    }
    return staff;
  };
  // tempo de départ : <sound tempo> (en noires par minute) au début, converti en temps de la règle ;
  // après une anacrouse, il est souvent écrit sur la première mesure entière
  const head = measures[0] && pulse(measures[0].beats, measures[0].beatType);
  const pickup = !!head && measures[0].length > 1e-6 && measures[0].length < head.count * head.quarters - 1e-6;
  const startTempo = findAll(kids(partNodes[0]), "measure")
    .slice(0, pickup ? 2 : 1)
    .flatMap((xNode) => kids(xNode).flatMap((child) => (tag(child) === "sound" ? [child] : tag(child) === "direction" ? findAll(kids(child), "sound") : [])))
    .map((snd) => Number(attr(snd, "tempo")))
    .find((tempo) => tempo > 0);
  if (startTempo && measures.length) meta.bpm = Math.round(startTempo / pulse(measures[0].beats, measures[0].beatType).quarters);
  // tonalité : l'armure de la première partie au début, ramenée à la hauteur qui sonne pour un
  // instrument transpositeur. Elle donne deux tonalités (do majeur ou la mineur…) : les notes du
  // morceau choisissent, une fois lues (le <mode> du fichier est trop souvent laissé à « major »)
  const firstAttributes = findAll(kids(partNodes[0]), "measure")
    .slice(0, 1)
    .flatMap((xNode) => findAll(kids(xNode), "attributes").map(kids));
  const keyNode = firstAttributes.map((xNodes) => find(xNodes, "key")).find((xNode) => xNode && find(kids(xNode), "fifths"));
  const tr = firstAttributes.map((xNodes) => find(xNodes, "transpose")).find(Boolean);
  const shift = tr ? num(find(kids(tr), "chromatic")) : 0;
  const signature = keyNode ? keysOfSignature(num(find(kids(keyNode), "fifths")) + 7 * shift) : undefined;
  const beats: Beat[] = [];
  const raw: (Note & { tieStart: boolean; tieStop: boolean })[] = [];
  const rawGraces: Grace[] = [];
  const rawArpeggios: (RawArpeggio & { t: number })[] = [];
  const rawDirections: (RawDirection & { t: number })[] = [];
  const rawLyrics: (RawLyric & { t: number })[] = [];
  const rawArticulations: (RawArticulation & { t: number })[] = [];
  const rawVoiceNotes: (RawVoiceNote & { start: number; end: number })[] = [];
  const EPS = 1e-6;

  // Mesures numérotées comme dans le fichier : à partir du numéro de la première mesure,
  // ou 0 pour une anacrouse exclue du décompte (implicit="yes"), puis à la suite.
  const first = measures[0];
  const firstNumber = Number(first?.number);
  const uncounted = !!first?.implicit;
  let barNumber = uncounted || !Number.isInteger(firstNumber) ? 0 : firstNumber - 1;
  measures.forEach((rawMeasure, barIndex) => {
    const meter = pulse(rawMeasure.beats, rawMeasure.beatType);
    const nominal = meter.count * meter.quarters;
    const length = rawMeasure.length > EPS ? Math.min(rawMeasure.length, nominal) : nominal;
    const incomplete = length < nominal - EPS;
    const present = incomplete ? Math.ceil(length / meter.quarters - EPS) : meter.count;
    // Anacrouse : seule la toute première mesure incomplète est alignée sur la fin.
    const pickup = incomplete && (barIndex === 0 || rawMeasure.implicit);
    const firstLabel = pickup ? meter.count - present + 1 : 1;
    const firstBeat = beats.length;
    const bar = barIndex === 0 && uncounted ? "0" : String(++barNumber);
    for (let index = 0; index < present; index++) {
      beats.push({ bar, barIndex, label: firstLabel + index, division: meter.division });
    }
    // position (en noires) du premier temps affiché dans la mesure virtuelle complète
    const shift = pickup ? nominal - length - (firstLabel - 1) * meter.quarters : 0;
    const ticksPerQuarter = TICKS_PER_BEAT / meter.quarters;
    const base = firstBeat * TICKS_PER_BEAT;
    for (const rawDirection of rawMeasure.directions) rawDirections.push({ ...rawDirection, t: base + Math.round((rawDirection.at + shift) * ticksPerQuarter) });
    for (const arpeggio of rawMeasure.arpeggios) rawArpeggios.push({ ...arpeggio, t: base + Math.round((arpeggio.on + shift) * ticksPerQuarter) });
    const tick = (on: number) => base + Math.round((on + shift) * ticksPerQuarter);
    for (const rawLyric of rawMeasure.lyrics) rawLyrics.push({ ...rawLyric, t: tick(rawLyric.on) });
    for (const articulation of rawMeasure.articulations) rawArticulations.push({ ...articulation, t: tick(articulation.on) });
    for (const rawVoiceNote of rawMeasure.voiceNotes) rawVoiceNotes.push({ ...rawVoiceNote, start: tick(rawVoiceNote.on), end: tick(rawVoiceNote.off) });
    for (const rawGrace of rawMeasure.graces)
      rawGraces.push({
        staff: rawGrace.staff,
        midi: rawGrace.midi,
        t: base + Math.round((rawGrace.on + shift) * ticksPerQuarter),
        slot: rawGrace.slot,
        ...(rawGrace.string !== undefined ? { string: rawGrace.string } : {}),
      });
    for (const rawNote of rawMeasure.notes) {
      raw.push({
        staff: rawNote.staff,
        midi: rawNote.midi,
        start: base + Math.round((rawNote.on + shift) * ticksPerQuarter),
        end: base + Math.round((rawNote.off + shift) * ticksPerQuarter),
        tieStart: rawNote.tieStart,
        tieStop: rawNote.tieStop,
        ...(rawNote.trill !== undefined ? { trill: rawNote.trill } : {}),
        ...(rawNote.finger ? { finger: rawNote.finger } : {}),
        ...(rawNote.string !== undefined ? { string: rawNote.string } : {}),
        ...(rawNote.tech ?? {}),
      });
    }
  });

  // instants calés sur un découpage lisible de chaque temps
  const quantize = quantizer(raw.flatMap((note) => [note.start, note.end]));
  for (const note of raw) {
    const start = quantize(note.start),
      end = quantize(note.end);
    // une note écrasée par le calage (rare : à cheval sur une fin de temps) garde une durée
    note.start = start;
    note.end = Math.max(end, start + TICKS_PER_BEAT / 48);
  }
  // fusion des liaisons de tenue
  raw.sort((first, second) => first.start - second.start || second.midi - first.midi);
  const merged: typeof raw = [];
  for (const note of raw) {
    if (note.tieStop) {
      const prev = merged.find((candidate) => candidate.staff === note.staff && candidate.midi === note.midi && candidate.string === note.string && candidate.end === note.start && candidate.tieStart);
      if (prev) {
        prev.end = note.end;
        prev.tieStart = note.tieStart;
        continue;
      }
    }
    merged.push({ ...note });
  }
  // deux notes identiques superposées dans la même portée (voix différentes) : on n'en garde qu'une
  const notes: Note[] = [];
  for (const current of merged) {
    const duplicate = notes.find((note) => note.staff === current.staff && note.midi === current.midi && note.string === current.string && note.start < current.end && current.start < note.end);
    if (duplicate) {
      duplicate.start = Math.min(duplicate.start, current.start);
      duplicate.end = Math.max(duplicate.end, current.end);
      if (current.trill !== undefined) duplicate.trill = current.trill;
      if (current.finger && !duplicate.finger) duplicate.finger = current.finger;
      continue;
    }
    notes.push({
      staff: current.staff,
      midi: current.midi,
      start: current.start,
      end: current.end,
      ...(current.trill !== undefined ? { trill: current.trill } : {}),
      ...(current.finger ? { finger: current.finger } : {}),
      ...(current.string !== undefined ? { string: current.string } : {}),
      ...(current.dead ? { dead: true } : {}),
      ...(current.harmonic ? { harmonic: true } : {}),
      ...(current.slide ? { slide: current.slide } : {}),
      ...(current.slideOut ? { slideOut: current.slideOut } : {}),
      ...(current.slideIn ? { slideIn: current.slideIn } : {}),
      ...(current.bend !== undefined ? { bend: current.bend, ...(current.release ? { release: true } : {}) } : {}),
    });
  }
  const sorted = sortNotes(notes);
  // petites notes : calées comme les notes, une seule par portée, instant, rang et hauteur
  const graces: Grace[] = [];
  const end = beats.length * TICKS_PER_BEAT;
  for (const grace of rawGraces) {
    const tick = quantize(grace.t);
    if (tick >= end) continue;
    if (!graces.some((existing) => existing.staff === grace.staff && existing.t === tick && existing.slot === grace.slot && existing.midi === grace.midi)) graces.push({ ...grace, t: tick });
  }
  // arpèges : un même numéro sur plusieurs portées au même instant les égrène d'un seul geste
  const arpeggios: Arpeggio[] = [];
  for (const arpeggio of rawArpeggios) {
    const tick = quantize(arpeggio.t);
    if (tick >= end || arpeggios.some((existing) => existing.t === tick && (existing.staff === undefined || existing.staff === arpeggio.staff))) continue;
    // un arpège qui traverse les portées n'en fait qu'un, sauf s'il y a plusieurs parties : un par portée
    const other =
      parts.length === 1 &&
      arpeggio.number !== undefined &&
      rawArpeggios.find((candidate) => candidate.staff !== arpeggio.staff && quantize(candidate.t) === tick && candidate.number === arpeggio.number);
    const down = arpeggio.down ? { down: true } : {};
    if (other) {
      for (let index = arpeggios.length - 1; index >= 0; index--) if (arpeggios[index].t === tick) arpeggios.splice(index, 1);
      arpeggios.push({ t: tick, ...down });
    } else arpeggios.push({ t: tick, staff: arpeggio.staff, ...down });
  }
  arpeggios.sort((first, second) => first.t - second.t || (first.staff ?? -1) - (second.staff ?? -1));
  const articulations: Articulation[] = [];
  for (const articulation of rawArticulations) {
    const tick = quantize(articulation.t);
    if (tick < end && !articulations.some((existing) => existing.staff === articulation.staff && existing.t === tick && existing.kind === articulation.kind))
      articulations.push({ staff: articulation.staff, t: tick, kind: articulation.kind });
  }
  // une partie de guitare ou de basse s'écrit en cordes : chaque note sur une corde
  const played = stringParts(parts, sorted, graces);
  // une petite note sans corde dans une partie à cordes n'a pas de ligne où s'écrire
  const kept = graces.filter((grace) => grace.string !== undefined || !stringsOfStaff(parts, grace.staff));
  const score: Score = {
    meta,
    parts,
    beats,
    notes: played,
    graces: sortGraces(kept),
    arpeggios,
    articulations: sortArticulations(articulations),
    lyrics: lyricsOf(rawLyrics, rawVoiceNotes, quantize, end),
    ...directionsOf(rawDirections, played, beats.length, lastStaff),
    ...sectionsOf(sequence, measures.length),
  };
  // l'étouffé et le vibrato sont des cordes : ailleurs, une ondulation est la fin d'une trille
  score.effects = score.effects.filter((effect) => stringsOfStaff(parts, effect.staff));
  // le sens de l'archet d'un violon, d'un violoncelle : Prisma ne le note que pour le médiator
  score.articulations = score.articulations.filter((articulation) => !isPick(articulation.kind) || stringsOfStaff(parts, articulation.staff));
  // une grille qui ne va pas avec la guitare du morceau (une autre, ou un autre capo) : l'accord la perd
  const strings = gridStrings(parts.map((part) => part.strings));
  score.chords = score.chords.map((textMark) => {
    const { chord, shape } = splitShape(textMark.text);
    const frets = shape === undefined ? undefined : parseShape(shape);
    const notes = new Set((chordNotes(textMark.text) ?? []).map((note) => (note - 1) % 12));
    const fits = frets && frets.length === strings.open.length && shapePitches(frets, strings).every((pitch) => notes.has(pitch));
    return shape === undefined || fits ? textMark : { ...textMark, text: chord };
  });
  const key = signature && guessKey(score, signature);
  if (key) meta.key = prismaKey(key);
  return score;
}

/**
 * Nuances, soufflets et textes. Chaque indication est calée sur l'attaque ou le début de
 * temps le plus proche, pour ne jamais imposer de découpage plus fin que les notes.
 */
function directionsOf(rawDirections: (RawDirection & { t: number })[], notes: Note[], beatCount: number, lastStaff: (p: Staff) => Staff) {
  const end = beatCount * TICKS_PER_BEAT;
  const grid = [...new Set([...notes.map((note) => note.start), ...Array.from({ length: beatCount + 1 }, (_, index) => index * TICKS_PER_BEAT)])].sort(
    (first, second) => first - second,
  );
  const snap = (tick: number) => grid.reduce((best, candidate) => (Math.abs(candidate - tick) < Math.abs(best - tick) ? candidate : best), grid[0]);
  const texts: TextMark[] = [];
  const expressions: Expression[] = [];
  const hairpins: Hairpin[] = [];
  const open: (Hairpin & { number: string })[] = [];
  const slurs: Slur[] = [];
  const openSlurs: (Slur & { number: string })[] = [];
  // pédale : une par partie, sous sa dernière portée, quelle que soit la portée qui la porte
  const pedals: Pedal[] = [];
  const down = new Map<Staff, Pedal>();
  const pedalUp = (staff: Staff, tick: number) => {
    const pedal = down.get(staff);
    if (pedal && tick > pedal.start) {
      pedal.end = tick;
      pedals.push(pedal);
    }
    down.delete(staff);
  };
  const fermatas: number[] = [];
  const chords: TextMark[] = [];
  const pedalTexts: PedalText[] = [];
  const legato: Slur[] = [];
  const openLegato: (Slur & { number: string })[] = [];
  const effects: Effect[] = [];
  const openEffects: (Effect & { number: string })[] = [];
  const seen = new Set<string>();
  // à un même instant, une liaison se referme avant qu'une autre ne commence sur la même note
  const rank = (rawDirection: RawDirection) => (rawDirection.kind === "slur" && rawDirection.text === "start" ? 1 : 0);
  for (const direction of [...rawDirections].sort((first, second) => first.t - second.t || rank(first) - rank(second))) {
    const tick = Math.min(snap(direction.t), end);
    if (direction.kind === "legato") {
      if (direction.text === "start") {
        if (tick < end) openLegato.push({ staff: direction.staff, start: tick, end: -1, number: direction.number! });
      } else {
        const index = openLegato.findIndex((candidate) => candidate.number === direction.number && candidate.staff === direction.staff);
        if (index >= 0) {
          const [slur] = openLegato.splice(index, 1);
          if (tick > slur.start) legato.push({ staff: slur.staff, start: slur.start, end: tick });
        }
      }
      continue;
    }
    if (direction.kind === "palmMute" || direction.kind === "vibrato") {
      if (direction.text === "start") {
        if (tick < end) openEffects.push({ staff: direction.staff, kind: direction.kind, start: tick, end, number: direction.number! });
      } else {
        const index = openEffects.findIndex((candidate) => candidate.kind === direction.kind && candidate.number === direction.number && candidate.staff === direction.staff);
        if (index >= 0) {
          const [effect] = openEffects.splice(index, 1);
          if (tick > effect.start) effects.push({ staff: effect.staff, kind: effect.kind, start: effect.start, end: tick });
        }
      }
      continue;
    }
    if (direction.kind === "slur") {
      if (direction.text === "start") {
        if (tick < end) openSlurs.push({ staff: direction.staff, start: tick, end: -1, number: direction.number! });
      } else {
        const index = openSlurs.findIndex((candidate) => candidate.number === direction.number);
        if (index < 0) continue;
        const [slur] = openSlurs.splice(index, 1);
        if (tick > slur.start && !slurs.some((existing) => existing.staff === slur.staff && existing.start === slur.start && existing.end === tick))
          slurs.push({ staff: slur.staff, start: slur.start, end: tick });
      }
      continue;
    }
    // un accord peut aussi être écrit en simple texte (« A7 » au-dessus de la portée) : tout le texte doit être un nom d'accord
    if (direction.kind === "chord" || (direction.kind === "words" && chordNameNotes(direction.text.trim()))) {
      // écrit par son nom Prisma, l'écriture privilégiée
      const { chord, shape } = splitShape(direction.text.trim());
      if (tick < end && !chords.some((textMark) => textMark.t === tick))
        chords.push({ t: tick, text: (prismaNameOf(chord) ?? chord) + (shape ? SHAPE_SEPARATOR + shape : "") });
      continue;
    }
    if (direction.kind === "fermata") {
      if (tick < end && !fermatas.includes(tick)) fermatas.push(tick);
      continue;
    }
    if (direction.kind === "pedal") {
      // start et resume enfoncent, stop et discontinue relâchent, change fait les deux
      const staff = lastStaff(direction.staff);
      if (direction.text === "stop" || direction.text === "discontinue" || direction.text === "change") pedalUp(staff, tick);
      if (direction.text === "start" || direction.text === "resume" || direction.text === "change") {
        if (down.has(staff)) pedalUp(staff, tick); // déjà enfoncée : on la change
        if (tick < end) down.set(staff, { staff, start: tick, end });
      }
      continue;
    }
    if (direction.kind === "wedge") {
      if (direction.text === "crescendo" || direction.text === "diminuendo") {
        open.push({ staff: direction.staff, kind: direction.text === "crescendo" ? "<" : ">", start: Math.min(tick, end - 1), end, number: direction.number! });
      } else if (direction.text === "stop") {
        const index = open.findIndex((candidate) => candidate.number === direction.number && candidate.staff === direction.staff);
        const found = index >= 0 ? index : open.findIndex((candidate) => candidate.number === direction.number);
        if (found < 0) continue;
        const [wedge] = open.splice(found, 1);
        if (tick > wedge.start) hairpins.push({ staff: wedge.staff, kind: wedge.kind, start: wedge.start, end: tick });
      }
      continue;
    }
    if (tick >= end) continue;
    // une même indication répétée n'est gardée qu'une fois par portée
    const key = `${direction.staff}|${tick}|${direction.text}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (direction.kind === "words" && SYSTEM_WORDS.test(direction.text)) {
      if (!texts.some((existing) => existing.t === tick && existing.text === direction.text)) texts.push({ t: tick, text: direction.text });
    } else if (direction.kind === "words" && isPedalText(direction.text)) {
      // consigne de pédale : sur la ligne de pédale, quelle que soit la portée qui la porte
      const staff = lastStaff(direction.staff);
      if (!pedalTexts.some((existing) => existing.staff === staff && existing.t === tick && existing.text === direction.text)) pedalTexts.push({ staff, t: tick, text: direction.text });
    } else {
      const prev = expressions[expressions.length - 1];
      // parenthèses écrites à part autour d'une nuance (« ( », « mp », « ) ») : une seule nuance « (mp) »
      if (direction.kind === "dynamic" && prev && prev.staff === direction.staff && prev.t === tick && (prev.text.endsWith("(") || direction.text === ")")) {
        prev.text += direction.text;
        prev.kind = isDynamic(prev.text) ? "dynamic" : "text";
      } else {
        expressions.push({ staff: direction.staff, t: tick, text: direction.text, kind: direction.kind === "dynamic" && isDynamic(direction.text) ? "dynamic" : "text" });
      }
    }
  }
  // soufflet jamais refermé : jusqu'à la fin du morceau
  for (const wedge of open) hairpins.push({ staff: wedge.staff, kind: wedge.kind, start: wedge.start, end: wedge.end });
  hairpins.sort((first, second) => first.start - second.start);
  for (const staff of [...down.keys()]) pedalUp(staff, end);
  pedals.sort((first, second) => first.start - second.start || first.staff - second.staff);
  // un hammer-on ou un pull-off est une liaison entre deux notes d'une corde, sauf si une liaison les couvre déjà
  for (const slur of legato) if (!slurs.some((other) => other.staff === slur.staff && other.start <= slur.start && slur.end <= other.end)) slurs.push(slur);
  slurs.sort((first, second) => first.start - second.start || first.staff - second.staff || first.end - second.end);
  // un étouffé ou un vibrato jamais refermé : jusqu'à la fin du morceau
  for (const effect of openEffects) effects.push({ staff: effect.staff, kind: effect.kind, start: effect.start, end: effect.end });
  effects.sort((first, second) => first.start - second.start || first.staff - second.staff);
  return { texts, expressions, hairpins, effects, slurs, pedals, pedalTexts, fermatas, chords: chords.sort((first, second) => first.t - second.t) };
}
