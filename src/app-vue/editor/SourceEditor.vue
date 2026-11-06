<script setup lang="ts">
/**
 * L'éditeur du texte .prisma (CodeMirror) : les numéros de ligne en marge (celui de la ligne du
 * curseur en évidence, celui d'une erreur en rouge), le texte, puis une barre de statut : la place
 * du curseur dans le texte et dans la musique, et le sens du signe qu'il pointe. Le texte est relu
 * pendant la frappe : une erreur se souligne à sa place, son message au survol. Ce qui flotte
 * au-dessus du texte (le bouton de mise en page) vient dans le slot. L'application le pilote par
 * focus, goTo et replace (EditorHandle).
 */
import { history, historyKeymap } from "@codemirror/commands";
import { linter } from "@codemirror/lint";
import { highlightSelectionMatches, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorSelection, EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLineGutter, keymap, lineNumbers } from "@codemirror/view";
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, useTemplateRef, watch } from "vue";
import { inspect, octaveOffset } from "../../core/index.ts";
import { completion } from "../../app/editor/completion.ts";
import { sourceColors } from "../../app/editor/sourceColors.ts";
import type { SourceColors } from "../../app/editor/sourceColors.ts";
import { writtenNames } from "../../app/options/options.ts";
import type { NameDisplay } from "../../app/options/options.ts";
import { staffNames } from "../../app/playback/staves.ts";
import type { OctaveColors } from "../../app/score/colors.ts";
import MiniKeyboard from "../ui/keyboard/MiniKeyboard.vue";
import { SEARCH_PHRASES, diagnose, errorLineField, keys, short, theme } from "./codemirror.ts";
import type { EditorHandle } from "./codemirror.ts";

const props = defineProps<{
  noteNames: NameDisplay;
  /** La coloration du texte, et la palette des couloirs d'octave (celle de la partition). */
  colors: SourceColors;
  palette: OctaveColors;
}>();
const value = defineModel<string>({ required: true });
const emit = defineEmits<{
  /** À chaque relecture du texte : ses erreurs (message avec sa place, ligne et colonne), dans l'ordre du texte. */
  check: [errors: { message: string; line: number; column: number }[]];
  /** Le curseur a bougé : sa ligne et sa colonne (à partir de 1), dans le texte tel qu'il est. */
  caret: [line: number, column: number, text: string];
}>();

const host = useTemplateRef<HTMLDivElement>("host");
const view = shallowRef<EditorView>();
const coloring = new Compartment();
const caret = ref(0);

onMounted(() => {
  view.value = new EditorView({
    parent: host.value!,
    state: EditorState.create({
      doc: value.value,
      extensions: [
        theme,
        lineNumbers(),
        highlightActiveLineGutter(),
        errorLineField,
        linter(
          (editorView) => {
            const found = diagnose(editorView.state.doc);
            emit(
              "check",
              found.map((diagnostic) => {
                const errorLine = editorView.state.doc.lineAt(diagnostic.from);
                const column = diagnostic.from - errorLine.from + 1;
                return { message: `ligne ${errorLine.number}, col. ${column} : ${diagnostic.message}`, line: errorLine.number, column };
              }),
            );
            return found;
          },
          { delay: 300 },
        ),
        coloring.of(sourceColors(props.colors, props.palette)),
        completion(() => writtenNames(props.noteNames)),
        history(),
        drawSelection(),
        search({ top: true }),
        // le panneau de recherche (Ctrl+F), en français
        EditorState.phrases.of(SEARCH_PHRASES),
        highlightSelectionMatches(),
        keymap.of([...keys, ...historyKeymap, ...searchKeymap]),
        EditorView.contentAttributes.of({ "aria-label": "Source .prisma", spellcheck: "false", autocorrect: "off", autocapitalize: "off" }),
        EditorView.updateListener.of((viewUpdate) => {
          if (viewUpdate.docChanged) value.value = viewUpdate.state.doc.toString();
          if (viewUpdate.docChanged || viewUpdate.selectionSet) {
            const head = viewUpdate.state.selection.main.head;
            caret.value = head;
            const caretLine = viewUpdate.state.doc.lineAt(head);
            emit("caret", caretLine.number, head - caretLine.from + 1, viewUpdate.state.doc.toString());
          }
        }),
      ],
    }),
  });
});
onBeforeUnmount(() => view.value?.destroy());

