/**
 * L'application : la barre du haut, et dessous l'éditeur du texte et la partition gravée (ou, à leur
 * place, la référence ou la bibliothèque), avec le panneau des options par-dessus. Elle assemble ce
 * que chaque domaine tient : le morceau ouvert (files/useDocument), les réglages (options/useSettings),
 * la vue (score/useView), l'écoute (playback/usePieceSound), la retouche (retouch/useRetouch).
 *
 * Lecture, le mode ordinaire : pour jouer, sans l'éditeur, les pages côte à côte, chacune de toute la
 * hauteur de l'écran ; on tourne les pages au clavier ou avec une pédale tourne-pages. Édition :
 * l'éditeur à côté des pages. Une nouvelle partition, un MusicXML importé ou un .prisma qui ne se
 * grave pas s'ouvrent en édition, un .prisma en lecture ; le mode se retrouve d'une visite à l'autre.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { ConvertDialog } from "./editor/ConvertDialog.tsx";
import { EditorTab } from "./editor/EditorTab.tsx";
import { ErrorBar } from "./editor/ErrorBar.tsx";
import { SourceEditor } from "./editor/SourceEditor.tsx";
import type { EditorHandle } from "./editor/SourceEditor.tsx";
import { Splitter } from "./editor/Splitter.tsx";
import { useConversion } from "./editor/useConversion.ts";
import { useErrors } from "./editor/useErrors.ts";
import { DropZone } from "./files/DropZone.tsx";
import { ExportDialog } from "./files/ExportDialog.tsx";
import { ImportLinkDialog } from "./files/ImportLinkDialog.tsx";
import { ReceivedDialog } from "./files/ReceivedDialog.tsx";
import { useShare } from "./files/useShare.ts";
import { useAppUpdate } from "./ui/useAppUpdate.ts";
import { NewDialog } from "./files/NewDialog.tsx";
import { loadEditing, loadSource, saveEditing } from "./files/storage.ts";
import { tryParse, useDocument } from "./files/useDocument.ts";
import { LibraryView } from "./library/LibraryView.tsx";
import { pcloudReturned } from "./library/pcloud.ts";
import { saveToLibrary } from "./library/sources.ts";
import { appMenus } from "./menus.ts";
import { OptionsDrawer } from "./options/OptionsDrawer.tsx";
import { PIECE_KEYS, settingsName } from "./options/piece.ts";
import { useSettings, useSettingsAutosave } from "./options/useSettings.ts";
import { ListenControls } from "./playback/ListenControls.tsx";
import { DEFAULT_BPM } from "./playback/player.ts";
import { Progress } from "./playback/Progress.tsx";
import { usePieceSound } from "./playback/usePieceSound.ts";
import { ReferenceView } from "./reference/ReferenceView.tsx";
import { RetouchMenu } from "./retouch/RetouchMenu.tsx";
import { useRetouch } from "./retouch/useRetouch.ts";
import { EngraveButton } from "./score/EngraveButton.tsx";
import { EngraveProblem } from "./score/EngraveProblem.tsx";
import { FocusView } from "./score/FocusView.tsx";
import { follow } from "./score/follow.ts";
import { PageView } from "./score/PageView.tsx";
import { engraveOptions, engravePages } from "./score/render.ts";
import { usePreviewScroll } from "./score/usePreviewScroll.ts";
import { useTextMark } from "./score/useTextMark.ts";
import { useView } from "./score/useView.ts";
import { Toolbar } from "./Toolbar.tsx";
import { BackButton } from "./ui/button/BackButton.tsx";
import { ScrollBackButton } from "./ui/button/ScrollBackButton.tsx";
import { useFullScreen } from "./ui/useFullScreen.ts";
import { useNotice } from "./ui/useNotice.ts";
import { useShortcuts } from "./useShortcuts.ts";

/** De retour de la connexion à pCloud : lu une fois, au chargement (React peut rappeler l'initialisation d'un état). */
const fromPcloud = pcloudReturned();

