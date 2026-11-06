/**
 * Ce que montre le curseur dans un texte .prisma : sa place dans la musique (section, mesure, temps,
 * case, portée, octave) et le sens du signe qu'il pointe (une note, une nuance, une clé de
 * l'en-tête…), pour la barre de statut de l'éditeur. La lecture est indulgente : un texte en
 * cours d'écriture, même faux, se décrit au mieux.
 */
import { chordName, chordNotes, chordPrismaName, chordPrismaText, chordWriting } from "./chords.ts";
import { splitShape } from "./shapes.ts";
import {
  ARPEGGIO_DOWN,
  FERMATA,
  HARMONICS,
  effectOf,
  stringCell,
  FINGER_MARK,
  GRACE_MARK,
  MARKER_SIGN,
  PEDAL_CHANGE,
  PEDAL_DOWN,
  PEDAL_UP,
  TRILL_MARK,
  isDynamic,
  isExtender,
  isHairpin,
  isPedalText,
  isSlur,
  trillAux,
} from "./model.ts";
import type { Direction } from "./model.ts";
import { midiOf, numberOf, octaveOf, parseOctaveLabel } from "./pitch.ts";
import { MAX_FRET, soundingOf } from "./strings.ts";
import type { Strings } from "./strings.ts";
import { keyName, parseKey } from "./key.ts";
import { splitPartEntry, splitParts } from "./instruments.ts";
import { CHORD_LINE, isRuler, markTokens, parseRule, partExtras } from "./prisma-parse.ts";

/** Noms des notes : do ré mi (do central = do3), anglais (C4), ou aucun (le numéro Prisma suffit). */
export type NoteNames = "latin" | "english" | "none";

export type Inspection = {
  /** Ligne et colonne du curseur, à partir de 1. */
  line: number;
  column: number;
  section?: string;
  bar?: string;
  beat?: number;
  /** Case du temps sous le curseur : son rang et le nombre de cases du temps. */
  cell?: { index: number; count: number };
  /** Portée de la ligne, dans l'ordre du système, et les parties du système (pour la nommer). */
  staff?: number;
  parts?: { name?: string; staves: number }[];
  /** Octave de la ligne de notes (scientifique : celle du do central vaut 4). */
  octave?: number;
  /** Instrument à cordes : la corde de la ligne de notes. */
  string?: number;
  /**
   * Le signe sous le curseur et son sens ; pour une note ou un accord, ses numéros (1 à 12), à
   * montrer sur un clavier, avec la voisine de trille et les petites notes d'une note.
   */
  symbol?: { text: string; meaning: string; keys?: number[]; trill?: number; graces?: number[] };
};

const LATIN = ["do", "do♯", "ré", "ré♯", "mi", "fa", "fa♯", "sol", "sol♯", "la", "la♯", "si"];
const ENGLISH = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const FLAT_LATIN: Record<number, string> = { 1: "ré♭", 3: "mi♭", 6: "sol♭", 8: "la♭", 10: "si♭" };
const FLAT_ENGLISH: Record<number, string> = { 1: "D♭", 3: "E♭", 6: "G♭", 8: "A♭", 10: "B♭" };

/** Nom d'une hauteur : « do♯3 (ré♭3) », ou « C♯4 (D♭4) » en notation anglaise. */
export function noteName(midi: number, names: NoteNames): string {
  if (names === "none") return "";
  const pc = midi % 12;
  const oct = names === "latin" ? octaveOf(midi) - 1 : octaveOf(midi);
  const flat = (names === "latin" ? FLAT_LATIN : FLAT_ENGLISH)[pc];
  const main = (names === "latin" ? LATIN : ENGLISH)[pc] + oct;
  return flat ? `${main} (${flat}${oct})` : main;
}
/** Nom d'une classe de hauteur, sans octave : « mi », « F♯ ». */
export const pitchClass = (number: number, names: NoteNames) =>
  names === "none" ? String(number) : (names === "latin" ? LATIN : ENGLISH)[(number - 1) % 12];

