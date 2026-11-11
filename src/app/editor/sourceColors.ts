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
import {
  isArpeggioSign,
  isArticulationSign,
  isEffect,
  isDynamic,
  isHairpin,
  isPedalSign,
  isPedalText,
  isSlur,
  isStructureSign,
  FERMATA,
  octaveOffset,
} from "../../core/index.ts";
import { parseOctaveLabel } from "../../core/pitch.ts";
import { STRING_LANE } from "../../core/locate.ts";
import { CHORD_LINE, isRuler, markTokens, parseRule } from "../../core/prisma-parse.ts";
import { laneTint } from "../score/colors.ts";
import type { LaneColors } from "../score/colors.ts";

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
  let decoration = marks.get(cls);
  if (!decoration) marks.set(cls, (decoration = mark(cls)));
  return decoration;
};

/** Les barres d'une ligne (« | », « || », « :|| »…) : leurs plages. */
function bars(text: string, from: number, out: Span[]) {
  for (const match of text.slice(from).matchAll(/:?\|+:?/g)) {
    const at = from + match.index;
    out.push({ from: at, to: at + match[0].length, cls: match[0] === "|" ? "cm-p-bar" : "cm-p-barline" });
  }
}

/** Le contenu d'une case de notes : petites notes, note, trille, doigté, tenue. */
function cell(text: string, at: number, out: Span[]) {
  for (const match of text.matchAll(/(\d+')|(-\d*)|(~\d*)|(_\d*)|(\d+)/g)) {
    const from = at + match.index;
    const to = from + match[0].length;
    out.push({
      from,
      to,
      cls: match[1] ? "cm-p-grace" : match[2] ? "cm-p-hold" : match[3] ? "cm-p-trill" : match[4] ? "cm-p-finger" : "cm-p-note",
    });
  }
}

/** Une indication d'une ligne @, selon sa sorte. */
function markClass(token: string) {
  if (isDynamic(token)) return "cm-p-dynamic";
  if (isHairpin(token)) return "cm-p-hairpin";
  if (isPedalSign(token) || isPedalText(token)) return "cm-p-pedal";
  if (isStructureSign(token)) return "cm-p-section";
  if (isSlur(token) || isEffect(token) || isArpeggioSign(token) || isArticulationSign(token) || token === FERMATA) return "cm-p-sign";
  return "cm-p-text";
}

function readLine(text: string, state: State, mode: SourceColors, palette: LaneColors): Line {
  const spans: Span[] = [];
  const trimmed = text.trim();
  const line: Line = { spans };

  // l'en-tête, entre deux « --- » en tête du texte
  if (state.head !== "after") {
    if (state.head === "before" && trimmed === "") return line;
    if (trimmed === "---") {
      state.head = state.head === "before" ? "in" : "after";
      spans.push({ from: 0, to: text.length, cls: "cm-p-fence" });
      return line;
    }
    if (state.head === "before") state.head = "after";
    else {
      if (trimmed.startsWith("#")) spans.push({ from: 0, to: text.length, cls: "cm-p-comment" });
      const match = text.match(/^(\s*)([^\s:]+)(\s*:)/);
      if (match) {
        const key = match[1].length;
        spans.push({ from: key, to: key + match[2].length, cls: "cm-p-key" });
        // les instruments de « parts: », entre parenthèses
        if (match[2] === "parts")
          for (const instrument of text.matchAll(/\([^()]*\)/g))
            spans.push({ from: instrument.index, to: instrument.index + instrument[0].length, cls: "cm-p-instrument" });
      }
      return line;
    }
  }

  if (trimmed === "") {
    state.octave = undefined;
    return line;
  }
  if (trimmed.startsWith("#")) {
    spans.push({ from: 0, to: text.length, cls: "cm-p-comment" });
    return line;
  }

  // la règle de comptage : le numéro de mesure, les temps et leurs découpages
  if (isRuler(text)) {
    state.octave = undefined;
    state.lane = 0;
    const pipe = text.indexOf("|");
    spans.push({ from: 0, to: pipe, cls: "cm-p-measure" });
    bars(text, pipe, spans);
    for (const match of text.slice(pipe).matchAll(/\d+|[*.,]/g)) {
      const at = pipe + match.index;
      spans.push({ from: at, to: at + match[0].length, cls: /\d/.test(match[0]) ? "cm-p-beat" : "cm-p-sub" });
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
    state.octave = undefined;
    state.lane = 0;
    spans.push({ from: 0, to: text.length, cls: "cm-p-rule" });
    if (rule.name) {
      const at = text.indexOf(" " + rule.name + " ") + 1;
      if (at > 0) spans.push({ from: at, to: at + rule.name.length, cls: "cm-p-name" });
    }
    return line;
  }

  // les lignes @ : accords, paroles, indications
  if (trimmed.startsWith("@")) {
    const lead = text.indexOf("@");
    const kind = text.startsWith(CHORD_LINE, lead) && /^@c(\s|$)/.test(trimmed) ? "chord" : /^@l(\s|$)/.test(trimmed) ? "lyric" : "mark";
    const size = kind === "mark" ? 1 : 2;
    spans.push({ from: lead, to: lead + size, cls: "cm-p-at" });
    // les barres recopiées pour se repérer
    bars(text, lead + size, spans);
    if (kind === "mark") {
      for (const token of markTokens(text.slice(lead)))
        spans.push({ from: lead + token.col, to: lead + token.col + token.text.length, cls: markClass(token.text) });
    } else {
      for (const match of text.slice(lead + size).matchAll(/[^\s|]+/g)) {
        const at = lead + size + match.index;
        spans.push({
          from: at,
          to: at + match[0].length,
          cls: kind === "chord" ? "cm-p-chord" : /^-[-|]*$/.test(match[0]) ? "cm-p-hold" : "cm-p-lyric",
        });
      }
    }
    return line;
  }

  // une ligne de notes : son octave, ses barres, ses cases
  const pipe = text.indexOf("|");
  if (pipe < 0) return line;
  const label = text.slice(0, pipe).trim();
  // une octave (« 0 », « +1 »), ou une corde (« 1 » à « 9 », jamais un nom d'octave) : chacune sa teinte, comme sur la partition
  const string = /^[1-9]$/.test(label) ? Number(label) : undefined;
  const octaveLane = string !== undefined ? STRING_LANE + string : label ? parseOctaveLabel(label) : undefined;
  if (octaveLane !== undefined) {
    if (state.octave !== undefined) state.lane++;
    state.octave = octaveLane;
  }
  const offset = (lane: number) => (lane >= STRING_LANE ? 4 - (lane - STRING_LANE) : octaveOffset(lane));
  const tint = mode === "octaves" && state.octave !== undefined ? laneTint(palette, offset(state.octave)) : undefined;
  if (mode === "octaves" && state.octave !== undefined) line.band = tint?.band ?? (state.lane % 2 === 1 ? BAND : undefined);
  if (label) {
    const at = text.indexOf(label);
    spans.push({
      from: at,
      to: at + label.length,
      cls: "cm-p-octave",
      style: mode === "octaves" && octaveLane !== undefined ? `background-color: ${tint?.tab ?? TAB}` : undefined,
    });
  }
  bars(text, pipe, spans);
  // les cases, entre deux barres
  for (const match of text.slice(pipe).matchAll(/[^|:]+/g)) cell(match[0], pipe + match.index, spans);
  return line;
}

/** Les décorations des lignes visibles ; l'état se lit depuis le début du texte. */
function build(view: EditorView, mode: SourceColors, palette: LaneColors): DecorationSet {
  const rangeSetBuilder = new RangeSetBuilder<Decoration>();
  const doc = view.state.doc;
  const state: State = { head: "before", lane: 0 };
  const last = view.visibleRanges.length ? doc.lineAt(view.visibleRanges[view.visibleRanges.length - 1].to).number : 0;
  const shown = (lineNumber: number) =>
    view.visibleRanges.some((range) => lineNumber >= doc.lineAt(range.from).number && lineNumber <= doc.lineAt(range.to).number);
  for (let lineNumber = 1; lineNumber <= last; lineNumber++) {
    const line = doc.line(lineNumber);
    const read = readLine(line.text.replace(/\t/g, " "), state, mode, palette);
    if (!shown(lineNumber)) continue;
    if (read.band) rangeSetBuilder.add(line.from, line.from, Decoration.line({ attributes: { style: `background-color: ${read.band}` } }));
    // les plages, dans l'ordre, sans chevauchement (une plus large posée avant reste seule)
    let end = 0;
    for (const span of read.spans.sort((first, second) => first.from - second.from || second.to - first.to)) {
      if (span.from < end || span.to <= span.from) continue;
      rangeSetBuilder.add(line.from + span.from, line.from + Math.min(span.to, line.length), markOf(span.cls, span.style));
      end = span.to;
    }
  }
  return rangeSetBuilder.finish();
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
export function sourceColors(mode: SourceColors, palette: LaneColors): Extension {
  if (mode === "none") return [];
  const plugin = ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = build(view, mode, palette);
      }
      update(viewUpdate: ViewUpdate) {
        if (viewUpdate.docChanged || viewUpdate.viewportChanged) this.decorations = build(viewUpdate.view, mode, palette);
      }
    },
    { decorations: (instance) => instance.decorations },
  );
  return [plugin, theme];
}
