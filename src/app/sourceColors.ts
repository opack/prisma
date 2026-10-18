/**
 * Coloration du texte .prisma dans l'éditeur : l'en-tête, la règle de comptage, les barres, les
 * traits et leurs noms de parties, les lignes @ (nuances, soufflets, pédale, sections, accords,
 * paroles), et sur les lignes de notes ce qui s'ajoute à une note (petite note, trille, doigté).
 * En option, chaque ligne de notes prend le fond de son couloir d'octave, comme sur la partition,
 * et son numéro d'octave celui de l'onglet.
 *
 * La lecture est indulgente, comme celle de la barre de statut : un texte faux se colore au mieux.
 */
import type { Extension } from "@codemirror/state";
import { RangeSetBuilder } from "@codemirror/state";
import { Decoration, EditorView, ViewPlugin } from "@codemirror/view";
import type { DecorationSet, ViewUpdate } from "@codemirror/view";
import { isArpeggioSign, isArticulationSign, isDynamic, isHairpin, isPedalSign, isPedalText, isSlur, isStructureSign, FERMATA, octaveOffset } from "../core/index.ts";
import { parseOctaveLabel } from "../core/pitch.ts";
import { CHORD_LINE, isRuler, markTokens, parseRule } from "../core/prisma-parse.ts";
import { octaveTint } from "./colors.ts";
import type { OctaveColors } from "./colors.ts";

/** La coloration : les signes et les couloirs d'octave, les signes seuls, ou aucune. */
export type SourceColors = "octaves" | "signs" | "none";

// sans palette, un couloir sur deux en gris, comme sur la partition
const BAND = "#f1f2ee";
const TAB = "#e6e8e3";

/** Ce qui se colore : une classe sur une plage de la ligne (colonnes de début et de fin). */
type Span = { from: number; to: number; cls: string; style?: string };
/** Une ligne lue : ses plages, et le fond de son couloir d'octave. */
type Line = { spans: Span[]; band?: string };

/** L'état d'une ligne à l'autre : l'en-tête, l'octave en cours, le rang du couloir dans la portée. */
type State = { head: "before" | "in" | "after"; octave?: number; lane: number };

const mark = (cls: string) => Decoration.mark({ class: cls });
const marks = new Map<string, Decoration>();
const markOf = (cls: string, style?: string) => {
  if (style) return Decoration.mark({ class: cls, attributes: { style } });
  let d = marks.get(cls);
  if (!d) marks.set(cls, (d = mark(cls)));
  return d;
};

/** Les barres d'une ligne (« | », « || », « :|| »…) : leurs plages. */
function bars(text: string, from: number, out: Span[]) {
  for (const m of text.slice(from).matchAll(/:?\|+:?/g)) {
    const at = from + m.index;
    out.push({ from: at, to: at + m[0].length, cls: m[0] === "|" ? "cm-p-bar" : "cm-p-barline" });
  }
}

