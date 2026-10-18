/**
 * La complétion de l'éditeur (Ctrl+Espace) : ce qui peut s'écrire au curseur, selon sa place.
 *
 * - Dans l'en-tête : les clés pas encore écrites, et dans `parts:`, entre parenthèses, les instruments.
 * - En début de ligne : une ligne `@` (indications), `@l` (paroles), `@c` (accords), et sous la
 *   règle d'un système, une nouvelle ligne de notes, avec son octave et les barres de la règle.
 * - Dans une case d'une ligne de notes : les notes (avec leur nom), la tenue, et sur une note, ce
 *   qui s'y ajoute : un doigté, une trille, une petite note devant.
 * - Au bout d'une règle de comptage : le temps suivant, coupé ou non, ou la fin de la mesure.
 *
 * L'écriture garde l'alignement des colonnes (voir complete.ts). Les notes et la règle ne
 * s'offrent qu'à la demande : taper un numéro ne doit rien ouvrir. L'en-tête et les instruments
 * s'offrent aussi pendant la frappe.
 */
import type { Completion, CompletionContext, CompletionResult, CompletionSection } from "@codemirror/autocomplete";
import { autocompletion } from "@codemirror/autocomplete";
import type { EditorView } from "@codemirror/view";
import { FRONTMATTER, INSTRUMENTS, DEFAULT_CELL, inspect, midiOf, noteName } from "../core/index.ts";
import type { NoteNames } from "../core/index.ts";
import { isRuler } from "../core/prisma-parse.ts";
import { caseAt, extendRuler, noteLine, rulerSuffixes, systemOf, writeCase } from "./complete.ts";
import type { Rewrite } from "./complete.ts";

const FINGERS = ["pouce", "index", "majeur", "annulaire", "auriculaire"];
/** Les groupes de la liste, dans cet ordre. */
const SECTIONS: Record<string, CompletionSection> = Object.fromEntries(["Notes", "Doigté", "Trille", "Petite note", "Ligne @", "Ligne de notes"].map((name, rank) => [name, { name, rank }]));
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
  return { from: ctx.pos - m[2].length, options, validFor: /^[\w-]*$/ };
}

function instruments(ctx: CompletionContext, line: string): CompletionResult | null {
  if (!/^\s*parts\s*:/.test(line)) return null;
  const before = line.slice(0, ctx.pos - ctx.state.doc.lineAt(ctx.pos).from);
  const m = before.match(/\(\s*([a-z-]*)$/i);
  if (!m) return null;
  const closed = /^\s*[a-z-]*\s*\)/i.test(line.slice(before.length));
  const options: Completion[] = INSTRUMENTS.map((name) => ({ label: name, type: "enum", apply: closed ? name : name + ")" }));
  return { from: ctx.pos - m[1].length, options, validFor: /^[a-z-]*$/i };
}

function lineStarts(ctx: CompletionContext, lines: string[], L: number, before: string, body: number): CompletionResult | null {
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
    add("", "une ligne de plus, dans l'octave de la ligne du dessus", 1);
    for (let o = 4; o >= -4; o--) add(label(o), o === 0 ? "l'octave du do central" : `${Math.abs(o)} octave${Math.abs(o) > 1 ? "s" : ""} ${o > 0 ? "au-dessus" : "au-dessous"} du do central`, 0);
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

function notes(ctx: CompletionContext, lines: string[], L: number, C: number, body: number, names: NoteNames): CompletionResult | null {
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
  const octave = inspect(ctx.state.doc.toString(), ctx.pos, names).octave;
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

/** La complétion, avec le nom des notes choisi. */
export function completion(names: () => NoteNames) {
  const source = (ctx: CompletionContext): CompletionResult | null => {
    const fake = { state: ctx.state } as EditorView;
    const { lines, head, body } = read(fake);
    const l = ctx.state.doc.lineAt(ctx.pos);
    const L = l.number - 1;
    const C = ctx.pos - l.from;
    const line = lines[L];
    if (head && L > head[0] && L < head[1]) return instruments(ctx, line) ?? headerKeys(ctx, line, lines, head);
    if (head && L <= head[1]) return null;
    if (line.startsWith("#")) return null;
    const starts = lineStarts(ctx, lines, L, line.slice(0, C), body);
    if (starts) return starts;
    if (!ctx.explicit) return null;
    return rulerEnd(ctx, lines, L, C) ?? notes(ctx, lines, L, C, body, names());
  };
  return autocompletion({ override: [source], icons: false });
}