const FINGERS = ["", "pouce", "index", "majeur", "annulaire", "auriculaire"];

export const FRONTMATTER: Record<string, string> = {
  format: "version du format Prisma du fichier",
  title: "titre du morceau",
  subtitle: "sous-titre, gravé sous le titre",
  composer: "compositeur",
  source: "source du morceau",
  notes: "notes sur le morceau, pour soi ou pour qui le reçoit : gardées dans le fichier, jamais imprimées",
  bpm: "tempo de départ, en temps par minute",
  key: "tonalité du morceau, pour information : sa tonique de 1 à 12, suivie de « :m » si elle est mineure (« 8 », « 5:m »), ou son nom anglais (« G », « Em »)",
  parts:
    "noms des parties, de haut en bas, et entre parenthèses l'instrument qui joue chacune à l'écoute (sinon son nom le fait deviner) ; pour une guitare ou une basse, aussi son accordage et son capo",
  order: "ordre de jeu des sections",
  cell: "largeur de base d'une case, en caractères, à l'écriture",
  division: "découpage par défaut d'un temps : 2 (binaire) ou 3 (ternaire)",
};

const DYNAMICS: Record<string, string> = {
  ppp: "pianississimo : le plus doux",
  pp: "pianissimo : très doux",
  p: "piano : doux",
  mp: "mezzo piano : moyennement doux",
  mf: "mezzo forte : moyennement fort",
  f: "forte : fort",
  ff: "fortissimo : très fort",
  fff: "fortississimo : le plus fort",
  sf: "sforzando : l'attaque soudain plus forte",
  sfz: "sforzando : l'attaque soudain plus forte",
  fz: "forzando : l'attaque soudain plus forte",
  rfz: "rinforzando : l'attaque renforcée",
  fp: "forte piano : attaque forte, puis aussitôt doux",
  sfp: "sforzando piano : attaque très forte, puis aussitôt doux",
};

/** Termes usuels des indications en mots. */
const TERMS: [RegExp, string][] = [
  [/^(rit|ritard|ritardando)\.?$/i, "ritardando : en ralentissant"],
  [/^(rall|rallentando)\.?$/i, "rallentando : en ralentissant"],
  [/^(accel|accelerando)\.?$/i, "accelerando : en accélérant"],
  [/^a tempo$/i, "a tempo : reprendre le tempo"],
  [/^tempo i(mo)?$/i, "tempo primo : reprendre le tempo du début"],
  [/^rubato$/i, "rubato : avec souplesse dans le tempo"],
  [/^(cresc|crescendo)\.?$/i, "crescendo : de plus en plus fort"],
  [/^(dim|diminuendo|decresc|decrescendo)\.?$/i, "diminuendo : de moins en moins fort"],
  [/^dolce$/i, "dolce : doux, tendre"],
  [/^legato$/i, "legato : lié"],
  [/^(espr|espressivo)\.?$/i, "espressivo : expressif"],
  [/^cantabile$/i, "cantabile : chantant"],
  [/^sostenuto$/i, "sostenuto : soutenu"],
  [/^(largo|lento)$/i, "très lent"],
  [/^adagio$/i, "adagio : lent"],
  [/^andante$/i, "andante : allant, modéré"],
  [/^andantino$/i, "andantino : un peu plus allant qu'andante"],
  [/^moderato$/i, "moderato : modéré"],
  [/^allegretto$/i, "allegretto : assez vif"],
  [/^allegro$/i, "allegro : vif"],
  [/^vivace$/i, "vivace : vif, animé"],
  [/^presto$/i, "presto : très vif"],
];
const term = (text: string) => TERMS.find(([re]) => re.test(text))?.[1];

/** Un morceau de règle : les barres et, entre deux, les cases d'un temps. */
type Cell = { start: number; end: number; label: string; index: number; count: number };
type Beat = { from: number; to: number; bar: string; beat?: number; cells: Cell[] };
type Sep = { from: number; to: number; text: string };

