/**
 * La complétion de l'éditeur (Ctrl+Espace) : ce qui peut s'écrire au curseur, selon sa place.
 *
 * - Dans l'en-tête : les clés pas encore écrites ; dans `parts:`, des parties toutes faites (Piano,
 *   Guitare…), et entre parenthèses les instruments, et pour un instrument à cordes, ses
 *   accordages et le capo.
 * - En début de ligne : une ligne `@` (indications), `@l` (paroles), `@c` (accords), et sous la
 *   règle d'un système, une nouvelle ligne de notes, avec son octave et les barres de la règle (sur
 *   une portée à cordes, sa corde).
 * - Dans une case d'une ligne de notes : les notes (avec leur nom), la tenue, et sur une note, ce
 *   qui s'y ajoute : un doigté, une trille, une petite note devant. Sur une corde : les cases
 *   (avec leur note), la note étouffée, les harmoniques, et sur une case, les glissés, les bends
 *   et le doigt de la main gauche.
 * - Sur une ligne `@`, dans une case : les indications, chacune avec son sens. Au-dessus de la
 *   règle, celles du système (la section suivante, le point d'orgue, le tempo) ; sous une portée,
 *   les siennes (nuances, soufflets, liaisons, articulations, pédale ; sur une corde, le médiator,
 *   l'étouffé et le vibrato plutôt que la pédale).
 * - Au bout d'une règle de comptage : le temps suivant, coupé ou non, ou la fin de la mesure.
 *
 * L'écriture garde l'alignement des colonnes (voir complete.ts). Les notes et la règle ne
 * s'offrent qu'à la demande : taper un numéro ne doit rien ouvrir. L'en-tête et les instruments
 * s'offrent aussi pendant la frappe.
 */
import type { Completion, CompletionContext, CompletionResult, CompletionSection } from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import { FRONTMATTER, INSTRUMENTS, DEFAULT_CELL, SHAPE_SEPARATOR, chordName, chordNotes, chordPrismaName, chordPrismaText, chordShape, gridStrings, parseShape, partExtras, shapeNotes, shapeText, splitPartEntry, splitParts, guessKey, inspect, keyName, midiOf, noteName, parsePrisma, prismaKey } from "../core/index.ts";
import { pitchClass, stringsOf } from "../core/index.ts";
import { ARPEGGIO_DOWN, ARTICULATION_SIGNS, EFFECT_SIGNS, FERMATA, PEDAL_CHANGE, PEDAL_DOWN, PEDAL_UP, isHairpin, markMeaning, BEND_MARK, DEAD_MARK, HARMONICS, MAX_BEND, MAX_CAPO, MAX_FRET, RELEASE_MARK, guessInstrument, isStringInstrument, slideText, soundingOf, tuningsOf } from "../core/index.ts";
import type { Direction, InstrumentName, NoteNames, Strings } from "../core/index.ts";
import { CHORD_LINE, isRuler, markTokens, parseRule } from "../core/prisma-parse.ts";
import { instrumentLabel } from "./instruments.ts";
import { caseAt, cases, writeMark, extendRuler, noteLine, octaveRoom, rulerSuffixes, soundingAt, systemOf, writeCase, writeChord } from "./complete.ts";
import type { Rewrite } from "./complete.ts";

const FINGERS = ["pouce", "index", "majeur", "annulaire", "auriculaire"];
/** Les groupes de la liste, dans cet ordre. */
const SECTIONS: Record<string, CompletionSection> = Object.fromEntries(
  ["Notes", "Cases", "Glissé", "Bend", "Doigté", "Trille", "Petite note", "Ligne @", "Ligne de notes", "Sections", "Nuances", "Soufflets et liaisons", "Articulations", "Cordes", "Pédale", "Arpège", "Tempo", "Caractère"].map((name, rank) => [name, { name, rank }]),
);
/** Les doigts de la main gauche, sur le manche. */
const LEFT_FINGERS = ["index", "majeur", "annulaire", "auriculaire"];
/** L'écart d'un bend, d'une à quatre cases. */
const BEND_SIZES = ["d'un demi-ton", "d'un ton", "d'un ton et demi", "de deux tons"];
/** Un numéro de note, ramené entre 1 et 12. */
const wrap = (n: number) => ((((n - 1) % 12) + 12) % 12) + 1;

