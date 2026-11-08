<script setup lang="ts">
/**
 * L'application : la barre du haut, et dessous l'éditeur du texte et la partition gravée (ou, à leur
 * place, la référence). Elle assemble ce que chaque domaine tient : le morceau ouvert
 * (files/useDocument), les réglages (options/settings), l'écoute (playback/usePieceSound), la
 * retouche (retouch/useRetouch), la vue (score/useView), le partage (files/useShare), la conversion
 * (editor/useConversion).
 *
 * Lecture, le mode ordinaire : pour jouer, sans l'éditeur, les pages côte à côte, chacune de toute la
 * hauteur de l'écran. Édition : l'éditeur à côté des pages. Une nouvelle partition, un MusicXML
 * importé ou un .prisma qui ne se grave pas s'ouvrent en édition, un .prisma en lecture ; le mode se
 * retrouve d'une visite à l'autre.
 */
import { onKeyStroke } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { computed, ref, useTemplateRef } from "vue";
import { loadEditing, loadSource, saveEditing } from "./files/storage.ts";
import { tryParse } from "./files/parse.ts";
import { pcloudReturned } from "./library/pcloud.ts";
import { saveToLibrary } from "./library/sources.ts";
import { appMenus } from "./menus.ts";
import { settingsName } from "./options/piece.ts";
import { DEFAULT_BPM } from "./playback/player.ts";
import { follow } from "./score/follow.ts";
import { engraveOptions, engravePages } from "./score/render.ts";
import AboutDialog from "./about/AboutDialog.vue";
import { useAbout } from "./about/useAbout.ts";
import ConvertDialog from "./editor/ConvertDialog.vue";
import EditorTab from "./editor/EditorTab.vue";
import ErrorBar from "./editor/ErrorBar.vue";
import type { EditorHandle } from "./editor/codemirror.ts";
import SourceEditor from "./editor/SourceEditor.vue";
import Splitter from "./editor/Splitter.vue";
import { useConversion } from "./editor/useConversion.ts";
import { useErrors } from "./editor/useErrors.ts";
import DropZone from "./files/DropZone.vue";
import ExportDialog from "./files/ExportDialog.vue";
import ImportLinkDialog from "./files/ImportLinkDialog.vue";
import LibraryView from "./library/LibraryView.vue";
import NewDialog from "./files/NewDialog.vue";
import ReceivedDialog from "./files/ReceivedDialog.vue";
import { useDocument } from "./files/useDocument.ts";
import { useShare } from "./files/useShare.ts";
import OptionsDrawer from "./options/OptionsDrawer.vue";
import { useSettings } from "./options/settings.ts";
import { useSettingsAutosave } from "./options/useSettingsAutosave.ts";
import ListenControls from "./playback/ListenControls.vue";
import Progress from "./playback/Progress.vue";
import { usePieceSound } from "./playback/usePieceSound.ts";
import ReferenceView from "./reference/ReferenceView.vue";
import RetouchMenu from "./retouch/RetouchMenu.vue";
import { useRetouch } from "./retouch/useRetouch.ts";
import EngraveButton from "./score/EngraveButton.vue";
import EngraveProblem from "./score/EngraveProblem.vue";
import FocusView from "./score/FocusView.vue";
import PageView from "./score/PageView.vue";
import { usePreviewScroll } from "./score/usePreviewScroll.ts";
import { useTextMark } from "./score/useTextMark.ts";
import { useView } from "./score/useView.ts";
import Toolbar from "./Toolbar.vue";
import BackButton from "./ui/button/BackButton.vue";
import ScrollBackButton from "./ui/ScrollBackButton.vue";
import { useAppUpdate } from "./ui/useAppUpdate.ts";
import { useFullScreen } from "./ui/useFullScreen.ts";
import { useNotice } from "./ui/useNotice.ts";
import { useShortcuts } from "./useShortcuts.ts";

const { notice, notify } = useNotice();
const settings = useSettings();
const { general, options, piece } = storeToRefs(settings);
const { setOptions } = settings;
const { view, setView, zoomBy } = useView();
const editor = useTemplateRef<EditorHandle>("editor");

