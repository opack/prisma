/**
 * L'éditeur du texte .prisma (CodeMirror) : les numéros de ligne en marge (celui de la ligne du
 * curseur en évidence, celui d'une erreur en rouge), le texte, puis une barre de statut : la place
 * du curseur dans le texte et dans la musique, et le sens du signe qu'il pointe.
 */
import { useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import type { ReactNode, Ref } from "react";
import { Compartment, EditorSelection, EditorState, RangeSet, StateEffect, StateField } from "@codemirror/state";
import { EditorView, GutterMarker, gutterLineClass, highlightActiveLineGutter, keymap, lineNumbers, drawSelection } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { inspect, octaveOffset } from "../core/index.ts";
import type { NoteNames } from "../core/index.ts";
import { staffNames } from "./staves.ts";
import { sourceColors } from "./sourceColors.ts";
import type { SourceColors } from "./sourceColors.ts";
import type { OctaveColors } from "./colors.ts";

/** Ce que l'application demande à l'éditeur. */
export type EditorHandle = {
  focus(): void;
  /** Place le curseur sur une ligne et une colonne (à partir de 1), et la montre. */
  goTo(line: number, column?: number): void;
};

type Props = {
  value: string;
  onChange: (text: string) => void;
  editor: Ref<EditorHandle>;
  /** Ligne d'une erreur de lecture, marquée dans la marge. */
  errorLine?: number;
  noteNames: NoteNames;
  /** La coloration du texte, et la palette des couloirs d'octave (celle de la partition). */
  colors: SourceColors;
  palette: OctaveColors;
  /** Ce qui flotte au-dessus du texte (le bouton de mise en page). */
  children?: ReactNode;
};

/** Un signe trop long (une liaison, un soufflet sur plusieurs mesures) s'abrège : ses 9 premiers caractères. */
const short = (t: string) => (t.length > 10 ? t.slice(0, 9) + "…" : t);

// la ligne d'une erreur, marquée dans la marge des numéros
const setError = StateEffect.define<number | undefined>();
const errorMarker = new (class extends GutterMarker {
  elementClass = "cm-error-line";
})();
const errorLineField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    for (const e of tr.effects)
      if (e.is(setError)) {
        const n = e.value;
        set = n && n <= tr.state.doc.lines ? RangeSet.of([errorMarker.range(tr.state.doc.line(n).from)]) : RangeSet.empty;
      }
    return tr.docChanged ? set.map(tr.changes) : set;
  },
  provide: (f) => gutterLineClass.from(f),
});

// Ctrl+Entrée met la partition en page (raccourci de l'application) : l'éditeur n'en fait rien
const keys = defaultKeymap.filter((k) => k.key !== "Mod-Enter");

export function SourceEditor({ value, onChange, editor, errorLine, noteNames, colors, palette, children }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const coloring = useRef(new Compartment()).current;
  const [caret, setCaret] = useState(0);
  // les rappels changent à chaque rendu : l'éditeur, créé une fois, passe par cette référence
  const changed = useRef(onChange);
  changed.current = onChange;

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(),
          highlightActiveLineGutter(),
          errorLineField,
          coloring.of(sourceColors(colors, palette)),
          history(),
          drawSelection(),
          search({ top: true }),
          highlightSelectionMatches(),
          keymap.of([...keys, ...historyKeymap, ...searchKeymap]),
          EditorView.contentAttributes.of({ "aria-label": "Source .prisma", spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
          EditorView.updateListener.of((u) => {
            if (u.docChanged) changed.current(u.state.doc.toString());
            if (u.docChanged || u.selectionSet) setCaret(u.state.selection.main.head);
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

  useEffect(() => {
    view.current?.dispatch({ effects: setError.of(errorLine) });
  }, [errorLine, value]);

  useImperativeHandle(editor, () => ({
    focus: () => view.current?.focus(),
    goTo(line, column = 1) {
      const v = view.current;
      if (!v) return;
      const l = v.state.doc.line(Math.max(1, Math.min(line, v.state.doc.lines)));
      const at = Math.min(l.from + Math.max(0, column - 1), l.to);
      v.dispatch({ selection: EditorSelection.range(Math.min(at + 1, l.to), at), effects: EditorView.scrollIntoView(at, { y: "center" }) });
      v.focus();
    },
  }));

  const info = useMemo(() => inspect(value, Math.min(caret, value.length), noteNames), [value, caret, noteNames]);

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
      <div className="editor">
        <div className="editor-host" ref={host} />
        {children}
      </div>
      <div className="status" role="status" aria-live="polite">
        <span className="status-where">
          Ligne {info.line}, col. {info.column}
          {where.length > 0 && <span> · {where.join(" · ")}</span>}
        </span>
        {info.symbol && (
          <span className="status-what" title={`${short(info.symbol.text)} : ${info.symbol.meaning}`}>
            <code>{short(info.symbol.text)}</code> {info.symbol.meaning}
          </span>
        )}
      </div>
    </>
  );
}
