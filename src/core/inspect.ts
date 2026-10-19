/**
 * Ce que montre le curseur dans un texte .prisma : sa place dans la musique (section, mesure, temps,
 * case, portée, octave) et le sens du signe qu'il pointe (une note, une nuance, une clé de
 * l'en-tête…), pour la barre de statut de l'éditeur. La lecture est indulgente : un texte en
 * cours d'écriture, même faux, se décrit au mieux.
 */
import { chordName, chordNotes, chordPrismaText } from "./chords.ts";
import { ARPEGGIO_DOWN, FERMATA, FINGER_MARK, GRACE_MARK, MARKER_SIGN, PEDAL_CHANGE, PEDAL_DOWN, PEDAL_UP, TRILL_MARK, isDynamic, isExtender, isHairpin, isPedalText, isSlur, trillAux } from "./model.ts";
import { midiOf, octaveOf, parseOctaveLabel } from "./pitch.ts";
import { CHORD_LINE, isRuler, markTokens, parseRule } from "./prisma-parse.ts";

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
const pitchClass = (n: number, names: NoteNames) => (names === "none" ? String(n) : (names === "latin" ? LATIN : ENGLISH)[(n - 1) % 12]);

const FINGERS = ["", "pouce", "index", "majeur", "annulaire", "auriculaire"];