export function App() {
  const [notice, notify] = useNotice();
  const settings = useSettings();
  const { general, options, setOptions, piece, updatePiece } = settings;
  const { view, setView, zoomBy } = useView();
  const editor = useRef<EditorHandle>(null);

  // les panneaux à la place de l'éditeur et de la partition (la référence, la bibliothèque : l'une
  // chasse l'autre), et celui des options, par-dessus, qu'Échap ferme
  // de retour de la connexion à pCloud : la bibliothèque, qu'on était allé ouvrir
  const [panel, setPanel] = useState<"guide" | "library" | null>(fromPcloud ? "library" : null);
  const togglePanel = (p: "guide" | "library") => setPanel((cur) => (cur === p ? null : p));
  const [showOptions, setShowOptions] = useState(false);
  useEffect(() => {
    if (!showOptions) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowOptions(false);
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [showOptions]);

  const [editing, setEditingState] = useState(() => {
    const source = loadSource();
    return loadEditing(source) || !!tryParse(source).problem;
  });
  const setEditing = (on: boolean) => {
    setEditingState(on);
    setPanel((cur) => (cur === "guide" ? null : cur));
    saveEditing(on);
  };
  const reading = !editing;

  const doc = useDocument({
    autoEngrave: options.autoEngrave,
    editor,
    notify,
    onLoaded: settings.resetPiece,
    onSavedIn: settings.placePiece,
    setEditing,
    onOpenedFrom: (from) => setPanel((cur) => (from !== "drop" || cur === "guide" ? null : cur)),
  });
  useSettingsAutosave(piece, settings.pieceDir, doc.handle, settings.changed, notify);
  const appUpdate = useAppUpdate(notify);
  const sharing = useShare({ source: doc.source, fileName: doc.fileName, piece, notify, openShared: doc.openShared });
  const { score, problem: engravedProblem } = doc.engraved;
  const engraving = JSON.stringify(engraveOptions(options));
  const pages = useMemo(() => (score ? engravePages(score, JSON.parse(engraving)) : []), [score, engraving]);
  const errors = useErrors(engravedProblem, editor);
  const sound = usePieceSound(score, piece, updatePiece, settings.pieceId, options);
  const conversion = useConversion(doc.current, doc.rewrite, notify);
  const linked = !reading && options.scoreToText;
  const retouch = useRetouch({ current: doc.current, rewrite: doc.rewrite, editor, linked, score, names: options.noteNames });
  const onCaret = useTextMark(linked, retouch.mark, retouch.open, retouch.lane);
  const [fullScreen, toggleFullScreen] = useFullScreen(notify);

  const preview = useRef<HTMLElement>(null);
  const split = useRef<HTMLElement>(null);
  const focused = view.fit === "focus";
  const scrolled = usePreviewScroll(preview, reading, view.fit, zoomBy);

  useShortcuts({
    engrave: doc.engraveNow,
    save: doc.saveFile,
    open: doc.openFile,
    library: () => togglePanel("library"),
    editor: () => setEditing(!editing),
    zoom: (dir) => (dir ? zoomBy(dir) : setView({ zoom: 1 })),
    fullScreen: toggleFullScreen,
  });

  const menus = appMenus({
    newFile: () => doc.setChoosingNew(true),
    openFile: doc.openFile,
    library: { shown: panel === "library", toggle: () => togglePanel("library") },
    save: doc.saveFile,
    saveToLibrary: () => saveToLibrary(doc.saveInto, notify),
    exportFile: () => doc.setExporting(true),
    share: sharing.share,
    importLink: () => sharing.setImporting(true),
    reload: doc.handle ? doc.reloadFile : undefined,
    engrave: doc.engraveNow,
    autoEngrave: { on: options.autoEngrave, toggle: () => setOptions({ autoEngrave: !options.autoEngrave }) },
    options: { shown: showOptions, toggle: () => setShowOptions((v) => !v) },
    convert: conversion.start,
    canPrint: pages.length > 0 && !panel,
    editor: { on: editing, toggle: () => setEditing(!editing) },
    view,
    setView,
    zoomBy,
    fullScreen: { on: fullScreen, toggle: toggleFullScreen },
    guide: { shown: panel === "guide", toggle: () => togglePanel("guide") },
  });

  // la partition : les pages, que le zoom (--zoom) agrandit, calées à gauche plutôt que de déborder des
  // deux côtés ; en lecture, plus près des bords ; à la hauteur, côte à côte, qu'on fait défiler de
  // côté une page à la fois (zoomée, librement) ; à la largeur, l'une sous l'autre ; focalisée, rien ne
  // défile. Sur un écran étroit, en édition, l'éditeur prend sa place.
  const snap = view.fit === "height" && view.zoom <= 1 ? (reading ? "snap-x snap-mandatory scroll-pt-3 scroll-pr-3 scroll-pb-3 scroll-pl-8" : "snap-x snap-mandatory scroll-p-6") : "";
  const previewClass = [
    "flex items-start touch-manipulation narrow:@container group-data-resizing/split:pointer-events-none print:block print:overflow-visible print:p-0",
    reading ? "gap-3 pt-3 pr-3 pb-3 pl-8" : "gap-6 p-6 narrow:hidden",
    view.fit === "height" ? "flex-row" : "flex-col",
    focused ? "overflow-hidden" : "overflow-auto",
    snap,
  ].join(" ");

  return (
    <DropZone className="relative flex flex-col h-full print:block print:h-auto" onFile={doc.openDropped}>
      <Toolbar menus={menus} fileName={doc.fileName} saved={!doc.unsaved && doc.savedText !== null} rewritable={!!doc.handle} notes={score?.meta.notes} notice={notice} onUpdate={appUpdate.waiting ? appUpdate.apply : undefined} optionsOpen={showOptions} onOptions={() => setShowOptions((v) => !v)}>
        <ListenControls
          score={score}
          disabled={!score || !pages.length}
          metronome={options.metronome}
          onMetronome={(metronome) => setOptions({ metronome })}
          clickGrid={options.clickGrid}
          onClickGrid={(clickGrid) => setOptions({ clickGrid })}
          muted={sound.muted}
          onMuted={sound.setMuted}
          instruments={sound.instruments}
          onInstrument={sound.setInstrument}
          volumes={sound.volumes}
          onVolume={sound.setVolume}
          tempo={piece.tempo ?? null}
          onTempo={(tempo) => updatePiece({ tempo: tempo ?? undefined })}
        />
      </Toolbar>
      <input
        ref={doc.fileInput}
        type="file"
        accept=".prisma,.txt,.musicxml,.xml"
        hidden
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) doc.open(f);
          e.target.value = "";
        }}
      />
      {/* où en est la lecture, sur toute la largeur, sous la barre */}
      {view.progress && score && pages.length > 0 && (
        <div className="flex px-4 py-px bg-panel border-b border-line print:hidden!">
          <Progress bpm={piece.tempo ?? score.meta.bpm ?? DEFAULT_BPM} />
        </div>
      )}

      <div className="flex-1 relative flex flex-col min-h-0">
        {panel === "guide" && (
          <main className="guide-pane flex-1 overflow-auto bg-white">
            <BackButton onClick={() => setPanel(null)} />
            <ReferenceView options={general} />
          </main>
        )}
        {panel === "library" && <LibraryView options={general} onOpen={doc.openEntry} onClose={() => setPanel(null)} />}
        {doc.exporting && <ExportDialog onExport={doc.exportFile} onClose={() => doc.setExporting(false)} />}
        {doc.choosingNew && <NewDialog onCreate={doc.newFile} onClose={() => doc.setChoosingNew(false)} />}
        {sharing.importing && <ImportLinkDialog onImport={sharing.importLink} onClose={() => sharing.setImporting(false)} />}
        {sharing.received && <ReceivedDialog shared={sharing.received} library={sharing.library?.label} onOpen={sharing.accept} onClose={sharing.close} />}
        {conversion.parts && <ConvertDialog parts={conversion.parts} noteNames={options.noteNames === "english" ? "english" : "latin"} onConvert={conversion.convert} onClose={conversion.cancel} />}
        <main
          ref={split}
          // la largeur de l'éditeur (--editor, réglée par la barre qui le sépare de la partition), en
          // gardant de la place à chacun ; pendant le glissé, le curseur partout et rien ne se sélectionne
          className={`group/split relative grid flex-1 min-h-0 [--editor-width:clamp(300px,var(--editor,42%),calc(100%-260px))] data-resizing:cursor-col-resize data-resizing:select-none print:block print:h-auto ${reading ? "grid-cols-[minmax(0,1fr)]" : "grid-cols-[var(--editor-width)_minmax(0,1fr)] narrow:grid-cols-[minmax(0,1fr)]"}`}
          style={{ "--editor": `${view.editorWidth * 100}%` } as React.CSSProperties}
          hidden={!!panel}
        >
          <EditorTab editing={editing} onToggle={() => setEditing(!editing)} />
          {editing && <Splitter host={split} width={view.editorWidth} onWidth={(editorWidth) => setView({ editorWidth })} />}
          <section className="grid grid-rows-[1fr_auto_auto] grid-cols-[minmax(0,1fr)] min-h-0 bg-white border-r border-line narrow:border-r-0 group-data-resizing/split:pointer-events-none print:hidden" hidden={reading}>
            <SourceEditor value={doc.source} onChange={doc.setSource} editor={editor} noteNames={options.noteNames} colors={options.sourceColors} palette={options.octaveColors} onCheck={errors.setChecked} onCaret={onCaret}>
              <EngraveButton dirty={doc.dirty} auto={options.autoEngrave} onEngrave={doc.engraveNow} onAuto={(autoEngrave) => setOptions({ autoEngrave })} />
            </SourceEditor>
            {errors.problem && <ErrorBar problems={errors.problems} shown={errors.shown} onGoTo={errors.goTo} onShow={errors.show} />}
          </section>

          {/* au doigt, deux touchers ouvrent la retouche, sans agrandir la page */}
          <section
            className={previewClass}
            ref={preview}
            data-fit={view.fit}
            aria-label={reading ? "Partition" : "Aperçu"}
            // la molette fait défiler de côté les pages côte à côte
            // (ajustées à la hauteur et sans zoom : sinon la molette garde son sens, de haut en bas)
            onWheel={(e) => view.fit === "height" && view.zoom <= 1 && !e.ctrlKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.currentTarget.scrollBy({ left: e.deltaY })}
            style={{ "--zoom": view.zoom } as React.CSSProperties}
          >
            {score && !pages.length && <p className="text-muted">Aucune mesure à mettre en page.</p>}
            {retouch.menu && <RetouchMenu {...retouch.menu} />}
            <EngraveProblem problems={errors.problems} fixed={errors.fixed} autoEngrave={options.autoEngrave} onEngrave={doc.engraveNow} onShow={errors.show} />
            {focused ? (
              <>
                <FocusView pages={pages} options={options} />
                {/* à l'impression, les pages, comme dans les autres lectures */}
                <div className="hidden print:block">
                  {pages.map((p) => (
                    <PageView key={p.index} page={p} total={pages.length} meta={score!.meta} options={options} still />
                  ))}
                </div>
              </>
            ) : (
              pages.map((p) => <PageView key={p.index} page={p} total={pages.length} meta={score!.meta} options={options} />)
            )}
          </section>
          {scrolled && !focused && (
            <ScrollBackButton
              className="absolute right-6 bottom-6 z-4"
              direction={scrolled}
              label="Retour au début de la partition"
              onClick={() => {
                follow.hold();
                preview.current!.scrollTo({ top: 0, left: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
              }}
            />
          )}
        </main>
        {showOptions && (
          <OptionsDrawer
            piece={{
              general,
              own: piece.options ?? {},
              setGeneral: setOptions,
              setPiece: settings.setPieceOptions,
              unsetPiece: settings.unsetPieceOptions,
              name: doc.fileName,
              where: settings.pieceDir && doc.handle ? settingsName(doc.handle.name) : null,
              keys: PIECE_KEYS,
            }}
            onClose={() => setShowOptions(false)}
          />
        )}
      </div>
    </DropZone>
  );
}
