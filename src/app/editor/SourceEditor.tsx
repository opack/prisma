/**
 * L'éditeur du texte .prisma (CodeMirror) : les numéros de ligne en marge (celui de la ligne du
 * curseur en évidence, celui d'une erreur en rouge), le texte, puis une barre de statut : la place
 * du curseur dans le texte et dans la musique, et le sens du signe qu'il pointe. Le texte est relu
 * pendant la frappe : une erreur se souligne à sa place, son message au survol.
 */
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import { Compartment, EditorSelection, EditorState, RangeSet, StateField } from "@codemirror/state";
import type { Text } from "@codemirror/state";
import { EditorView, GutterMarker, gutterLineClass, highlightActiveLineGutter, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { linter, nextDiagnostic, previousDiagnostic, setDiagnosticsEffect } from "@codemirror/lint";
import type { Diagnostic } from "@codemirror/lint";
import { inspect, octaveOffset, parseErrors } from "../../core/index.ts";
import type { NameDisplay } from "../options/options.ts";
import { writtenNames } from "../options/options.ts";
import { MiniKeyboard } from "../ui/keyboard/MiniKeyboard.tsx";
import { staffNames } from "../playback/staves.ts";
import { messageNode } from "./message.tsx";
import { completion } from "./completion.ts";
import { sourceColors } from "./sourceColors.ts";
import type { SourceColors } from "./sourceColors.ts";
import type { OctaveColors } from "../score/colors.ts";

/** Les mots du panneau de recherche et remplacement de CodeMirror. */
const SEARCH_PHRASES: Record<string, string> = {
  Find: "Rechercher",
  Replace: "Remplacer par",
  next: "suivant",
  previous: "précédent",
  all: "tout sélectionner",
  "match case": "respecter la casse",
  regexp: "expression régulière",
  "by word": "mot entier",
  replace: "remplacer",
  "replace all": "tout remplacer",
  close: "fermer",
  "current match": "occurrence",
  "on line": "à la ligne",
};

/** Ce que l'application demande à l'éditeur. */
export type EditorHandle = {
  focus(): void;
  /** Place le curseur sur une ligne et une colonne (à partir de 1), et la montre ; focus : l'éditeur prend la main (le clavier). */
  goTo(line: number, column?: number, focus?: boolean): void;
  /**
   * Remplace le texte par text (une retouche faite ailleurs que dans l'éditeur), comme une frappe :
   * seul ce qui change est réécrit, Ctrl+Z le défait ; le curseur va à la ligne et la colonne données.
   */
  replace(text: string, line: number, column: number): void;
};

type Props = {
  value: string;
  onChange: (text: string) => void;
  editor: Ref<EditorHandle>;
  noteNames: NameDisplay;
  /** La coloration du texte, et la palette des couloirs d'octave (celle de la partition). */
  colors: SourceColors;
  palette: OctaveColors;
  /** À chaque relecture du texte : ses erreurs (message avec sa place, ligne et colonne), dans l'ordre du texte. */
  onCheck?: (errors: { message: string; line: number; column: number }[]) => void;
  /** Le curseur a bougé : sa ligne et sa colonne (à partir de 1), dans le texte tel qu'il est. */
  onCaret?: (line: number, column: number, text: string) => void;
  /** Ce qui flotte au-dessus du texte (le bouton de mise en page). */
  children?: ReactNode;
};

/** Un signe trop long (une liaison, un soufflet sur plusieurs mesures) s'abrège : ses 9 premiers caractères. */
const short = (t: string) => (t.length > 10 ? t.slice(0, 9) + "…" : t);

/**
 * Les erreurs de lecture du texte, toutes en une passe : chacune soulignée du signe fautif jusqu'à
 * la fin de son mot (une barre seule pour une barre), ou toute la ligne quand l'erreur est celle de
 * la ligne.
 */
export function diagnose(doc: Text): Diagnostic[] {
  return parseErrors(doc.toString()).map((e) => {
    const l = doc.line(Math.max(1, Math.min(e.line, doc.lines)));
    let from = l.from;
    let to = l.to;
    if (e.exact) {
      const at = Math.min(e.column - 1, l.length);
      const rest = l.text.slice(at);
      const word = rest.startsWith("|") ? 1 : (rest.match(/^[^\s|]+/)?.[0].length ?? 0);
      from = l.from + at;
      to = from + word;
    }
    // un signe absent (une case vide, la fin de la ligne) : un caractère, pour que le soulignement se voie
    if (to === from) {
      if (to < l.to) to++;
      else from = Math.max(l.from, from - 1);
    }
    return { from, to, severity: "error" as const, message: e.reason, renderMessage: () => messageNode(e.reason) };
  });
}

// la ligne de l'erreur, marquée dans la marge des numéros
const errorMarker = new (class extends GutterMarker {
  elementClass = "cm-error-line";
})();
const errorLineField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    if (tr.docChanged) set = set.map(tr.changes);
    for (const e of tr.effects)
      if (e.is(setDiagnosticsEffect)) {
        const lines = [...new Set(e.value.map((d) => tr.state.doc.lineAt(d.from).from))].sort((a, b) => a - b);
        set = RangeSet.of(lines.map((at) => errorMarker.range(at)));
      }
    return set;
  },
  provide: (f) => gutterLineClass.from(f),
});

// Ctrl+Entrée met la partition en page (raccourci de l'application) : l'éditeur n'en fait rien
const keys = [
  ...defaultKeymap.filter((k) => k.key !== "Mod-Enter"),
  // d'une erreur à l'autre
  { key: "F8", run: nextDiagnostic },
  { key: "Shift-F8", run: previousDiagnostic },
];