/** Les lignes du texte, et où commence le corps (après l'en-tête), où finit l'en-tête. */
function read(view: EditorView) {
  const lines = view.state.doc.toString().split("\n");
  let i = 0;
  while (i < lines.length && !lines[i].trim()) i++;
  let head: [number, number] | undefined;
  if (lines[i]?.trim() === "---") {
    const close = lines.findIndex((l, k) => k > i && l.trim() === "---");
    head = [i, close < 0 ? lines.length : close];
  }
  return { lines, head, body: head ? head[1] + 1 : 0 };
}

/** Applique une réécriture de lignes, et place le curseur. */
function rewrite(view: EditorView, r: Rewrite) {
  const doc = view.state.doc;
  const changes = [...r.lines].map(([k, text]) => {
    const l = doc.line(k + 1);
    return { from: l.from, to: l.to, insert: text };
  });
  const after = view.state.update({ changes }).state.doc;
  const at = after.line(r.caret.line + 1).from + r.caret.col;
  view.dispatch({ changes, selection: { anchor: Math.min(at, after.length) }, userEvent: "input.complete", scrollIntoView: true });
}


/**
 * Écrit content dans la case du curseur. Ce qui a été tapé depuis l'ouverture de la liste (de
 * origin, la place du curseur alors, à to) a décalé la ligne : il est retiré d'abord, la case est
 * réécrite sur le texte d'avant.
 */
function inCase(content: string, origin: number) {
  return (view: EditorView, _c: Completion, _from: number, to: number) => {
    const doc = view.state.doc;
    const text = doc.sliceString(0, origin) + doc.sliceString(Math.max(origin, to));
    const lines = text.split("\n");
    const l = doc.lineAt(origin);
    const L = l.number - 1;
    const C = origin - l.from;
    const sys = systemOf(lines, L);
    const c = sys && caseAt(lines[sys.ruler], C);
    if (sys && c) rewrite(view, writeCase(lines, sys, L, c, content));
  };
}

function headerKeys(ctx: CompletionContext, line: string, lines: string[], head: [number, number]): CompletionResult | null {
  const before = line.slice(0, ctx.pos - ctx.state.doc.lineAt(ctx.pos).from);
  const m = before.match(/^(\s*)([\w-]*)$/);
  if (!m || (!ctx.explicit && !m[2])) return null;
  const used = new Set(lines.slice(head[0] + 1, head[1]).map((l) => l.match(/^\s*([\w-]+)\s*:/)?.[1]));
  const options: Completion[] = Object.entries(FRONTMATTER)
    .filter(([k]) => !used.has(k) && k !== "format")
    .map(([k, info]) => ({ label: k, type: "property", detail: info, apply: `${k}: ` }));
  // la tonalité : celle que les notes font deviner, déjà écrite
  const key = options.find((o) => o.label === "key");
  const guess = key && guessed(lines);
  if (key && guess) Object.assign(key, { apply: `key: ${prismaKey(guess)}`, detail: `tonalité du morceau ; d'après ses notes, ${prismaKey(guess)} (${keyName(guess, "latin")})` });
  return { from: ctx.pos - m[2].length, options, validFor: /^[\w-]*$/ };
}

/** La tonalité que les notes du texte font deviner ; undefined si le texte ne se lit pas encore. */
function guessed(lines: string[]) {
  try {
    return guessKey(parsePrisma(lines.join("\n")));
  } catch {
    return undefined;
  }
}

/** Des parties toutes faites, Piano et Guitare en tête : leur nom fait deviner l'instrument. */
const READY_PARTS: { name: string; detail?: string }[] = [
  { name: "Piano", detail: "une portée par main, ou une seule" },
  { name: "Guitare", detail: "écrite en cordes, comme une tablature" },
  { name: "Chant" },
  { name: "Basse électrique", detail: "écrite en cordes, comme une tablature" },
  { name: "Violon" },
  { name: "Violoncelle" },
  { name: "Flûte" },
  { name: "Clarinette" },
  { name: "Saxophone" },
  { name: "Trompette" },
  { name: "Orgue" },
];

/** Dans `parts:`, hors des parenthèses : une partie toute faite, au début ou après une virgule. */
function partNames(ctx: CompletionContext, line: string): CompletionResult | null {
  const before = line.slice(0, ctx.pos - ctx.state.doc.lineAt(ctx.pos).from);
  const m = before.match(/^\s*parts\s*:((?:[^()]*\([^()]*\))*[^()]*)$/);
  if (!m) return null;
  const word = m[1].split(",").pop()!.replace(/^\s+/, "");
  if (!ctx.explicit && !word) return null;
  const written = m[1].split(",").slice(0, -1).map((x) => splitPartEntry(x).name.toLowerCase());
  const options: Completion[] = READY_PARTS.filter((p) => !written.includes(p.name.toLowerCase())).map((p, k) => ({
    label: p.name,
    type: "enum",
    boost: -k,
    // le son, quand il n'est pas celui du nom (Chant : des voix)
    detail: [instrumentLabel(guessInstrument(p.name)) !== p.name ? `à l'écoute : ${instrumentLabel(guessInstrument(p.name))}` : "", p.detail].filter(Boolean).join(" ; ") || undefined,
  }));
  return { from: ctx.pos - word.length, options, validFor: /^[\p{L} ]*$/u };
}