// les panneaux à la place de l'éditeur et de la partition (la référence, la bibliothèque : l'une
// chasse l'autre), et celui des options, par-dessus, qu'Échap ferme
// de retour de la connexion à pCloud : la bibliothèque, qu'on était allé ouvrir
const panel = ref<"guide" | "library" | null>(pcloudReturned() ? "library" : null);
const togglePanel = (shown: "guide" | "library") => (panel.value = panel.value === shown ? null : shown);
const showOptions = ref(false);
onKeyStroke("Escape", () => (showOptions.value = false));

const initialSource = loadSource();
const editing = ref(loadEditing(initialSource) || !!tryParse(initialSource).problem);
function setEditing(on: boolean) {
  editing.value = on;
  if (panel.value === "guide") panel.value = null;
  saveEditing(on);
}
const reading = computed(() => !editing.value);

const autoEngrave = computed(() => options.value.autoEngrave);
const doc = useDocument({
  autoEngrave,
  editor,
  notify,
  onLoaded: settings.resetPiece,
  onSavedIn: settings.placePiece,
  setEditing,
  onOpenedFrom: (from) => (from !== "drop" || panel.value === "guide") && (panel.value = null),
});
const { source, fileInput } = doc;
useSettingsAutosave(doc.handle, notify);
const appUpdate = useAppUpdate(notify);
const about = useAbout();
const sharing = useShare({ source, fileName: doc.fileName, piece, notify, openShared: doc.openShared });
const conversion = useConversion(source, doc.rewrite, notify);
const { fullScreen, toggle: toggleFullScreen } = useFullScreen(notify);

const score = computed(() => doc.engraved.value.score);
const pages = computed(() => (score.value ? engravePages(score.value, engraveOptions(options.value)) : []));
const errors = useErrors(
  computed(() => doc.engraved.value.problem),
  editor,
);

const sound = usePieceSound(score);
const linked = computed(() => !reading.value && options.value.scoreToText);
const retouch = useRetouch({ source, rewrite: doc.rewrite, editor, linked, score });
const onCaret = useTextMark(linked, retouch.mark);

const split = useTemplateRef<HTMLElement>("split");
const preview = useTemplateRef<HTMLElement>("preview");
const focused = computed(() => view.value.fit === "focus");
const scrolled = usePreviewScroll(
  preview,
  reading,
  computed(() => view.value.fit),
  zoomBy,
);
function scrollBack() {
  follow.hold();
  const behavior = matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
  preview.value!.scrollTo({ top: 0, left: 0, behavior });
}

useShortcuts({
  engrave: doc.engraveNow,
  save: doc.saveFile,
  open: doc.openFile,
  library: () => togglePanel("library"),
  editor: () => setEditing(!editing.value),
  zoom: (direction) => (direction ? zoomBy(direction) : setView({ zoom: 1 })),
  fullScreen: toggleFullScreen,
});

const menus = computed(() =>
  appMenus({
    newFile: () => (doc.choosingNew.value = true),
    openFile: doc.openFile,
    library: { shown: panel.value === "library", toggle: () => togglePanel("library") },
    save: doc.saveFile,
    saveToLibrary: () => saveToLibrary(doc.saveInto, notify),
    exportFile: () => (doc.exporting.value = true),
    share: sharing.share,
    importLink: () => (sharing.importing.value = true),
    reload: doc.handle.value ? doc.reloadFile : undefined,
    engrave: doc.engraveNow,
    autoEngrave: { on: options.value.autoEngrave, toggle: () => setOptions({ autoEngrave: !options.value.autoEngrave }) },
    options: { shown: showOptions.value, toggle: () => (showOptions.value = !showOptions.value) },
    convert: conversion.start,
    about: about.open,
    canPrint: pages.value.length > 0 && !panel.value,
    editor: { on: editing.value, toggle: () => setEditing(!editing.value) },
    view: view.value,
    setView,
    zoomBy,
    fullScreen: { on: fullScreen.value, toggle: toggleFullScreen },
    guide: { shown: panel.value === "guide", toggle: () => togglePanel("guide") },
  }),
);