export function SourceEditor({ value, onChange, editor, noteNames, colors, palette, onCheck, onCaret, children }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const coloring = useRef(new Compartment()).current;
  const [caret, setCaret] = useState(0);
  // les rappels changent à chaque rendu : l'éditeur, créé une fois, passe par cette référence
  const changed = useRef(onChange);
  changed.current = onChange;
  const checked = useRef(onCheck);
  checked.current = onCheck;
  const moved = useRef(onCaret);
  moved.current = onCaret;
  const names = useRef(noteNames);
  names.current = noteNames;

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          errorLineField,
          linter(
            (v) => {
              const found = diagnose(v.state.doc);
              checked.current?.(
                found.map((d) => {
                  const l = v.state.doc.lineAt(d.from);
                  const column = d.from - l.from + 1;
                  return { message: `ligne ${l.number}, col. ${column} : ${d.message}`, line: l.number, column };
                }),
              );
              return found;
            },
            { delay: 300 },
          ),
          coloring.of(sourceColors(colors, palette)),
          completion(() => writtenNames(names.current)),
          history(),
          drawSelection(),
          search({ top: true }),
          // le panneau de recherche (Ctrl+F), en français
          EditorState.phrases.of(SEARCH_PHRASES),
          highlightSelectionMatches(),
          keymap.of([...keys, ...historyKeymap, ...searchKeymap]),
          EditorView.contentAttributes.of({ "aria-label": "Source .prisma", spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) changed.current(u.state.doc.toString());
            if (u.docChanged || u.selectionSet) {
              const head = u.state.selection.main.head;
              setCaret(head);
              const l = u.state.doc.lineAt(head);
              moved.current?.(l.number, head - l.from + 1, u.state.doc.toString());
            }
          }),
        ],
      }),
    });
    view.current = v;
    return () => {
      v.destroy();
      view.current = null;
    };
  }, []);

  // un texte venu d'ailleurs (un fichier ouvert, une nouvelle partition) remplace celui de l'éditeur
  useEffect(() => {
    const v = view.current;
    if (!v || v.state.doc.toString() === value) return;
    v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value }, selection: EditorSelection.cursor(0) });
  }, [value]);

  useEffect(() => {
    view.current?.dispatch({ effects: coloring.reconfigure(sourceColors(colors, palette)) });
  }, [colors, palette]);

  useImperativeHandle(editor, () => ({
    focus: () => view.current?.focus(),
    replace(text, line, column) {
      const v = view.current;
      if (!v) return;
      const old = v.state.doc.toString();
      let a = 0;
      while (a < old.length && a < text.length && old[a] === text[a]) a++;
      let b = 0;
      while (b < old.length - a && b < text.length - a && old[old.length - 1 - b] === text[text.length - 1 - b]) b++;
      const changes = { from: a, to: old.length - b, insert: text.slice(a, text.length - b) };
      const doc = v.state.update({ changes }).state.doc;
      const l = doc.line(Math.max(1, Math.min(line, doc.lines)));
      const at = Math.min(l.from + column - 1, l.to);
      v.dispatch({ changes, selection: { anchor: at }, effects: EditorView.scrollIntoView(at, { y: "center" }), userEvent: "input.retouch" });
    },
    goTo(line, column = 1, focus = true) {
      const v = view.current;
      if (!v) return;
      const l = v.state.doc.line(Math.max(1, Math.min(line, v.state.doc.lines)));
      const at = Math.min(l.from + Math.max(0, column - 1), l.to);
      v.dispatch({ selection: EditorSelection.range(Math.min(at + 1, l.to), at), effects: EditorView.scrollIntoView(at, { y: "center" }) });
      if (focus) v.focus();
    },
  }));

  const info = useMemo(() => inspect(value, Math.min(caret, value.length), writtenNames(noteNames)), [value, caret, noteNames]);

  const where: string[] = [];
  if (info.section) where.push(`section ${info.section}`);
  if (info.bar) where.push(`mesure ${info.bar}${info.beat ? `, temps ${info.beat}` : ""}${info.cell && info.cell.count > 1 ? ` (case ${info.cell.index}/${info.cell.count})` : ""}`);
  if (info.staff !== undefined && info.parts) {
    const name = staffNames(info.parts)[info.staff];
    if (name && (info.parts.length > 1 || info.parts[0].staves > 1)) where.push(name);
  }
  if (info.octave !== undefined) {
    const o = octaveOffset(info.octave);
    where.push(`octave ${o > 0 ? "+" : o < 0 ? "−" : ""}${Math.abs(o)}`);
  }

  return (
    <>
      <div className="relative grid grid-cols-[minmax(0,1fr)] min-h-0">
        {/* editor-host : le crochet des styles de CodeMirror (styles.css) */}
        <div className="editor-host" ref={host} />
        {children}
      </div>
      <div className="flex items-baseline gap-4 min-w-0 px-3 py-[5px] text-[12px] text-muted whitespace-nowrap bg-panel border-t border-line" role="status" aria-live="polite">
        <span className="flex-none">
          Ligne {info.line}, col. {info.column}
          {where.length > 0 && <span> · {where.join(" · ")}</span>}
        </span>
        {info.symbol && (
          <span className="min-w-0 overflow-hidden text-ellipsis text-ink" title={`${short(info.symbol.text)} : ${info.symbol.meaning}`}>
            <code className="px-1 font-mono font-semibold bg-white border border-line rounded-[3px]">{short(info.symbol.text)}</code>
            {noteNames === "keyboard" && (info.symbol.keys || info.symbol.graces) && <MiniKeyboard keys={info.symbol.keys ?? []} trill={info.symbol.trill} graces={info.symbol.graces} />} {info.symbol.meaning}
          </span>
        )}
      </div>
    </>
  );
}