export const FRONTMATTER: Record<string, string> = {
  format: "version du format Prisma du fichier",
  title: "titre du morceau",
  subtitle: "sous-titre, gravé sous le titre",
  composer: "compositeur",
  source: "source du morceau",
  bpm: "tempo de départ, en temps par minute",
  parts: "noms des parties, de haut en bas, et entre parenthèses l'instrument qui joue chacune à l'écoute (sinon son nom le fait deviner)",
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
const term = (t: string) => TERMS.find(([re]) => re.test(t))?.[1];

/** Un morceau de règle : les barres et, entre deux, les cases d'un temps. */
type Cell = { start: number; end: number; label: string; index: number; count: number };
type Beat = { from: number; to: number; bar: string; beat?: number; cells: Cell[] };
type Sep = { from: number; to: number; text: string };

const nextBar = (bar: string) => (/^\d+$/.test(bar) ? String(Number(bar) + 1) : bar + "'");

/** Règle de comptage, lue sans erreur : ses barres et ses temps, mesure par mesure. */
function readRuler(ruler: string) {
  const pipe = ruler.indexOf("|");
  const seps: Sep[] = [];
  for (let i = pipe; i >= 0 && i < ruler.length; ) {
    if (ruler[i] === "|" || (ruler[i] === ":" && ruler[i + 1] === "|")) {
      let j = i;
      while (j < ruler.length && (ruler[j] === "|" || ruler[j] === ":")) j++;
      seps.push({ from: i, to: j, text: ruler.slice(i, j) });
      i = j;
    } else i++;
  }
  let bar = ruler.slice(1, pipe).trim() || "?";
  const beats: Beat[] = [];
  for (let k = 0; k + 1 < seps.length; k++) {
    const from = seps[k].to, to = seps[k + 1].from;
    const labels = [...ruler.slice(from, to).matchAll(/\S+/g)];
    const cells = labels.map((m, i) => ({
      start: from + m.index!,
      end: i + 1 < labels.length ? from + labels[i + 1].index! : to,
      label: m[0],
      index: i + 1,
      count: labels.length,
    }));
    if (cells.length) cells[0].start = from;
    const n = Number(labels[0]?.[0]);
    beats.push({ from, to, bar, beat: Number.isInteger(n) && n > 0 ? n : undefined, cells });
    if (seps[k + 1].text !== "|") bar = nextBar(bar);
  }
  return { pipe, seps, beats };
}

/** La mesure, le temps et la case d'une colonne, d'après la règle du système. */
function placeOf(r: ReturnType<typeof readRuler>, col: number) {
  const b = r.beats.find((x) => col >= x.from && col < x.to);
  if (!b) return undefined;
  const cell = [...b.cells].reverse().find((c) => c.start <= col) ?? b.cells[0];
  return { beat: b, cell };
}

/** Le texte sous la colonne col d'une ligne @ : une indication entière (« a tempo », « <---- »). */
function markAt(line: string, col: number) {
  return markTokens(line).find((t) => col >= t.col && col < t.col + t.text.length);
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
  const L = before.length - 1;
  const C = before[before.length - 1].length;
  const out: Inspection = { line: L + 1, column: C + 1 };
  const line = lines[L] ?? "";
  const symbol = (t: string, meaning: string, keys?: Pick<NonNullable<Inspection["symbol"]>, "keys" | "trill" | "graces">) => (out.symbol = { text: t, meaning, ...keys });
  // le nom d'une note, ou, sans noms, son numéro
  const named = (midi: number) => noteName(midi, names) || String((midi % 12) + 1);

  // l'en-tête
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  let body = 0;
  const meta: Record<string, string> = {};
  if (lines[i]?.trim() === "---") {
    const close = lines.findIndex((l, k) => k > i && l.trim() === "---");
    const end = close < 0 ? lines.length : close;
    for (let k = i + 1; k < end; k++) {
      const m = lines[k].match(/^\s*([\wÀ-ÿ-]+)\s*:\s*(.*)$/);
      if (m) meta[m[1]] = m[2].trim().replace(/^(["'])(.*)\1$/, "$2");
    }
    body = end + 1;
    if (L === i || L === close) {
      symbol("---", "délimite l'en-tête du morceau");
      return out;
    }
    if (L > i && L < end) {
      const m = line.match(/^\s*([\wÀ-ÿ-]+)\s*:\s*(.*)$/);
      if (m) symbol(m[1], keyMeaning(m[1], m[2].trim()));
      return out;
    }
  }
  if (line.startsWith("#")) {
    symbol("#", "commentaire : ignoré à la lecture");
    return out;
  }
  if (L < body || !line.trim()) return out;

  // le système du curseur : les lignes non vides autour de lui
  let top = L, bottom = L;
  while (top > body && lines[top - 1].trim()) top--;
  while (bottom + 1 < lines.length && lines[bottom + 1].trim()) bottom++;
  const block = lines.slice(top, bottom + 1);
  const at = L - top;
  const rulerAt = block.findIndex((l) => isRuler(l));

  // la section : la dernière lettre posée jusqu'à ce système
  for (let k = body; k <= bottom; k++) {
    const l = lines[k];
    if (!l.startsWith("@") || l.startsWith(CHORD_LINE)) continue;
    // seules les lignes du haut d'un système portent les sections : avant sa règle
    let r = k;
    while (r <= bottom && lines[r].trim() && !isRuler(lines[r])) r++;
    if (r > bottom || !isRuler(lines[r])) continue;
    for (const t of markTokens(l)) {
      const m = t.text.match(MARKER_SIGN);
      if (m) out.section = m[1];
    }
  }
  if (rulerAt < 0) return out;
  const ruler = readRuler(block[rulerAt]);
  const place = placeOf(ruler, C);
  if (place) {
    out.bar = place.beat.bar;
    out.beat = place.beat.beat;
    out.cell = { index: place.cell.index, count: place.cell.count };
  }

  // au-dessus de la règle : indications du système et accords
  if (at < rulerAt) {
    if (line.startsWith(CHORD_LINE)) {
      const word = [...line.matchAll(/\S+/g)].find((m) => m.index! > 0 && C >= m.index! && C < m.index! + m[0].length);
      if (word) chord(word[0]);
      else if (C < CHORD_LINE.length) symbol(CHORD_LINE, "ligne des accords d'accompagnement");
      return out;
    }
    if (line.startsWith("@")) {
      if (C === 0) return symbol("@", "ligne d'indications pour tout le système"), out;
      const t = markAt(line, C);
      if (t) symbol(t.text, topMeaning(t.text));
    }
    return out;
  }
  if (at === rulerAt) {
    if (C < ruler.pipe) {
      symbol(line.slice(0, ruler.pipe).trim(), `règle de comptage : le système commence à la mesure ${line.slice(1, ruler.pipe).trim()}`);
      return out;
    }
    const sep = ruler.seps.find((s) => C >= s.from && C < s.to);
    if (sep) return symbol(sep.text, barMeaning(sep.text, sep === ruler.seps[0])), out;
    if (place) {
      const label = place.cell.label;
      const n = place.cell.count;
      symbol(label, /^\d+$/.test(label) ? `début du temps ${label}${n > 1 ? `, coupé en ${n} cases` : ""}` : `case ${place.cell.index} sur ${n} du temps ${place.beat.beat ?? ""}`.trim());
    }
    return out;
  }

  // sous la règle : les portées, chacune de ses lignes de notes à ses lignes @. Le trait sous la
  // règle ouvre la première partie, un trait double en ouvre une autre, un trait simple ouvre
  // une autre portée de la même partie.
  const declared = (meta.parts ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const parts: { name?: string; staves: number }[] = [];
  let staff = -1;
  let octave: number | undefined;
  let lastOctave: number | undefined;
  for (let k = rulerAt + 1; k < block.length; k++) {
    const l = block[k];
    const rule = isRule(l);
    if (rule) {
      if (k === rulerAt + 1 || rule.double || !parts.length) parts.push({ staves: 0 });
      parts[parts.length - 1].staves++;
      lastOctave = undefined;
      if (k === at) {
        const name = rule.name ? ` ; il porte le nom de la partie « ${rule.name} »` : "";
        symbol(l.trim().slice(0, 3), (k === rulerAt + 1 ? "trait sous la règle de comptage" : rule.double ? "trait double : sépare deux parties" : "trait simple : sépare deux portées d'une même partie") + name);
      }
    } else if (!parts.length) parts.push({ staves: 1 });
    if (k <= at) staff = parts.reduce((n, x) => n + x.staves, 0) - 1;
    if (!rule && !l.startsWith("@")) {
      const pipe = l.indexOf("|");
      const label = pipe > 0 ? l.slice(0, pipe).trim() : "";
      const o = label ? parseOctaveLabel(label) : undefined;
      if (o !== undefined) lastOctave = o;
      if (k === at) octave = lastOctave;
    }
  }
  parts.forEach((x, n) => declared[n] && (x.name = declared[n]));
  if (staff >= 0) {
    out.staff = staff;
    out.parts = parts;
  }
  if (out.symbol) return out;

  if (line.startsWith("@l")) {
    const word = [...line.matchAll(/\S+/g)].find((m) => m.index! > 0 && C >= m.index! && C < m.index! + m[0].length);
    if (word) symbol(word[0], isExtender(word[0]) ? "prolongation : la syllabe se chante sur les notes suivantes" : word[0].endsWith("-") ? "syllabe : le mot continue sur la syllabe suivante" : "syllabe des paroles");
    else if (C < 2) symbol("@l", "ligne de paroles d'un couplet");
    return out;
  }
  if (line.startsWith("@")) {
    if (C === 0) return symbol("@", "ligne des nuances, articulations et pédale de la portée"), out;
    const t = markAt(line, C);
    if (t) symbol(t.text, staffMeaning(t.text));
    return out;
  }

  // ligne de notes
  out.octave = octave;
  const pipe = line.indexOf("|");
  if (C < pipe) {
    const label = line.slice(0, pipe).trim();
    if (label && octave !== undefined) symbol(label, names === "none" ? `octave ${label}` : `octave ${label} : de ${noteName(midiOf(octave, 1), names)} à ${noteName(midiOf(octave, 12), names)}`);
    return out;
  }
  const sep = ruler.seps.find((s) => C >= s.from && C < s.to);
  if (sep) return symbol(sep.text, barMeaning(sep.text, sep === ruler.seps[0])), out;
  if (!place || octave === undefined) return out;
  const content = line.slice(place.cell.start, place.cell.end).trim();
  if (content) symbol(content, noteMeaning(content, octave, line, place), keysOf(content, line, place));
  return out;

  function chord(word: string) {
    const notes = chordNotes(word);
    if (!notes) return void symbol(word, "accord inconnu");
    const list = notes.map((n) => pitchClass(n, names)).join(" ");
    // au plus près du signe, son autre écriture : les chiffres Prisma d'un accord nommé, le nom d'un
    // accord écrit en chiffres (s'il en a un) ; puis ses notes
    const other = /^\d/.test(word) ? chordName(notes) : chordPrismaText(notes);
    symbol(word, `${other ? `(${other}) ` : ""}accord ${list}`, { keys: notes.map((n) => ((n - 1) % 12) + 1) });
  }

  function noteMeaning(content: string, oct: number, row: string, p: NonNullable<ReturnType<typeof placeOf>>): string {
    const graces = content.match(/^(\d+')+/)?.[0] ?? "";
    const rest = content.slice(graces.length);
    const staves: string[] = [];
    if (graces) {
      const g = graces.split(GRACE_MARK).filter(Boolean).map((n) => named(midiOf(oct, Number(n))));
      staves.push(`${g.length > 1 ? "petites notes" : "petite note"} : ${g.join(", ")}${rest ? ", puis" : ""}`);
    }
    if (rest === "-") staves.push(held(row, p) ?? "la note continue");
    else if (/^-\d+$/.test(rest)) staves.push(`${named(midiOf(oct, Number(rest.slice(1))))}, commencé plus tôt, qui continue`);
    else {
      const m = rest.match(new RegExp(`^(\\d+)(?:\\${TRILL_MARK}(\\d+))?(?:${FINGER_MARK}(\\d))?$`));
      if (m) {
        const midi = midiOf(oct, Number(m[1]));
        let s = noteName(midi, names) || "note";
        if (m[2]) s += `, en trille avec ${named(trillAux(midi, Number(m[2])))}`;
        if (m[3]) s += `, doigt ${m[3]}${FINGERS[Number(m[3])] ? ` (${FINGERS[Number(m[3])]})` : ""}`;
        staves.push(s);
      } else if (rest) staves.push("signe inconnu");
    }
    return staves.join(" ");
  }

  /** Les numéros d'une case, pour un clavier : sa note (celle que prolonge une tenue), sa voisine de trille, ses petites notes. */
  function keysOf(content: string, row: string, p: NonNullable<ReturnType<typeof placeOf>>) {
    const valid = (n: number) => n >= 1 && n <= 12;
    const graces = (content.match(/^(\d+')+/)?.[0] ?? "").split("'").filter(Boolean).map(Number).filter(valid);
    const rest = content.replace(/^(\d+')+/, "");
    const m = rest.match(/^-?(\d+)(?:~(\d+))?/);
    const h = rest === "-" ? held(row, p)?.match(/^(\d+)/)?.[1] : undefined;
    const main = m ? Number(m[1]) : h ? Number(h) : undefined;
    if (main === undefined && !graces.length) return undefined;
    const trill = m?.[2] ? Number(m[2]) : undefined;
    return { keys: main !== undefined && valid(main) ? [main] : [], ...(trill && valid(trill) ? { trill } : {}), ...(graces.length ? { graces } : {}) };
  }

  /** La note qu'une tenue prolonge : la dernière attaque à sa gauche, sur la même ligne. */
  function held(row: string, p: NonNullable<ReturnType<typeof placeOf>>): string | undefined {
    const cells = ruler.beats.flatMap((b) => b.cells);
    for (let k = cells.indexOf(p.cell) - 1; k >= 0; k--) {
      const c = row.slice(cells[k].start, cells[k].end).trim().replace(/^(\d+')+/, "");
      if (!c || c === "-") {
        if (!c) return undefined;
        continue;
      }
      const n = c.match(/^-?(\d+)/);
      // la tenue ne montre pas sa note : son numéro, puis son nom
      return n ? (names === "none" ? `${n[1]} qui continue` : `${n[1]} (${noteName(midiOf(octave!, Number(n[1])), names)}) qui continue`) : undefined;
    }
    return undefined;
  }
}

/** Une clé de l'en-tête : ce qu'elle règle, et ce que dit sa valeur (« ici ternaire »). */
function keyMeaning(key: string, value: string): string {
  const here = value ? valueOf(key, value) : undefined;
  if (here) return `${(FRONTMATTER_SHORT[key] ?? FRONTMATTER[key])} : ici ${here}`;
  return FRONTMATTER[key] ?? "clé gardée telle quelle";
}

/** Ce que règle une clé, sans le détail de ses valeurs possibles (la valeur suit). */
const FRONTMATTER_SHORT: Record<string, string> = {
  bpm: "tempo de départ",
  cell: "largeur de base d'une case à l'écriture",
  division: "découpage par défaut d'un temps",
};

function valueOf(key: string, value: string): string | undefined {
  if (key === "format") return `la version ${value}`;
  if (key === "bpm") return `${value} temps par minute`;
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

function topMeaning(t: string): string {
  const m = t.match(MARKER_SIGN);
  if (m) return `début de la section ${m[1]}`;
  if (t === FERMATA) return "point d'orgue : tenir plus longtemps que la valeur écrite";
  if (t === "/") return "arpège de toutes les portées, du grave à l'aigu";
  if (t === ARPEGGIO_DOWN) return "arpège de toutes les portées, de l'aigu au grave";
  const times = t.match(/^(\d+)[×x]$/);
  if (times) return `le passage se joue ${times[1]} fois`;
  return term(t) ?? "indication pour tout le système";
}

function staffMeaning(t: string): string {
  if (isDynamic(t)) {
    const d = t.replace(/^\((.+)\)$/, "$1");
    return `${DYNAMICS[d] ?? "nuance"}${d !== t ? " (ajoutée par l'éditeur)" : ""}`;
  }
  if (isHairpin(t)) return t.startsWith("<") ? "crescendo : de plus en plus fort" : "decrescendo : de moins en moins fort";
  if (isSlur(t)) return "liaison d'expression : notes jouées liées";
  if (t === "/") return "arpège de l'accord de cette portée, du grave à l'aigu";
  if (t === ARPEGGIO_DOWN) return "arpège de l'accord de cette portée, de l'aigu au grave";
  if (t === ".") return "staccato : détaché, plus court";
  if (t === "!") return "accent : attaque plus forte";
  if (t === "!!") return "marcato : accent plus fort et plus sec";
  if (t === PEDAL_DOWN) return "enfoncer la pédale";
  if (t === PEDAL_UP) return "relâcher la pédale";
  if (t === PEDAL_CHANGE) return "changer de pédale : relâcher et enfoncer au même instant";
  if (isPedalText(t)) return /simile/i.test(t) ? "continuer à pédaler de même" : "consigne de pédale";
  return term(t) ?? "indication pour cette portée";
}