// la partition : les pages, que le zoom (--zoom) agrandit, calées à gauche plutôt que de déborder des
// deux côtés ; en lecture, plus près des bords ; à la hauteur, côte à côte, qu'on fait défiler de
// côté une page à la fois (zoomée, librement) ; à la largeur, l'une sous l'autre ; focalisée, rien ne
// défile. Sur un écran étroit, en édition, l'éditeur prend sa place.
const previewClass = computed(() => {
  const { fit, zoom } = view.value;
  const snap =
    fit === "height" && zoom <= 1
      ? reading.value
        ? "snap-x snap-mandatory scroll-pt-3 scroll-pr-3 scroll-pb-3 scroll-pl-8"
        : "snap-x snap-mandatory scroll-p-6"
      : "";
  return [
    "flex items-start touch-manipulation narrow:@container group-data-resizing/split:pointer-events-none print:block print:overflow-visible print:p-0",
    reading.value ? "gap-3 pt-3 pr-3 pb-3 pl-8" : "gap-6 p-6 narrow:hidden",
    fit === "height" ? "flex-row" : "flex-col",
    fit === "focus" ? "overflow-hidden" : "overflow-auto",
    snap,
  ];
});

// la molette fait défiler de côté les pages côte à côte
// (ajustées à la hauteur et sans zoom : sinon la molette garde son sens, de haut en bas)
function onWheel(event: WheelEvent) {
  if (view.value.fit !== "height" || view.value.zoom > 1 || event.ctrlKey) return;
  if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) (event.currentTarget as HTMLElement).scrollBy({ left: event.deltaY });
}

function onFileChosen(event: Event) {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  if (file) doc.open(file);
  input.value = "";
}
</script>