/** Le contenu d'une case de notes : petites notes, note, trille, doigté, tenue. */
function cell(text: string, at: number, out: Span[]) {
  for (const m of text.matchAll(/(\d+')|(-\d*)|(~\d*)|(_\d*)|(\d+)/g)) {
    const from = at + m.index;
    const to = from + m[0].length;
    out.push({ from, to, cls: m[1] ? "cm-p-grace" : m[2] ? "cm-p-hold" : m[3] ? "cm-p-trill" : m[4] ? "cm-p-finger" : "cm-p-note" });
  }
}

/** Une indication d'une ligne @, selon sa sorte. */
function markClass(t: string) {
  if (isDynamic(t)) return "cm-p-dynamic";
  if (isHairpin(t)) return "cm-p-hairpin";
  if (isPedalSign(t) || isPedalText(t)) return "cm-p-pedal";
  if (isStructureSign(t)) return "cm-p-section";
  if (isSlur(t) || isArpeggioSign(t) || isArticulationSign(t) || t === FERMATA) return "cm-p-sign";
  return "cm-p-text";
}

function readLine(text: string, s: State, mode: SourceColors, palette: OctaveColors): Line {
  const spans: Span[] = [];
  const t = text.trim();
  const line: Line = { spans };

  // l'en-tête, entre deux « --- » en tête du texte
  if (s.head !== "after") {
    if (s.head === "before" && t === "") return line;
    if (t === "---") {
      s.head = s.head === "before" ? "in" : "after";
      spans.push({ from: 0, to: text.length, cls: "cm-p-fence" });
      return line;
    }
    if (s.head === "before") s.head = "after";
    else {
      if (t.startsWith("#")) spans.push({ from: 0, to: text.length, cls: "cm-p-comment" });
      const m = text.match(/^(\s*)([^\s:]+)(\s*:)/);
      if (m) {
        const key = m[1].length;
        spans.push({ from: key, to: key + m[2].length, cls: "cm-p-key" });
        // les instruments de « parts: », entre parenthèses
        if (m[2] === "parts") for (const p of text.matchAll(/\([^()]*\)/g)) spans.push({ from: p.index, to: p.index + p[0].length, cls: "cm-p-instrument" });
      }
      return line;
    }
  }

  if (t === "") {
    s.octave = undefined;
    return line;
  }
  if (t.startsWith("#")) {
    spans.push({ from: 0, to: text.length, cls: "cm-p-comment" });
    return line;
  }

  // la règle de comptage : le numéro de mesure, les temps et leurs découpages
  if (isRuler(text)) {
    s.octave = undefined;
    s.lane = 0;
    const pipe = text.indexOf("|");
    spans.push({ from: 0, to: pipe, cls: "cm-p-measure" });
    bars(text, pipe, spans);
    for (const m of text.slice(pipe).matchAll(/\d+|[*.,]/g)) {
      const at = pipe + m.index;
      spans.push({ from: at, to: at + m[0].length, cls: /\d/.test(m[0]) ? "cm-p-beat" : "cm-p-sub" });
    }
    return line;
  }

  // un trait, et le nom de partie qu'il porte
  let rule: ReturnType<typeof parseRule>;
  try {
    rule = parseRule(text, 0);
  } catch {
    rule = { double: false };
  }
  if (rule) {
    s.octave = undefined;
    s.lane = 0;
    spans.push({ from: 0, to: text.length, cls: "cm-p-rule" });
    if (rule.name) {
      const at = text.indexOf(" " + rule.name + " ") + 1;
      if (at > 0) spans.push({ from: at, to: at + rule.name.length, cls: "cm-p-name" });
    }
    return line;
  }

  // les lignes @ : accords, paroles, indications
  if (t.startsWith("@")) {
    const lead = text.indexOf("@");
    const kind = text.startsWith(CHORD_LINE, lead) && /^@c(\s|$)/.test(t) ? "chord" : /^@l(\s|$)/.test(t) ? "lyric" : "mark";
    const size = kind === "mark" ? 1 : 2;
    spans.push({ from: lead, to: lead + size, cls: "cm-p-at" });
    // les barres recopiées pour se repérer
    bars(text, lead + size, spans);
    if (kind === "mark") {
      for (const k of markTokens(text.slice(lead))) spans.push({ from: lead + k.col, to: lead + k.col + k.text.length, cls: markClass(k.text) });
    } else {
      for (const m of text.slice(lead + size).matchAll(/[^\s|]+/g)) {
        const at = lead + size + m.index;
        spans.push({ from: at, to: at + m[0].length, cls: kind === "chord" ? "cm-p-chord" : /^-[-|]*$/.test(m[0]) ? "cm-p-hold" : "cm-p-lyric" });
      }
    }
    return line;
  }

  // une ligne de notes : son octave, ses barres, ses cases
  const pipe = text.indexOf("|");
  if (pipe < 0) return line;
  const label = text.slice(0, pipe).trim();
  const o = label ? parseOctaveLabel(label) : undefined;
  if (o !== undefined) {
    if (s.octave !== undefined) s.lane++;
    s.octave = o;
  }
  const tint = mode === "octaves" && s.octave !== undefined ? octaveTint(palette, octaveOffset(s.octave)) : undefined;
  if (mode === "octaves" && s.octave !== undefined) line.band = tint?.band ?? (s.lane % 2 === 1 ? BAND : undefined);
  if (label) {
    const at = text.indexOf(label);
    spans.push({ from: at, to: at + label.length, cls: "cm-p-octave", style: mode === "octaves" && o !== undefined ? `background-color: ${tint?.tab ?? TAB}` : undefined });
  }
  bars(text, pipe, spans);
  // les cases, entre deux barres
  for (const m of text.slice(pipe).matchAll(/[^|:]+/g)) cell(m[0], pipe + m.index, spans);
  return line;
}

/** Les décorations des lignes visibles ; l'état se lit depuis le début du texte. */
function build(view: EditorView, mode: SourceColors, palette: OctaveColors): DecorationSet {
  const b = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const s: State = { head: "before", lane: 0 };
  const last = view.visibleRanges.length ? doc.lineAt(view.visibleRanges[view.visibleRanges.length - 1].to).number : 0;
  const shown = (n: number) => view.visibleRanges.some((r) => n >= doc.lineAt(r.from).number && n <= doc.lineAt(r.to).number);
  for (let n = 1; n <= last; n++) {
    const l = doc.line(n);
    const read = readLine(l.text.replace(/\t/g, " "), s, mode, palette);
    if (!shown(n)) continue;
    if (read.band) b.add(l.from, l.from, Decoration.line({ attributes: { style: `background-color: ${read.band}` } }));
    // les plages, dans l'ordre, sans chevauchement (une plus large posée avant reste seule)
    let end = 0;
    for (const sp of read.spans.sort((a, c) => a.from - c.from || c.to - a.to)) {
      if (sp.from < end || sp.to <= sp.from) continue;
      b.add(l.from + sp.from, l.from + Math.min(sp.to, l.length), markOf(sp.cls, sp.style));
      end = sp.to;
    }
  }
  return b.finish();
}

const theme = EditorView.baseTheme({
  ".cm-p-fence, .cm-p-comment, .cm-p-at, .cm-p-sub, .cm-p-hold, .cm-p-rule": { color: "#9a9b95" },
  ".cm-p-comment": { fontStyle: "italic" },
  ".cm-p-key": { color: "#1f5fa8" },
  ".cm-p-instrument, .cm-p-chord": { color: "#0f7b6c" },
  ".cm-p-measure": { fontWeight: "700" },
  ".cm-p-beat": { color: "#4a4f54", fontWeight: "600" },
  ".cm-p-bar": { color: "#aeafa9" },
  ".cm-p-barline": { color: "#55574f", fontWeight: "700" },
  ".cm-p-name": { color: "#24292e", fontWeight: "700" },
  ".cm-p-octave": { fontWeight: "700", borderRadius: "2px" },
  ".cm-p-grace": { color: "#7a4fb0" },
  ".cm-p-trill": { color: "#0f7b6c" },
  ".cm-p-finger": { color: "#b35900" },
  ".cm-p-dynamic, .cm-p-hairpin": { color: "#b0285a", fontWeight: "600" },
  ".cm-p-pedal": { color: "#2f6f9f" },
  ".cm-p-section": { color: "#1f5fa8", fontWeight: "700" },
  ".cm-p-sign": { color: "#7a4fb0" },
  ".cm-p-text, .cm-p-lyric": { fontStyle: "italic", color: "#4a4f54" },
});

/** L'extension de la coloration choisie, avec la palette des octaves. */
export function sourceColors(mode: SourceColors, palette: OctaveColors): Extension {
  if (mode === "none") return [];
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view, mode, palette);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.viewportChanged) this.decorations = build(u.view, mode, palette);
      }
    },
    { decorations: (p) => p.decorations },
  );
  return [plugin, theme];
}