const nextBar = (bar: string) => (/^\d+$/.test(bar) ? String(Number(bar) + 1) : bar + "'");

/** Règle de comptage, lue sans erreur : ses barres et ses temps, mesure par mesure. */
function readRuler(ruler: string) {
  const pipe = ruler.indexOf("|");
  const seps: Sep[] = [];
  for (let index = pipe; index >= 0 && index < ruler.length;) {
    if (ruler[index] === "|" || (ruler[index] === ":" && ruler[index + 1] === "|")) {
      let innerIndex = index;
      while (innerIndex < ruler.length && (ruler[innerIndex] === "|" || ruler[innerIndex] === ":")) innerIndex++;
      seps.push({ from: index, to: innerIndex, text: ruler.slice(index, innerIndex) });
      index = innerIndex;
    } else index++;
  }
  let bar = ruler.slice(1, pipe).trim() || "?";
  const beats: Beat[] = [];
  for (let separatorIndex = 0; separatorIndex + 1 < seps.length; separatorIndex++) {
    const from = seps[separatorIndex].to,
      to = seps[separatorIndex + 1].from;
    const labels = [...ruler.slice(from, to).matchAll(/\S+/g)];
    const cells = labels.map((match, index) => ({
      start: from + match.index!,
      end: index + 1 < labels.length ? from + labels[index + 1].index! : to,
      label: match[0],
      index: index + 1,
      count: labels.length,
    }));
    if (cells.length) cells[0].start = from;
    const firstLabel = Number(labels[0]?.[0]);
    beats.push({ from, to, bar, beat: Number.isInteger(firstLabel) && firstLabel > 0 ? firstLabel : undefined, cells });
    if (seps[separatorIndex + 1].text !== "|") bar = nextBar(bar);
  }
  return { pipe, seps, beats };
}

/** La mesure, le temps et la case d'une colonne, d'après la règle du système. */
function placeOf(ruler: ReturnType<typeof readRuler>, col: number) {
  const beat = ruler.beats.find((candidate) => col >= candidate.from && col < candidate.to);
  if (!beat) return undefined;
  const cell = [...beat.cells].reverse().find((candidate) => candidate.start <= col) ?? beat.cells[0];
  return { beat, cell };
}

/** Le texte sous la colonne col d'une ligne @ : une indication entière (« a tempo », « <---- »). */
function markAt(line: string, col: number) {
  return markTokens(line).find((token) => col >= token.col && col < token.col + token.text.length);
}

const isRule = (line: string) => {
  try {
    return parseRule(line, 0);
  } catch {
    return { double: true };
  }
};