/**
 * Une liste rangée par groupe, puis par rang dans le groupe : CodeMirror garde l'ordre donné quand
 * la liste ne se filtre pas.
 */
function ranked(options: Completion[]): Completion[] {
  const rank = (o: Completion) => (typeof o.section === "object" && typeof o.section.rank === "number" ? o.section.rank : 0);
  return [...options].sort((a, b) => rank(a) - rank(b) || (b.boost ?? 0) - (a.boost ?? 0));
}

/** Les capos usuels : les cases 1 à 7 (au-delà, le manche est trop court pour jouer à l'aise). */
const USUAL_CAPOS = [1, 2, 3, 4, 5, 6, 7];

/**
 * Dans `parts:`, entre les parenthèses d'une partie : les instruments, et pour un instrument à
 * cordes, ses accordages (avec la note de chaque corde à vide) et les capos usuels (avec ce que
 * sonne la forme de do), chacun dans son groupe ; l'accordage et le capo d'abord.
 */
function instruments(ctx: CompletionContext, line: string, names: NoteNames): CompletionResult | null {
  if (!/^\s*parts\s*:/.test(line)) return null;
  const before = line.slice(0, ctx.pos - ctx.state.doc.lineAt(ctx.pos).from);
  // dans les parenthèses d'une partie : le mot en cours, après la parenthèse ou une virgule
  const m = before.match(/([^,(]*)\(([^()]*?)([a-z-]*)$/i);
  if (!m || (m[2].trim() && !m[2].trim().endsWith(","))) return null;
  const name = m[1].split(",").pop()!.trim();
  const written = m[2].split(",").map((x) => x.trim().toLowerCase()).filter(Boolean);
  const closed = /^\s*[a-z-]*\s*\)/i.test(line.slice(before.length));
  const end = (x: string) => (closed ? x : x + ")");
  const group = (name: string, rank: number) => ({ name, rank });
  const options: Completion[] = written.length ? [] : INSTRUMENTS.map((x) => ({ label: x, type: "enum", detail: instrumentLabel(x), section: group("Instruments", 2), apply: end(x) }));
  // un instrument à cordes (écrit, ou deviné du nom) : ses accordages, et le capo
  const played = (written.find((x) => (INSTRUMENTS as readonly string[]).includes(x)) ?? guessInstrument(name)) as InstrumentName;
  if (isStringInstrument(played)) {
    const note = (midi: number) => pitchClass((midi % 12) + 1, names === "english" ? "english" : "latin");
    if (!written.some((x) => tuningsOf(played).includes(x)))
      tuningsOf(played).forEach((t, k) =>
        options.push({ label: t, type: "constant", detail: [...stringsOf(played, t, 0)!.open].reverse().map(note).join(" "), section: group("Accordages", 0), boost: -k, apply: end(t) }),
      );
    if (!written.some((x) => x.startsWith("capo")))
      for (const k of USUAL_CAPOS)
        options.push({ label: `capo ${k}`, type: "constant", detail: `la forme de ${note(60)} sonne ${note(60 + k)}`, section: group("Capo", 1), boost: -k, apply: end(`capo ${k}`) });
  }
  return options.length ? { from: ctx.pos - m[3].length, options: ranked(options), validFor: /^[a-z-]*$/i } : null;
}

/** Les parties de l'en-tête (`parts:`), et leurs cordes ; vide si l'en-tête ne se lit pas encore. */
function headerParts(lines: string[], head?: [number, number]) {
  const line = head ? lines.slice(head[0] + 1, head[1]).find((l) => /^parts\s*:/.test(l)) : undefined;
  try {
    return line ? splitParts(line.replace(/^parts\s*:/, "")).map(splitPartEntry).map((e) => partExtras(e.name, e.extras, 0)) : [];
  } catch {
    return [];
  }
}

/**
 * Les cordes de la portée d'une ligne d'un système, s'il s'agit d'une portée à cordes : la partie
 * se compte sur les traits du système (le premier, sous la règle ; un trait double en commence une
 * autre), ses cordes se lisent dans l'en-tête.
 */
function stringsAt(lines: string[], sys: { ruler: number }, L: number, head?: [number, number]): Strings | undefined {
  let part = 0;
  for (let k = sys.ruler + 1; k < L; k++) {
    const r = parseRule(lines[k], k + 1);
    if (r?.double && k > sys.ruler + 1) part++;
  }
  return headerParts(lines, head)[part]?.strings;
}

/** Le nom de la note d'une corde : « corde de sol ». */
const openName = (strs: Strings, k: number, names: NoteNames) => (names === "none" ? `corde ${k}` : `corde de ${noteName(soundingOf(strs, k, 0), names).replace(/\d+$/, "")}`);

function lineStarts(ctx: CompletionContext, lines: string[], L: number, before: string, body: number, head?: [number, number], names: NoteNames = "latin"): CompletionResult | null {
  if (!/^@?[lc]?$/.test(before) || lines[L].trim() !== before.trim() || (!ctx.explicit && !before)) return null;
  const from = ctx.pos - before.length;
  const options: Completion[] = [
    { label: "@", type: "keyword", detail: "indications : nuances, soufflets, pédale, sections, signes", apply: "@ ", section: SECTIONS["Ligne @"] },
    { label: "@l", type: "keyword", detail: "paroles d'un couplet, sous les lignes de sa portée", apply: "@l ", section: SECTIONS["Ligne @"] },
    { label: "@c", type: "keyword", detail: "accords, au-dessus de la règle", apply: "@c ", section: SECTIONS["Ligne @"] },
  ];
  // sous la règle d'un système : une nouvelle ligne de notes, à son octave
  const sys = systemOf(lines, L, body);
  if (sys && L > sys.ruler && !before) {
    const ruler = lines[sys.ruler];
    const label = (o: number) => (o > 0 ? `+${o}` : String(o));
    const add = (text: string, detail: string, boost: number) =>
      options.push({
        label: text || "(même octave)",
        type: "variable",
        detail,
        boost,
        section: SECTIONS["Ligne de notes"],
        apply: (view) => {
          const l = view.state.doc.lineAt(view.state.selection.main.head);
          const insert = noteLine(ruler, text);
          view.dispatch({ changes: { from: l.from, to: l.to, insert }, selection: { anchor: l.from + ruler.indexOf("|") + 1 }, userEvent: "input.complete" });
        },
      });
    // sur une portée à cordes, les cordes qui manquent entre celle du dessus et celle du dessous, dans l'ordre
    const strs = stringsAt(lines, sys, L, head);
    if (strs) {
      const laneOf = (k: number) => {
        const l = lines[k] ?? "";
        return l.includes("|") && !l.startsWith("@") ? Number(l.slice(0, l.indexOf("|")).trim()) || undefined : undefined;
      };
      let above = 0;
      for (let k = L - 1; k > sys.ruler && !parseRule(lines[k], k + 1); k--) above = Math.max(above, laneOf(k) ?? 0);
      const below = L + 1 <= sys.last && !parseRule(lines[L + 1], L + 2) ? (laneOf(L + 1) ?? strs.open.length + 1) : strs.open.length + 1;
      for (let k = above + 1; k < below; k++) add(String(k), openName(strs, k, names), strs.open.length - k);
    } else {
      const room = octaveRoom(lines, sys, L);
      if (room.same) add("", "une ligne de plus, dans l'octave de la ligne du dessus", 1);
      for (const o of room.octaves) add(label(o), o === 0 ? "l'octave du do central" : `${Math.abs(o)} octave${Math.abs(o) > 1 ? "s" : ""} ${o > 0 ? "au-dessus" : "au-dessous"} du do central`, 0);
    }
  }
  return { from, options, filter: !!before };
}

function rulerEnd(ctx: CompletionContext, lines: string[], L: number, C: number): CompletionResult | null {
  const line = lines[L];
  if (!isRuler(line) || C < line.trimEnd().length) return null;
  const m = lines.join("\n").match(/^\s*cell\s*:\s*(\d+)/m);
  const cell = m ? Number(m[1]) : DEFAULT_CELL;
  const options: Completion[] = rulerSuffixes(line, cell).map((s) => ({
    label: s.label,
    detail: s.detail,
    type: "constant",
    apply: (view: EditorView, _c: Completion, from: number, to: number) => {
      const doc = view.state.doc;
      const lines = (doc.sliceString(0, from) + doc.sliceString(to)).split("\n");
      const sys = systemOf(lines, doc.lineAt(from).number - 1);
      if (sys) rewrite(view, extendRuler(lines, sys, s.text));
    },
  }));
  return options.length ? { from: ctx.pos, options, filter: false } : null;
}

/**
 * Sur une corde, dans une case : les cases (avec leur note), la tenue, la note étouffée, les
 * harmoniques ; sur une case écrite, ses glissés (vers la note suivante d'abord, dans son sens), ses
 * bends et le doigt de la main gauche.
 */
function stringCells(ctx: CompletionContext, lines: string[], L: number, c: { start: number; end: number }, content: string, lead: number, string: number, strs: Strings, names: NoteNames): CompletionResult {
  const name = (fret: number, midi = soundingOf(strs, string, fret)) => (names === "none" ? "" : noteName(midi, names));
  const options: Completion[] = [];
  const add = (text: string, detail: string, section: string) => options.push({ label: text, detail, section: SECTIONS[section], boost: -options.length, type: "variable", apply: inCase(text, ctx.pos) });
  const fret = /^\d{1,2}$/.test(content) && Number(content) <= MAX_FRET ? Number(content) : undefined;
  if (fret === undefined) {
    for (let k = 0; k <= MAX_FRET; k++) add(String(k), k ? name(k) : `${name(0)}, à vide`, "Cases");
    add("-", "la note continue", "Cases");
    add(DEAD_MARK, "note étouffée : un son sec, sans hauteur", "Cases");
    for (const k of Object.keys(HARMONICS).map(Number).sort((a, b) => a - b)) add(`<${k}>`, `harmonique : elle sonne ${name(k, soundingOf(strs, string, 0) + HARMONICS[k]) || `sur la case ${k}`}`, "Cases");
  } else {
    // la note suivante de la corde, si elle vient sans silence : le glissé vers elle, dans son sens
    const all = cases(lines[systemOf(lines, L)!.ruler]);
    let next: number | undefined;
    for (const d of all.filter((x) => x.start >= c.end)) {
      const cell = lines[L].slice(d.start, d.end).trim();
      if (cell === "-") continue;
      const m = cell.match(/^(?:\/\/|\\\\)?(\d{1,2})/);
      next = m ? Number(m[1]) : undefined;
      break;
    }
    const toward = next !== undefined && next !== fret ? (next > fret ? "up" : "down") : undefined;
    const glide = (d: Direction) => (d === "up" ? "vers l'aigu" : "vers le grave");
    if (toward) add(fret + slideText(toward, false), `glisser ${glide(toward)} jusqu'à la case ${next}, sans la rejouer`, "Glissé");
    for (const d of ["down", "up"] as const) add(fret + slideText(d, true), `glisser ${glide(d)} en laissant la note s'éteindre`, "Glissé");
    for (const d of ["up", "down"] as const) add(slideText(d, true) + fret, `arriver en glissant d'${d === "up" ? "en dessous" : "au-dessus"}`, "Glissé");
    for (let up = 1; up <= MAX_BEND && fret + up <= MAX_FRET; up++) {
      add(`${fret}${BEND_MARK}${fret + up}`, `tirer la corde ${BEND_SIZES[up - 1]}${names === "none" ? "" : `, jusqu'au ${name(fret + up)}`}`, "Bend");
      if (up === 2) add(`${fret}${BEND_MARK}${fret + up}${RELEASE_MARK}`, "tirer d'un ton, puis relâcher", "Bend");
    }
    LEFT_FINGERS.forEach((f, k) => add(`${fret}_${k + 1}`, `doigt ${k + 1} : ${f}`, "Doigté"));
  }
  const from = ctx.state.doc.lineAt(ctx.pos).from + c.start + lead;
  // sur une case écrite, la liste est celle de la case : elle ne se filtre pas (« //7 » ne commence pas par 7)
  return { from: Math.min(from, ctx.pos), options, validFor: /^[\dx<>/\\br_-]*$/, ...(fret !== undefined ? { filter: false } : {}) };
}

/** Une indication à proposer sur une ligne @ : son début, et pour un signe qui dure, ce qui le prolonge et le ferme. */
type Mark = { head: string; fill?: string; tail?: string; section: string; label?: string };

const TEMPO_TERMS = ["rit.", "rall.", "accel.", "a tempo", "rubato"];
const STAFF_TERMS = ["dolce", "cresc.", "dim.", "legato", "espressivo", "cantabile", "sostenuto"];

/** Ce qui s'écrit sur une ligne @ : celle du système (system), ou celle d'une portée, à cordes ou non. */
function marksFor(system: boolean, strings: boolean, nextSection: string | undefined): Mark[] {
  if (system)
    return [
      ...(nextSection ? [{ head: `[${nextSection}]`, section: "Sections" }] : []),
      { head: "2×", section: "Sections" },
      { head: FERMATA, section: "Tempo" },
      ...TEMPO_TERMS.map((head) => ({ head, section: "Tempo" })),
      { head: "/", section: "Arpège" },
      { head: ARPEGGIO_DOWN, section: "Arpège" },
    ];
  return [
    ...["p", "mp", "mf", "f", "pp", "ff", "ppp", "fff", "sf", "sfz", "fp"].map((head) => ({ head, section: "Nuances" })),
    { head: "<", fill: "-", section: "Soufflets et liaisons", label: "<---" },
    { head: ">", fill: "-", section: "Soufflets et liaisons", label: ">---" },
    { head: "(", fill: "-", tail: ")", section: "Soufflets et liaisons", label: "(--)" },
    { head: ".", section: "Articulations" },
    { head: "!", section: "Articulations" },
    { head: "!!", section: "Articulations" },
    ...(strings
      ? [
          { head: ARTICULATION_SIGNS.down, section: "Cordes" },
          { head: ARTICULATION_SIGNS.up, section: "Cordes" },
          { head: EFFECT_SIGNS.palmMute, fill: "-", section: "Cordes", label: "P.M.---" },
          { head: EFFECT_SIGNS.vibrato, fill: EFFECT_SIGNS.vibrato, section: "Cordes", label: "~~~~" },
        ]
      : [
          { head: PEDAL_DOWN, section: "Pédale" },
          { head: PEDAL_UP, section: "Pédale" },
          { head: PEDAL_CHANGE, section: "Pédale" },
        ]),
    { head: "/", section: "Arpège" },
    { head: ARPEGGIO_DOWN, section: "Arpège" },
    ...STAFF_TERMS.map((head) => ({ head, section: "Caractère" })),
  ];
}

/**
 * Sur une ligne @, dans une case : les indications qui s'y écrivent, chacune avec son sens. Au-dessus
 * de la règle, celles du système (la section suivante, un point d'orgue, un tempo) ; sous une
 * portée, les siennes (sur une portée à cordes, le médiator, l'étouffé et le vibrato plutôt que la
 * pédale). Une indication déjà écrite dans la case est remplacée.
 */
function markLine(ctx: CompletionContext, lines: string[], L: number, C: number, body: number, head?: [number, number]): CompletionResult | null {
  const line = lines[L];
  if (!line.startsWith("@") || line.startsWith(CHORD_LINE) || line.startsWith("@l") || C < 1) return null;
  const sys = systemOf(lines, L, body);
  if (!sys || L === sys.ruler) return null;
  const c = caseAt(lines[sys.ruler], C);
  if (!c) return null;
  // une indication venue d'avant qui déborde dans la case (une section posée sur la barre) : on
  // écrit après elle ; au milieu d'un signe qui dure, rien
  const tokens = markTokens(line);
  const before = tokens.find((t) => t.col < c.start && t.col + t.text.length > c.start);
  const start = before ? before.col + before.text.length + 1 : c.start;
  if (start >= c.end || C < start - 1) return null;
  const here = tokens.find((t) => t.col >= start && t.col < c.end);
  const system = L < sys.ruler;
  const used = new Set([...lines.join("\n").matchAll(/^@.*?\[([A-Z])\]/gm)].flatMap((m) => [...m[0].matchAll(/\[([A-Z])\]/g)].map((x) => x[1])));
  const next = [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((x) => !used.has(x));
  const strings = !system && !!stringsAt(lines, sys, L, head);
  const origin = ctx.pos;
  // ce qui a le plus de chances de venir en tête : après un soufflet, le soufflet inverse (crescendo
  // puis decrescendo) ; sur une portée à cordes, ses signes et l'arpège avant les nuances
  const prev = [...tokens].reverse().find((t) => t.col + t.text.length <= start);
  const after = prev && isHairpin(prev.text) ? (prev.text[0] === "<" ? ">" : "<") : undefined;
  const first = [...(after ? ["Soufflets et liaisons"] : []), ...(strings ? ["Cordes", "Arpège"] : [])];
  const sectionOf = (name: string) => (first.includes(name) ? { name, rank: -first.length + first.indexOf(name) } : SECTIONS[name]);
  const options: Completion[] = marksFor(system, strings, next).map((m, k) => ({
    label: m.label ?? m.head,
    detail: markMeaning(m.label ?? m.head, system),
    section: sectionOf(m.section),
    boost: m.head === after && m.fill ? 99 : -k,
    type: "keyword",
    apply: (view: EditorView, _c: Completion, from: number, to: number) => {
      // ce qui a été tapé depuis l'ouverture de la liste est retiré, puis l'indication s'écrit à sa case
      const doc = view.state.doc;
      const text = doc.sliceString(0, from) + doc.sliceString(Math.max(from, to));
      const ls = text.split("\n");
      const l = doc.lineAt(origin);
      const s = systemOf(ls, l.number - 1);
      if (!s) return;
      const was = markTokens(ls[l.number - 1]).find((t) => t.col >= start && t.col < c.end);
      rewrite(view, writeMark(ls, s, l.number - 1, start, was ? was.col - start + was.text.length : 0, m));
    },
  }));
  // ce qui est déjà écrit dans la case : le début d'une indication qu'on tape, qui filtre la liste ;
  // sinon une indication entière, que la liste remplacera
  const from = here ? ctx.state.doc.lineAt(ctx.pos).from + here.col : ctx.pos;
  const typed = here ? line.slice(here.col, C) : "";
  const filter = !!typed && options.some((o) => o.label !== typed && o.label.startsWith(typed));
  return { from: filter ? Math.min(from, ctx.pos) : ctx.pos, options: ranked(options), filter };
}

function notes(ctx: CompletionContext, lines: string[], L: number, C: number, body: number, names: NoteNames, head?: [number, number]): CompletionResult | null {
  const sys = systemOf(lines, L, body);
  if (!sys || L <= sys.ruler) return null;
  const line = lines[L];
  if (line.trimStart().startsWith("@") || /^[─━\-=═+┼╪|\s]+$/.test(line.trim()) || !line.includes("|")) return null;
  const ruler = lines[sys.ruler];
  if (C < ruler.indexOf("|") + 1) return null;
  const c = caseAt(ruler, C);
  if (!c) return null;
  const content = line.slice(c.start, c.end).trim();
  const lead = line.slice(c.start, c.end).length - line.slice(c.start, c.end).trimStart().length;
  const here = inspect(ctx.state.doc.toString(), ctx.pos, names);
  if (here.string !== undefined) {
    const strs = stringsAt(lines, sys, L, head);
    return strs ? stringCells(ctx, lines, L, c, content, lead, here.string, strs, names) : null;
  }
  const octave = here.octave;
  const name = (n: number) => (octave === undefined ? "" : noteName(midiOf(octave, n), names));
  const options: Completion[] = [];
  const note = (text: string, detail: string, section: string) => options.push({ label: text, detail, section: SECTIONS[section], boost: -options.length, type: "variable", apply: inCase(text, ctx.pos) });
  for (let n = 1; n <= 12; n++) note(String(n), name(n), "Notes");
  note("-", "la note continue", "Notes");
  const n = Number(content);
  if (/^\d+$/.test(content) && n >= 1 && n <= 12) {
    FINGERS.forEach((f, k) => note(`${n}_${k + 1}`, `doigt ${k + 1} : ${f}`, "Doigté"));
    for (const d of [1, 2, -1, -2]) note(`${n}~${wrap(n + d)}`, `trille avec ${name(wrap(n + d)) || wrap(n + d)}`, "Trille");
    for (const d of [1, -1, 2, -2]) note(`${wrap(n + d)}'${n}`, `petite note ${name(wrap(n + d)) || wrap(n + d)} devant`, "Petite note");
  }
  // ce qui est déjà tapé dans la case filtre la liste
  const from = ctx.state.doc.lineAt(ctx.pos).from + c.start + lead;
  return { from: Math.min(from, ctx.pos), options, validFor: /^[\d_~'-]*$/ };
}

/** Les cordes des grilles du morceau : celles de sa première guitare, d'après `parts:` dans l'en-tête. */
const gridOf = (lines: string[], head?: [number, number]) => gridStrings(headerParts(lines, head).map((p) => p.strings));

/**
 * Sur une ligne @c, dans une case : l'accord des notes qui sonnent là, par son nom Prisma, son nom
 * anglais ou ses notes. Sur une grille tapée seule (« x02210 »), l'accord qu'elle joue sur la
 * guitare du morceau, avec elle ; sur un accord tapé sans grille, l'accord et sa grille.
 */
function chordAt(ctx: CompletionContext, lines: string[], L: number, C: number, body: number, head?: [number, number]): CompletionResult | null {
  if (!/^@c(\s|$)/.test(lines[L])) return null;
  const sys = systemOf(lines, L, body);
  if (!sys || L >= sys.ruler) return null;
  const ruler = lines[sys.ruler];
  const line = lines[L];
  // le mot sous le curseur, ou qui finit au curseur : il commence sur sa case, même s'il en déborde
  // (« x02210 » est plus long qu'une case) ; ailleurs, la case du curseur, vide
  let s0 = Math.min(C, line.length);
  while (s0 > 0 && line[s0 - 1] !== " ") s0--;
  const inWord = s0 < Math.min(C, line.length) || (C < line.length && line[C] !== " ");
  const c = caseAt(ruler, inWord ? s0 : C);
  if (!c) return null;
  const start = inWord ? s0 : c.start;
  const word = inWord ? line.slice(s0).match(/^\S*/)![0] : line[c.start - 1] && line[c.start - 1] !== " " ? "" : (line.slice(c.start).match(/^\S*/)?.[0] ?? "");
  const strs = gridOf(lines, head);
  // les notes, de la basse vers l'aigu, chacune une fois : celles de la grille tapée, sinon celles qui sonnent ici
  const typed = word && !word.includes(SHAPE_SEPARATOR) ? parseShape(word) : undefined;
  const shaped = typed && typed.length === strs.open.length ? typed : undefined;
  const notes = shaped ? shapeNotes(shaped, strs) : [...new Set(soundingAt(lines, sys, start).map((m) => (m % 12) + 1))];
  const named = !shaped && word && !word.includes(SHAPE_SEPARATOR) ? chordNotes(word) : undefined;
  let words: { w: string; detail?: string }[];
  if (shaped) words = [chordPrismaName(notes), chordName(notes), chordPrismaText(notes)].filter((w): w is string => !!w).map((w, i) => ({ w: w + SHAPE_SEPARATOR + word, detail: i === 0 ? "l'accord que joue cette grille" : undefined }));
  else if (named) {
    const grid = chordShape(named, strs);
    words = grid ? [{ w: word + SHAPE_SEPARATOR + shapeText(grid), detail: "l'accord, et sa grille pour la guitare" }] : [];
  } else {
    if (notes.length < 2) return null;
    words = [chordPrismaName(notes), chordName(notes), chordPrismaText(notes)].filter((w): w is string => !!w).map((w, i) => ({ w, detail: i === 0 ? "l'accord des notes qui sonnent ici" : undefined }));
  }
  if (!words.length) return null;
  const from = ctx.state.doc.lineAt(ctx.pos).from + Math.min(start, line.length);
  // l'accord remplace le mot de sa case ; les accords suivants gardent la leur (le système s'élargit s'il le faut)
  const options: Completion[] = words.map(({ w, detail }, i) => ({
    label: w,
    type: "constant",
    boost: -i,
    detail,
    apply: (view: EditorView) => rewrite(view, writeChord(view.state.doc.toString().split("\n"), sys, L, start, word.length, w)),
  }));
  return { from, to: from + (line.length >= start ? word.length : 0), options, filter: false };
}

/** La complétion, avec le nom des notes choisi. */
/** Ce que la complétion propose au curseur (la source de la liste ; exportée pour les tests). */
export function completionSource(names: () => NoteNames) {
  return (ctx: CompletionContext): CompletionResult | null => {
    const fake = { state: ctx.state } as EditorView;
    const { lines, head, body } = read(fake);
    const l = ctx.state.doc.lineAt(ctx.pos);
    const L = l.number - 1;
    const C = ctx.pos - l.from;
    const line = lines[L];
    if (head && L > head[0] && L < head[1]) return instruments(ctx, line, names()) ?? partNames(ctx, line) ?? headerKeys(ctx, line, lines, head);
    if (head && L <= head[1]) return null;
    if (line.startsWith("#")) return null;
    const starts = lineStarts(ctx, lines, L, line.slice(0, C), body, head, names());
    if (starts) return starts;
    if (!ctx.explicit) return null;
    return chordAt(ctx, lines, L, C, body, head) ?? markLine(ctx, lines, L, C, body, head) ?? rulerEnd(ctx, lines, L, C) ?? notes(ctx, lines, L, C, body, names(), head);
  };
}

export function completion(names: () => NoteNames) {
  return autocompletion({ override: [completionSource(names)], icons: false });
}