<template>
  <DropZone class="relative flex flex-col h-full print:block print:h-auto" @file="doc.openDropped">
    <Toolbar
      :menus="menus"
      :file-name="doc.fileName.value"
      :saved="!doc.unsaved.value && doc.savedText.value !== null"
      :rewritable="!!doc.handle.value"
      :notes="score?.meta.notes"
      :notice="notice"
      :update="appUpdate.waiting.value"
      :options-open="showOptions"
      @update="appUpdate.apply"
      @options="showOptions = !showOptions"
    >
      <template #listen="{ place }">
        <ListenControls :place="place" :score="score" :disabled="!score || !pages.length" :sound="sound" />
      </template>
    </Toolbar>
    <input ref="fileInput" type="file" accept=".prisma,.txt,.musicxml,.xml" hidden @change="onFileChosen" />

    <!-- où en est la lecture, sur toute la largeur, sous la barre -->
    <div v-if="view.progress && score && pages.length" class="flex px-4 py-px bg-panel border-b border-line print:hidden!">
      <Progress :bpm="piece.tempo ?? score.meta.bpm ?? DEFAULT_BPM" />
    </div>

    <div class="flex-1 relative flex flex-col min-h-0">
      <main v-if="panel === 'guide'" class="guide-pane flex-1 overflow-auto bg-white">
        <BackButton @click="panel = null" />
        <ReferenceView :options="general" />
      </main>
      <LibraryView v-if="panel === 'library'" :options="general" @open="doc.openEntry" @close="panel = null" />
      <ExportDialog v-if="doc.exporting.value" @export="doc.exportFile" @close="doc.exporting.value = false" />
      <NewDialog v-if="doc.choosingNew.value" @create="doc.newFile" @close="doc.choosingNew.value = false" />
      <ImportLinkDialog v-if="sharing.importing.value" :import-link="sharing.importLink" @close="sharing.importing.value = false" />
      <ReceivedDialog
        v-if="sharing.received.value"
        :shared="sharing.received.value"
        :library="sharing.library.value?.label"
        @open="sharing.accept"
        @close="sharing.close"
      />
      <AboutDialog v-if="about.shown.value" @close="about.close" />
      <ConvertDialog
        v-if="conversion.parts.value"
        :parts="conversion.parts.value"
        :note-names="options.noteNames === 'english' ? 'english' : 'latin'"
        @convert="conversion.convert"
        @close="conversion.cancel"
      />
      <!--
        la largeur de l'éditeur (--editor, réglée par la barre qui le sépare de la partition), en
        gardant de la place à chacun ; pendant le glissé, le curseur partout et rien ne se sélectionne
      -->
      <main
        ref="split"
        :class="[
          'group/split relative grid flex-1 min-h-0 [--editor-width:clamp(300px,var(--editor,42%),calc(100%-260px))] data-resizing:cursor-col-resize data-resizing:select-none print:block print:h-auto',
          reading ? 'grid-cols-[minmax(0,1fr)]' : 'grid-cols-[var(--editor-width)_minmax(0,1fr)] narrow:grid-cols-[minmax(0,1fr)]',
        ]"
        :style="{ '--editor': `${view.editorWidth * 100}%` }"
        :hidden="!!panel"
      >
        <EditorTab :editing="editing" @click="setEditing(!editing)" />
        <Splitter
          v-if="editing"
          :host="split ?? undefined"
          :model-value="view.editorWidth"
          @update:model-value="(editorWidth) => setView({ editorWidth })"
        />
        <section
          class="grid grid-rows-[1fr_auto_auto] grid-cols-[minmax(0,1fr)] min-h-0 bg-white border-r border-line narrow:border-r-0 group-data-resizing/split:pointer-events-none print:hidden"
          :hidden="reading"
        >
          <SourceEditor
            ref="editor"
            v-model="source"
            :note-names="options.noteNames"
            :colors="options.sourceColors"
            :palette="options.octaveColors"
            @check="errors.setChecked"
            @caret="onCaret"
          >
            <EngraveButton
              :dirty="doc.dirty.value"
              :auto="options.autoEngrave"
              @update:auto="(on) => setOptions({ autoEngrave: on })"
              @engrave="doc.engraveNow"
            />
          </SourceEditor>
          <ErrorBar
            v-if="errors.problem.value"
            :problems="errors.problems.value"
            :shown="errors.shown.value"
            @go-to="errors.goTo"
            @show="errors.show"
          />
        </section>

        <section
          ref="preview"
          :class="previewClass"
          :data-fit="view.fit"
          :aria-label="reading ? 'Partition' : 'Aperçu'"
          :style="{ '--zoom': view.zoom }"
          @wheel="onWheel"
        >
          <p v-if="score && !pages.length" class="text-muted">Aucune mesure à mettre en page.</p>
          <RetouchMenu
            v-if="retouch.menu.value"
            v-bind="retouch.menu.value"
            :names="options.noteNames"
            @pick="retouch.pick"
            @string="retouch.string"
            @target="retouch.target"
            @resize="retouch.resize"
            @hold="retouch.hold"
            @octave="retouch.octave"
            @amend="retouch.amend"
            @close="retouch.close"
          />
          <EngraveProblem
            :problems="errors.problems.value"
            :fixed="errors.fixed.value"
            :auto-engrave="options.autoEngrave"
            @engrave="doc.engraveNow"
            @show="errors.show"
          />
          <template v-if="focused">
            <FocusView :pages="pages" :options="options" />
            <!-- à l'impression, les pages, comme dans les autres lectures -->
            <div class="hidden print:block">
              <PageView
                v-for="page in pages"
                :key="page.index"
                :page="page"
                :total="pages.length"
                :meta="score!.meta"
                :options="options"
                still
              />
            </div>
          </template>
          <template v-else>
            <PageView v-for="page in pages" :key="page.index" :page="page" :total="pages.length" :meta="score!.meta" :options="options" />
          </template>
        </section>
        <ScrollBackButton
          v-if="scrolled && !focused"
          class="absolute right-6 bottom-6 z-4"
          :direction="scrolled"
          label="Retour au début de la partition"
          @click="scrollBack"
        />
      </main>
      <OptionsDrawer
        v-if="showOptions"
        :name="doc.fileName.value"
        :where="settings.pieceDir && doc.handle.value ? settingsName(doc.handle.value.name) : null"
        @close="showOptions = false"
      />
    </div>
  </DropZone>
</template>