export function inspect(text: string, offset: number, names: NoteNames = "latin"): Inspection {
  const lines = text.split("\n");
  const before = text.slice(0, offset).split("\n");
  const cursorLine = before.length - 1;
  const cursorColumn = before[before.length - 1].length;
  const out: Inspection = { line: cursorLine + 1, column: cursorColumn + 1 };
  const line = lines[cursorLine] ?? "";
  const symbol = (sign: string, meaning: string, keys?: Pick<NonNullable<Inspection["symbol"]>, "keys" | "trill" | "graces">) =>
    (out.symbol = { text: sign, meaning, ...keys });
  // le nom d'une note, ou, sans noms, son numéro
  const named = (midi: number) => noteName(midi, names) || String((midi % 12) + 1);

  // l'en-tête
  let index = 0;
  while (index < lines.length && !lines[index].trim()) index++;
  let body = 0;
  const meta: Record<string, string> = {};
  if (lines[index]?.trim() === "---") {
    const close = lines.findIndex((candidate, headerIndex) => headerIndex > index && candidate.trim() === "---");
    const end = close < 0 ? lines.length : close;
    for (let headerIndex = index + 1; headerIndex < end; headerIndex++) {
      const match = lines[headerIndex].match(/^\s*([\wÀ-ÿ-]+)\s*:\s*(.*)$/);
      if (match) meta[match[1]] = match[2].trim().replace(/^(["'])(.*)\1$/, "$2");
    }
    body = end + 1;
    if (cursorLine === index || cursorLine === close) {
      symbol("---", "délimite l'en-tête du morceau");
      return out;
    }
    if (cursorLine > index && cursorLine < end) {
      const match = line.match(/^\s*([\wÀ-ÿ-]+)\s*:\s*(.*)$/);
      if (match) symbol(match[1], keyMeaning(match[1], match[2].trim()));
      return out;
    }
  }
  if (line.startsWith("#")) {
    symbol("#", "commentaire : ignoré à la lecture");
    return out;
  }
  if (cursorLine < body || !line.trim()) return out;

  // le système du curseur : les lignes non vides autour de lui
  let top = cursorLine,
    bottom = cursorLine;
  while (top > body && lines[top - 1].trim()) top--;
  while (bottom + 1 < lines.length && lines[bottom + 1].trim()) bottom++;
  const block = lines.slice(top, bottom + 1);
  const at = cursorLine - top;
  const rulerAt = block.findIndex((blockLine) => isRuler(blockLine));

  // la section : la dernière lettre posée jusqu'à ce système
  for (let lineIndex = body; lineIndex <= bottom; lineIndex++) {
    const lineText = lines[lineIndex];
    if (!lineText.startsWith("@") || lineText.startsWith(CHORD_LINE)) continue;
    // seules les lignes du haut d'un système portent les sections : avant sa règle
    let rulerIndex = lineIndex;
    while (rulerIndex <= bottom && lines[rulerIndex].trim() && !isRuler(lines[rulerIndex])) rulerIndex++;
    if (rulerIndex > bottom || !isRuler(lines[rulerIndex])) continue;
    for (const token of markTokens(lineText)) {
      const match = token.text.match(MARKER_SIGN);
      if (match) out.section = match[1];
    }
  }
  if (rulerAt < 0) return out;
  const ruler = readRuler(block[rulerAt]);
  const place = placeOf(ruler, cursorColumn);
  if (place) {
    out.bar = place.beat.bar;
    out.beat = place.beat.beat;
    out.cell = { index: place.cell.index, count: place.cell.count };
  }

  // au-dessus de la règle : indications du système et accords
  if (at < rulerAt) {
    if (line.startsWith(CHORD_LINE)) {
      const word = [...line.matchAll(/\S+/g)].find(
        (match) => match.index! > 0 && cursorColumn >= match.index! && cursorColumn < match.index! + match[0].length,
      );
      if (word) chord(word[0]);
      else if (cursorColumn < CHORD_LINE.length) symbol(CHORD_LINE, "ligne des accords d'accompagnement");
      return out;
    }
    if (line.startsWith("@")) {
      if (cursorColumn === 0) return (symbol("@", "ligne d'indications pour tout le système"), out);
      const token = markAt(line, cursorColumn);
      if (token) symbol(token.text, topMeaning(token.text));
    }
    return out;
  }
  if (at === rulerAt) {
    if (cursorColumn < ruler.pipe) {
      symbol(line.slice(0, ruler.pipe).trim(), `règle de comptage : le système commence à la mesure ${line.slice(1, ruler.pipe).trim()}`);
      return out;
    }
    const sep = ruler.seps.find((separator) => cursorColumn >= separator.from && cursorColumn < separator.to);
    if (sep) return (symbol(sep.text, barMeaning(sep.text, sep === ruler.seps[0])), out);
    if (place) {
      const label = place.cell.label;
      const count = place.cell.count;
      symbol(
        label,
        /^\d+$/.test(label)
          ? `début du temps ${label}${count > 1 ? `, coupé en ${count} cases` : ""}`
          : `case ${place.cell.index} sur ${count} du temps ${place.beat.beat ?? ""}`.trim(),
      );
    }
    return out;
  }

  // sous la règle : les portées, chacune de ses lignes de notes à ses lignes @. Le trait sous la
  // règle ouvre la première partie, un trait double en ouvre une autre, un trait simple ouvre
  // une autre portée de la même partie.
  const entries = splitParts(meta.parts ?? "")
    .map(splitPartEntry)
    .filter((entry) => entry.name);
  const declared = entries.map((entry) => entry.name);
  // les cordes de chaque partie déclarée (instrument à cordes) ; une entrée fautive n'en a pas
  const stringsOfPart = entries.map((entry) => {
    try {
      return partExtras(entry.name, entry.extras, 0).strings;
    } catch {
      return undefined;
    }
  });
  let strings: Strings | undefined;
  const parts: { name?: string; staves: number }[] = [];
  let staff = -1;
  let octave: number | undefined;
  let lastOctave: number | undefined;
  for (let blockIndex = rulerAt + 1; blockIndex < block.length; blockIndex++) {
    const blockLine = block[blockIndex];
    const rule = isRule(blockLine);
    if (rule) {
      if (blockIndex === rulerAt + 1 || rule.double || !parts.length) parts.push({ staves: 0 });
      parts[parts.length - 1].staves++;
      lastOctave = undefined;
      if (blockIndex === at) {
        const name = rule.name ? ` ; il porte le nom de la partie « ${rule.name} »` : "";
        symbol(
          blockLine.trim().slice(0, 3),
          (blockIndex === rulerAt + 1
            ? "trait sous la règle de comptage"
            : rule.double
              ? "trait double : sépare deux parties"
              : "trait simple : sépare deux portées d'une même partie") + name,
        );
      }
    } else if (!parts.length) parts.push({ staves: 1 });
    if (blockIndex <= at) staff = parts.reduce((total, part) => total + part.staves, 0) - 1;
    if (!rule && !blockLine.startsWith("@")) {
      const pipe = blockLine.indexOf("|");
      const label = pipe > 0 ? blockLine.slice(0, pipe).trim() : "";
      const here = stringsOfPart[parts.length - 1];
      const lane = here
        ? /^\d+$/.test(label) && Number(label) >= 1 && Number(label) <= here.open.length
          ? Number(label)
          : undefined
        : label
          ? parseOctaveLabel(label)
          : undefined;
      if (lane !== undefined || here) lastOctave = lane;
      if (blockIndex === at) {
        octave = lastOctave;
        strings = here;
      }
    }
  }
  parts.forEach((part, partIndex) => declared[partIndex] && (part.name = declared[partIndex]));
  if (staff >= 0) {
    out.staff = staff;
    out.parts = parts;
  }
  if (out.symbol) return out;

  if (line.startsWith("@l")) {
    const word = [...line.matchAll(/\S+/g)].find(
      (match) => match.index! > 0 && cursorColumn >= match.index! && cursorColumn < match.index! + match[0].length,
    );
    if (word)
      symbol(
        word[0],
        isExtender(word[0])
          ? "prolongation : la syllabe se chante sur les notes suivantes"
          : word[0].endsWith("-")
            ? "syllabe : le mot continue sur la syllabe suivante"
            : "syllabe des paroles",
      );
    else if (cursorColumn < 2) symbol("@l", "ligne de paroles d'un couplet");
    return out;
  }
  if (line.startsWith("@")) {
    if (cursorColumn === 0) return (symbol("@", "ligne des nuances, articulations et pédale de la portée"), out);
    const token = markAt(line, cursorColumn);
    if (token) symbol(token.text, staffMeaning(token.text));
    return out;
  }

  // ligne de notes : un couloir d'octave, ou une corde
  if (!strings) out.octave = octave;
  else if (octave !== undefined) out.string = octave;
  const pitchOf = (number: number) => (strings ? soundingOf(strings, octave!, number) : midiOf(octave!, number));
  const pipe = line.indexOf("|");
  if (cursorColumn < pipe) {
    const label = line.slice(0, pipe).trim();
    if (label && octave !== undefined && strings)
      symbol(
        label,
        names === "none"
          ? `corde ${label}`
          : `corde ${label} : ${noteName(strings.open[octave - 1], names)} à vide${strings.capo ? `, capo ${strings.capo}` : ""}`,
      );
    else if (label && octave !== undefined)
      symbol(
        label,
        names === "none"
          ? `octave ${label}`
          : `octave ${label} : de ${noteName(midiOf(octave, 1), names)} à ${noteName(midiOf(octave, 12), names)}`,
      );
    return out;
  }
  const sep = ruler.seps.find((separator) => cursorColumn >= separator.from && cursorColumn < separator.to);
  if (sep) return (symbol(sep.text, barMeaning(sep.text, sep === ruler.seps[0])), out);
  if (!place || octave === undefined) return out;
  const content = line.slice(place.cell.start, place.cell.end).trim();
  if (content) symbol(content, noteMeaning(content, line, place), keysOf(content, line, place));
  return out;

  function chord(word: string) {
    const notes = chordNotes(word);
    if (!notes) return void symbol(word, "accord inconnu");
    const list = notes.map((note) => pitchClass(note, names)).join(" ");
    // au plus près du signe, ses autres écritures : son nom Prisma, son nom anglais, ses notes Prisma ; puis ses notes
    const writing = chordWriting(word);
    const others = [
      writing !== "prisma" && chordPrismaName(notes),
      writing !== "english" && chordName(notes),
      writing !== "notes" && chordPrismaText(notes),
    ].filter(Boolean);
    const { shape } = splitShape(word);
    symbol(word, `${others.length ? `(${others.join(", ")}) ` : ""}accord ${list}${shape ? `, grille ${shape}` : ""}`, {
      keys: notes.map((note) => ((note - 1) % 12) + 1),
    });
  }

  function noteMeaning(content: string, row: string, cellPlace: NonNullable<ReturnType<typeof placeOf>>): string {
    const graces = content.match(/^(\d+')+/)?.[0] ?? "";
    const rest = content.slice(graces.length);
    const staves: string[] = [];
    if (graces) {
      const graceNames = graces
        .split(GRACE_MARK)
        .filter(Boolean)
        .map((name) => named(pitchOf(Number(name))));
      staves.push(`${graceNames.length > 1 ? "petites notes" : "petite note"} : ${graceNames.join(", ")}${rest ? ", puis" : ""}`);
    }
    if (rest === "-") staves.push(held(row, cellPlace) ?? "la note continue");
    else if (/^-\d+$/.test(rest)) staves.push(`${named(pitchOf(Number(rest.slice(1))))}, commencé plus tôt, qui continue`);
    else {
      const match = rest.match(new RegExp(`^(\\d+)(?:\\${TRILL_MARK}(\\d+))?(?:${FINGER_MARK}(\\d))?$`));
      if (match) {
        const midi = pitchOf(Number(match[1]));
        let description = noteName(midi, names) || "note";
        if (strings) description = `case ${match[1]}${description === "note" ? "" : ` : ${description}`}`;
        if (match[2]) description += `, en trille avec ${named(strings ? pitchOf(Number(match[2])) : trillAux(midi, Number(match[2])))}`;
        if (match[3]) description += `, doigt ${match[3]}${FINGERS[Number(match[3])] ? ` (${FINGERS[Number(match[3])]})` : ""}`;
        staves.push(description);
      } else if (strings && rest) staves.push(techniqueMeaning(rest) ?? "signe inconnu");
      else if (rest) staves.push("signe inconnu");
    }
    return staves.join(" ");
  }

  /** Une technique des cordes dans une case (« x », « <12> », « 7/ », « 7// », « //7 », « 7b9r ») : ce qu'elle fait jouer. */
  function techniqueMeaning(rest: string): string | undefined {
    const technique = stringCell(rest);
    if (!technique) return undefined;
    const at = (fret: number) => `case ${fret}${names === "none" ? "" : ` (${noteName(pitchOf(fret), names)})`}`;
    const way = (direction: Direction) => (direction === "up" ? "vers l'aigu" : "vers le grave");
    const from = (direction: Direction) => (direction === "up" ? "d'en dessous" : "d'au-dessus");
    let description = technique.dead
      ? "note étouffée : la main touche la corde sans appuyer, un son sec"
      : technique.harmonic
        ? `harmonique naturelle : effleurer la corde au-dessus de la case ${technique.fret}${names === "none" ? "" : `, elle sonne ${noteName(pitchOf(0) + HARMONICS[technique.fret], names)}`}`
        : (technique.slideIn ? `arriver en glissant ${from(technique.slideIn)} sur la ${at(technique.fret)}` : at(technique.fret)) +
          (technique.slide ? `, puis glisser ${way(technique.slide)} jusqu'à la note suivante de la corde, sans la rejouer` : "") +
          (technique.slideOut ? `, puis glisser ${way(technique.slideOut)} en laissant la note s'éteindre` : "") +
          (technique.bend !== undefined
            ? ` tirée jusqu'à sonner comme la ${at(technique.bend)}${technique.release ? ", puis relâchée" : ""}`
            : "");
    if (technique.finger) description += `, doigt ${technique.finger}`;
    return description;
  }

  /** Les numéros d'une case, pour un clavier : sa note (celle que prolonge une tenue), sa voisine de trille, ses petites notes. */
  function keysOf(content: string, row: string, cellPlace: NonNullable<ReturnType<typeof placeOf>>) {
    // sur une corde, la case devient la touche de la note qui sonne
    const key = (number: number) => (strings ? numberOf(pitchOf(number)) : number);
    const valid = (number: number) => (strings ? number >= 0 && number <= MAX_FRET : number >= 1 && number <= 12);
    const graces = (content.match(/^(\d+')+/)?.[0] ?? "").split("'").filter(Boolean).map(Number).filter(valid).map(key);
    // le glissé d'entrée (« //7 ») ne change pas la case
    const rest = content.replace(/^(\d+')+/, "").replace(/^(?:\/\/|\\\\)/, "");
    const match = rest.match(/^-?(\d+)(?:~(\d+))?/);
    const heldNumber = rest === "-" ? held(row, cellPlace)?.match(/^(\d+)/)?.[1] : undefined;
    const main = match ? Number(match[1]) : heldNumber ? Number(heldNumber) : undefined;
    if (main === undefined && !graces.length) return undefined;
    const trill = match?.[2] ? Number(match[2]) : undefined;
    return {
      keys: main !== undefined && valid(main) ? [key(main)] : [],
      ...(trill !== undefined && valid(trill) ? { trill: key(trill) } : {}),
      ...(graces.length ? { graces } : {}),
    };
  }

  /** La note qu'une tenue prolonge : la dernière attaque à sa gauche, sur la même ligne. */
  function held(row: string, cellPlace: NonNullable<ReturnType<typeof placeOf>>): string | undefined {
    const cells = ruler.beats.flatMap((beat) => beat.cells);
    for (let cellIndex = cells.indexOf(cellPlace.cell) - 1; cellIndex >= 0; cellIndex--) {
      const cellText = row
        .slice(cells[cellIndex].start, cells[cellIndex].end)
        .trim()
        .replace(/^(\d+')+/, "");
      if (!cellText || cellText === "-") {
        if (!cellText) return undefined;
        continue;
      }
      const match = cellText.match(/^-?(\d+)/);
      // la tenue ne montre pas sa note : son numéro, puis son nom
      return match
        ? names === "none"
          ? `${match[1]} qui continue`
          : `${match[1]} (${noteName(pitchOf(Number(match[1])), names)}) qui continue`
        : undefined;
    }
    return undefined;
  }
}

/** Une clé de l'en-tête : ce qu'elle règle, et ce que dit sa valeur (« ici ternaire »). */
function keyMeaning(key: string, value: string): string {
  const here = value ? valueOf(key, value) : undefined;
  if (here) return `${FRONTMATTER_SHORT[key] ?? FRONTMATTER[key]} : ici ${here}`;
  return FRONTMATTER[key] ?? "clé gardée telle quelle";
}

/** Ce que règle une clé, sans le détail de ses valeurs possibles (la valeur suit). */
const FRONTMATTER_SHORT: Record<string, string> = {
  bpm: "tempo de départ",
  key: "tonalité du morceau",
  cell: "largeur de base d'une case à l'écriture",
  division: "découpage par défaut d'un temps",
};

function valueOf(key: string, value: string): string | undefined {
  if (key === "format") return `la version ${value}`;
  if (key === "bpm") return `${value} temps par minute`;
  if (key === "key") {
    const parsedKey = parseKey(value);
    return parsedKey && keyName(parsedKey, "latin");
  }
  if (key === "cell") return `${value} caractères`;
  if (key === "division") return value === "3" ? "ternaire, chaque temps en 3" : value === "2" ? "binaire, chaque temps en 2" : undefined;
  if (key === "order") return value.split(/\s+/).join(" → ");
  return undefined;
}

function barMeaning(sep: string, lead: boolean): string {
  if (lead) return sep === "||:" ? "début du système, et d'un passage répété" : "début du système";
  return (
    {
      "|": "séparation de deux temps",
      "||": "fin de mesure",
      ":||": "fin d'un passage répété : on revient au dernier ||: (ou au début de la section)",
      "||:": "fin de mesure, et début d'un passage répété",
      ":||:": "fin d'un passage répété, et début du suivant",
    }[sep] ?? "barre inconnue"
  );
}

/** Le sens d'une indication d'une ligne @ : celle du système (au-dessus de la règle), ou celle d'une portée. */
export const markMeaning = (text: string, system: boolean) => (system ? topMeaning(text) : staffMeaning(text));

function topMeaning(text: string): string {
  const match = text.match(MARKER_SIGN);
  if (match) return `début de la section ${match[1]}`;
  if (text === FERMATA) return "point d'orgue : tenir plus longtemps que la valeur écrite";
  if (text === "/") return "arpège de toutes les portées, du grave à l'aigu";
  if (text === ARPEGGIO_DOWN) return "arpège de toutes les portées, de l'aigu au grave";
  const times = text.match(/^(\d+)[×x]$/);
  if (times) return `le passage se joue ${times[1]} fois`;
  return term(text) ?? "indication pour tout le système";
}

function staffMeaning(text: string): string {
  if (isDynamic(text)) {
    const dynamic = text.replace(/^\((.+)\)$/, "$1");
    return `${DYNAMICS[dynamic] ?? "nuance"}${dynamic !== text ? " (ajoutée par l'éditeur)" : ""}`;
  }
  if (isHairpin(text)) return text.startsWith("<") ? "crescendo : de plus en plus fort" : "decrescendo : de moins en moins fort";
  if (isSlur(text)) return "liaison d'expression : notes jouées liées";
  if (text === "/") return "arpège de l'accord de cette portée, du grave à l'aigu";
  if (text === ARPEGGIO_DOWN) return "arpège de l'accord de cette portée, de l'aigu au grave";
  if (text === ".") return "staccato : détaché, plus court";
  if (text === "!") return "accent : attaque plus forte";
  if (text === "!!") return "marcato : accent plus fort et plus sec";
  if (text === "d") return "médiator vers le bas (⊓)";
  if (text === "u") return "médiator vers le haut (V)";
  if (effectOf(text) === "palmMute")
    return "étouffé de la paume (P.M.) : la tranche de la main sur les cordes, près du chevalet, jusqu'au bout du trait";
  if (effectOf(text) === "vibrato") return "vibrato : la note ondule, jusqu'au bout des vagues";
  if (text === PEDAL_DOWN) return "enfoncer la pédale";
  if (text === PEDAL_UP) return "relâcher la pédale";
  if (text === PEDAL_CHANGE) return "changer de pédale : relâcher et enfoncer au même instant";
  if (isPedalText(text)) return /simile/i.test(text) ? "continuer à pédaler de même" : "consigne de pédale";
  return term(text) ?? "indication pour cette portée";
}