// un texte venu d'ailleurs (un fichier ouvert, une nouvelle partition) remplace celui de l'éditeur
watch(value, (text) => {
  const editorView = view.value;
  if (!editorView || editorView.state.doc.toString() === text) return;
  editorView.dispatch({ changes: { from: 0, to: editorView.state.doc.length, insert: text }, selection: EditorSelection.cursor(0) });
});

watch(
  () => [props.colors, props.palette] as const,
  ([colors, palette]) => view.value?.dispatch({ effects: coloring.reconfigure(sourceColors(colors, palette)) }),
);

defineExpose<EditorHandle>({
  focus: () => view.value?.focus(),
  replace(text, line, column) {
    const editorView = view.value;
    if (!editorView) return;
    const old = editorView.state.doc.toString();
    let common = 0;
    while (common < old.length && common < text.length && old[common] === text[common]) common++;
    let commonEnd = 0;
    while (
      commonEnd < old.length - common &&
      commonEnd < text.length - common &&
      old[old.length - 1 - commonEnd] === text[text.length - 1 - commonEnd]
    )
      commonEnd++;
    const changes = { from: common, to: old.length - commonEnd, insert: text.slice(common, text.length - commonEnd) };
    const doc = editorView.state.update({ changes }).state.doc;
    const target = doc.line(Math.max(1, Math.min(line, doc.lines)));
    const at = Math.min(target.from + column - 1, target.to);
    editorView.dispatch({
      changes,
      selection: { anchor: at },
      effects: EditorView.scrollIntoView(at, { y: "center" }),
      userEvent: "input.retouch",
    });
  },
  goTo(line, column = 1, focus = true) {
    const editorView = view.value;
    if (!editorView) return;
    const target = editorView.state.doc.line(Math.max(1, Math.min(line, editorView.state.doc.lines)));
    const at = Math.min(target.from + Math.max(0, column - 1), target.to);
    editorView.dispatch({
      selection: EditorSelection.range(Math.min(at + 1, target.to), at),
      effects: EditorView.scrollIntoView(at, { y: "center" }),
    });
    if (focus) editorView.focus();
  },
});

const info = computed(() => inspect(value.value, Math.min(caret.value, value.value.length), writtenNames(props.noteNames)));

/** Où est le curseur dans la musique : la section, la mesure et le temps, la portée, l'octave. */
const where = computed(() => {
  const { section, bar, beat, cell, staff, parts, octave } = info.value;
  const places: string[] = [];
  if (section) places.push(`section ${section}`);
  if (bar)
    places.push(`mesure ${bar}${beat ? `, temps ${beat}` : ""}${cell && cell.count > 1 ? ` (case ${cell.index}/${cell.count})` : ""}`);
  if (staff !== undefined && parts) {
    const name = staffNames(parts)[staff];
    if (name && (parts.length > 1 || parts[0].staves > 1)) places.push(name);
  }
  if (octave !== undefined) {
    const offset = octaveOffset(octave);
    places.push(`octave ${offset > 0 ? "+" : offset < 0 ? "−" : ""}${Math.abs(offset)}`);
  }
  return places;
});
</script>

<template>
  <div class="relative grid grid-cols-[minmax(0,1fr)] min-h-0">
    <!-- l'éditeur garde ses plans pour lui (le panneau de recherche passe sous les menus de la barre) -->
    <div ref="host" class="min-h-0 isolate" />
    <slot />
  </div>
  <div
    class="flex items-baseline gap-4 min-w-0 px-3 py-[5px] text-[12px] text-muted whitespace-nowrap bg-panel border-t border-line"
    role="status"
    aria-live="polite"
  >
    <!-- d'un seul tenant : le texte commence par « Ligne » -->
    <span class="flex-none"
      >Ligne {{ info.line }}, col. {{ info.column }}<span v-if="where.length > 0"> · {{ where.join(" · ") }}</span></span
    >
    <span
      v-if="info.symbol"
      class="min-w-0 overflow-hidden text-ellipsis text-ink"
      :title="`${short(info.symbol.text)} : ${info.symbol.meaning}`"
    >
      <code class="px-1 font-mono font-semibold bg-white border border-line rounded-[3px]">{{ short(info.symbol.text) }}</code>
      <MiniKeyboard
        v-if="noteNames === 'keyboard' && (info.symbol.keys || info.symbol.graces)"
        :keys="info.symbol.keys ?? []"
        :trill="info.symbol.trill"
        :graces="info.symbol.graces"
      />
      {{ info.symbol.meaning }}
    </span>
  </div>
</template>
