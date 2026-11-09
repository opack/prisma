/**
 * Les briques CodeMirror de l'éditeur du texte .prisma : son thème (CodeMirror le limite à
 * l'éditeur), le panneau de recherche en français, les erreurs de lecture soulignées et marquées
 * dans la marge, les touches.
 */
import { RangeSet, StateField } from "@codemirror/state";
import type { Text } from "@codemirror/state";
import { EditorView, GutterMarker, gutterLineClass } from "@codemirror/view";
import { defaultKeymap } from "@codemirror/commands";
import { nextDiagnostic, previousDiagnostic, setDiagnosticsEffect } from "@codemirror/lint";
import type { Diagnostic } from "@codemirror/lint";
import { parseErrors } from "../../core/index.ts";
import { messageNode } from "./message.ts";

/**
 * L'allure de l'éditeur, dans son thème (CodeMirror le limite à l'éditeur) : le texte à chasse fixe,
 * de la place en bas pour le bouton de mise en page, les numéros de ligne, la liste de la complétion,
 * le message d'une erreur, le panneau de recherche à la taille du reste de l'application.
 */
export const theme = EditorView.theme({
  "&": { height: "100%", background: "#fff", color: "var(--color-ink)" },
  "&.cm-focused": { outline: "none" },
  // la sélection se dessine d'ordinaire sous le texte, et les couloirs d'octave la cacheraient : par-dessus, en multiplication, elle les teinte et le texte reste lisible
  ".cm-selectionLayer": { zIndex: "1 !important", mixBlendMode: "multiply" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground": { background: "color-mix(in srgb, var(--color-brand) 22%, #fff)" },
  ".cm-searchMatch": { background: "color-mix(in srgb, #ffbe28 35%, #fff)" },
  // une erreur de lecture : soulignée en rouge, sur un fond rosé qui se voit même sous un seul caractère
  ".cm-lintRange.cm-lintRange-error": {
    backgroundImage: "none",
    backgroundColor: "rgba(214, 40, 40, 0.16)",
    textDecoration: "underline wavy #d22c2c",
    textDecorationSkipInk: "none",
    textUnderlineOffset: "3px",
  },
  ".cm-scroller": { fontFamily: "var(--font-mono)", fontSize: "13px", lineHeight: "1.45", fontVariantLigatures: "none" },
  ".cm-content": { padding: "12px 16px 76px 10px", caretColor: "var(--color-ink)" },
  ".cm-line": { padding: "0" },
  ".cm-cursor": { borderLeftColor: "var(--color-ink)" },
  // numéros de ligne : la ligne du curseur en évidence, une erreur en rouge
  ".cm-gutters": {
    minWidth: "3.2em",
    background: "var(--color-panel)",
    borderRight: "1px solid var(--color-line)",
    color: "var(--color-dim)",
    userSelect: "none",
  },
  ".cm-lineNumbers .cm-gutterElement": { padding: "0 8px 0 10px" },
  ".cm-activeLineGutter": { background: "none", color: "var(--color-ink)", fontWeight: "600" },
  ".cm-gutterElement.cm-error-line": { color: "var(--color-error)", background: "var(--color-error-bg)", fontWeight: "600" },
  // la liste de la complétion : ce qui s'écrit en chasse fixe, son sens à côté
  ".cm-tooltip.cm-tooltip-autocomplete": {
    border: "1px solid var(--color-line)",
    borderRadius: "6px",
    background: "#fff",
    boxShadow: "0 6px 18px rgba(0, 0, 0, 0.12)",
    overflow: "hidden",
  },
  ".cm-tooltip-autocomplete > ul": { fontFamily: "var(--font-mono)", fontSize: "13px", maxHeight: "18em" },
  ".cm-tooltip-autocomplete > ul > li": { padding: "2px 10px 2px 8px" },
  ".cm-tooltip-autocomplete > ul > li[aria-selected]": { background: "var(--color-brand)", color: "#fff" },
  ".cm-tooltip-autocomplete .cm-completionDetail": {
    fontFamily: "var(--font-ui)",
    fontStyle: "normal",
    fontSize: "12.5px",
    color: "var(--color-dim)",
    marginLeft: "1.2em",
  },
  ".cm-tooltip-autocomplete li[aria-selected] .cm-completionDetail": { color: "rgba(255, 255, 255, 0.85)" },
  ".cm-tooltip-autocomplete completion-section": {
    fontFamily: "var(--font-ui)",
    fontSize: "11.5px",
    color: "var(--color-dim)",
    padding: "4px 8px 2px",
    borderBottom: "0",
  },
  ".cm-tooltip-autocomplete .cm-completionMatchedText": { textDecoration: "none", fontWeight: "700" },
  // le message d'une erreur, au survol de son soulignement
  ".cm-tooltip.cm-tooltip-hover": {
    fontFamily: "var(--font-ui)",
    fontSize: "13px",
    border: "1px solid var(--color-line)",
    borderRadius: "6px",
    background: "#fff",
    boxShadow: "0 4px 14px rgba(0, 0, 0, 0.12)",
    overflow: "hidden",
  },
  ".cm-tooltip-lint .cm-diagnostic": { padding: "6px 10px", maxWidth: "420px" },
  // le panneau de recherche (Ctrl+F)
  ".cm-panels": { background: "var(--color-panel)", borderColor: "var(--color-line)", fontFamily: "var(--font-ui)", fontSize: "13px" },
  ".cm-panel.cm-search": { padding: "8px 32px 8px 10px", fontSize: "14px", lineHeight: "1.3" },
  ".cm-panel.cm-search .cm-textfield": {
    font: "14px var(--font-mono)",
    padding: "4px 8px",
    border: "1px solid var(--color-line)",
    borderRadius: "5px",
    background: "#fff",
    minWidth: "14em",
  },
  ".cm-panel.cm-search .cm-textfield:focus": {
    outline: "2px solid color-mix(in srgb, var(--color-brand) 45%, transparent)",
    outlineOffset: "0",
    borderColor: "var(--color-brand)",
  },
  ".cm-panel.cm-search .cm-button": {
    font: "13px var(--font-ui)",
    padding: "4px 10px",
    border: "1px solid var(--color-line)",
    borderRadius: "5px",
    background: "#fff",
    color: "var(--color-ink)",
  },
  ".cm-panel.cm-search .cm-button:hover": { borderColor: "var(--color-brand)" },
  ".cm-panel.cm-search label": { fontSize: "13px", color: "var(--color-dim)" },
  ".cm-panel.cm-search input[type=checkbox]": { accentColor: "var(--color-brand)", verticalAlign: "-2px" },
  ".cm-panel.cm-search [name=close]": { top: "6px", right: "8px", fontSize: "20px", color: "var(--color-dim)", cursor: "pointer" },
});

/** Les mots du panneau de recherche et remplacement de CodeMirror. */
export const SEARCH_PHRASES: Record<string, string> = {
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

/** Un signe trop long (une liaison, un soufflet sur plusieurs mesures) s'abrège : ses 9 premiers caractères. */
export const short = (text: string) => (text.length > 10 ? text.slice(0, 9) + "…" : text);

/**
 * Les erreurs de lecture du texte, toutes en une passe : chacune soulignée du signe fautif jusqu'à
 * la fin de son mot (une barre seule pour une barre), ou toute la ligne quand l'erreur est celle de
 * la ligne.
 */
export function diagnose(doc: Text): Diagnostic[] {
  return parseErrors(doc.toString()).map((prismaError) => {
    const errorLine = doc.line(Math.max(1, Math.min(prismaError.line, doc.lines)));
    let from = errorLine.from;
    let to = errorLine.to;
    if (prismaError.exact) {
      const at = Math.min(prismaError.column - 1, errorLine.length);
      const rest = errorLine.text.slice(at);
      const word = rest.startsWith("|") ? 1 : (rest.match(/^[^\s|]+/)?.[0].length ?? 0);
      from = errorLine.from + at;
      to = from + word;
    }
    // un signe absent (une case vide, la fin de la ligne) : un caractère, pour que le soulignement se voie
    if (to === from) {
      if (to < errorLine.to) to++;
      else from = Math.max(errorLine.from, from - 1);
    }
    return { from, to, severity: "error" as const, message: prismaError.reason, renderMessage: () => messageNode(prismaError.reason) };
  });
}

// la ligne de l'erreur, marquée dans la marge des numéros
const errorMarker = new (class extends GutterMarker {
  elementClass = "cm-error-line";
})();
export const errorLineField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(set, tr) {
    if (tr.docChanged) set = set.map(tr.changes);
    for (const stateEffect of tr.effects)
      if (stateEffect.is(setDiagnosticsEffect)) {
        const lines = [...new Set(stateEffect.value.map((diagnostic) => tr.state.doc.lineAt(diagnostic.from).from))].sort(
          (first, second) => first - second,
        );
        set = RangeSet.of(lines.map((at) => errorMarker.range(at)));
      }
    return set;
  },
  provide: (stateField) => gutterLineClass.from(stateField),
});

// Ctrl+Entrée met la partition en page (raccourci de l'application) : l'éditeur n'en fait rien
export const keys = [
  ...defaultKeymap.filter((keyBinding) => keyBinding.key !== "Mod-Enter"),
  // d'une erreur à l'autre
  { key: "F8", run: nextDiagnostic },
  { key: "Shift-F8", run: previousDiagnostic },
];
