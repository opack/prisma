import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WIDTH, YmnError, importMusicXml, parseYmn, writeYmn } from "../core/index.ts";
import type { Score } from "../core/index.ts";
import { engrave } from "./engrave.ts";
import { Menu } from "./Menu.tsx";
import { ListenControls } from "./ListenControls.tsx";
import { EngraveButton } from "./EngraveButton.tsx";
import { OptionsDrawer } from "./OptionsDrawer.tsx";
import { withSimile } from "./pedal.ts";

import { player } from "./player.ts";
import { NoticeView } from "./NoticeView.tsx";
import { PageView } from "./PageView.tsx";
import { SAMPLE } from "./sample.ts";
import { alignOf, loadOptions, saveOptions } from "./options.ts";
import type { RenderOptions } from "./options.ts";
import { OPENABLE, canWriteInPlace, download, droppedFile, pickFile, pickSaveTarget, writeFile } from "./files.ts";

/** Délai sans frappe avant la gravure automatique. */
const AUTO_ENGRAVE_DELAY = 600;

const STORAGE_KEY = "ymn:source";
const load = () => {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? SAMPLE;
  } catch {
    return SAMPLE;
  }
};
/**
 * Édition : l'éditeur à gauche, les pages empilées à droite ; sinon la lecture, les pages seules,
 * côte à côte. Le mode se retrouve d'une visite à l'autre.
 */
const EDITING_KEY = "ymn:editing";
const loadEditing = (source: string) => {
  try {
    const stored = localStorage.getItem(EDITING_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    /* stockage indisponible : le mode se déduit du texte */
  }
  return !source.trim();
};
const persist = (s: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, s);
  } catch {
    /* stockage indisponible : sans conséquence */
  }
};

type Problem = { message: string; line?: number; column?: number };

function tryParse(text: string): { score?: Score; problem?: Problem } {
  // texte vide (nouvelle partition) : rien à graver, ce n'est pas une erreur
  if (!text.trim()) return {};
  try {
    return { score: parseYmn(text) };
  } catch (e) {
    if (e instanceof YmnError) return { problem: { message: e.message, line: e.line, column: e.column } };
    return { problem: { message: (e as Error).message } };
  }
}

export function App() {
  const [source, setSource] = useState(load);
  const [options, setOptionsState] = useState<RenderOptions>(loadOptions);
  const [showOptions, setShowOptions] = useState(false);
  // Échap ferme le panneau d'options
  useEffect(() => {
    if (!showOptions) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowOptions(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOptions]);
  /** Notice du pianiste, affichée à la place de l'éditeur et de l'aperçu. */
  const [showGuide, setShowGuide] = useState(false);
  /**
   * Lecture, le mode ordinaire : pour jouer. Sans l'éditeur, les pages côte à côte, chacune de toute
   * la hauteur de l'écran ; on tourne les pages au clavier ou avec une pédale tourne-pages.
   * Édition : l'éditeur à côté des pages. Une nouvelle partition, un MusicXML importé ou un .ymn
   * qui ne se grave pas s'ouvrent en édition, un .ymn en lecture.
   */
  const [editing, setEditingState] = useState(() => loadEditing(source) || !!tryParse(source).problem);
  const setEditing = (on: boolean) => {
    setEditingState(on);
    setShowGuide(false);
    try {
      localStorage.setItem(EDITING_KEY, String(on));
    } catch {
      /* stockage indisponible : sans conséquence */
    }
  };
  const reading = !editing;
  const preview = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!reading) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || target.closest("input, select, textarea, .drawer")) return;
      const turn = { PageDown: 1, ArrowRight: 1, ArrowDown: 1, PageUp: -1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      const pane = preview.current;
      if (!turn || !pane) return;
      e.preventDefault();
      const page = pane.querySelector<SVGSVGElement>(".page");
      const step = page ? page.getBoundingClientRect().width + parseFloat(getComputedStyle(pane).columnGap || "0") : pane.clientWidth;
      pane.scrollBy({ left: turn * step, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reading]);
  /** Plein écran, celui du navigateur (F11 y mène aussi) : la coche du menu le suit. */
  const [fullScreen, setFullScreen] = useState(() => !!document.fullscreenElement);
  useEffect(() => {
    const follow = () => setFullScreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", follow);
    return () => document.removeEventListener("fullscreenchange", follow);
  }, []);
  const toggleFullScreen = () => {
    const done = document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen();
    done.catch(() => setNotice("Plein écran impossible : essayez F11"));
  };
  const setOptions = (patch: Partial<RenderOptions>) => {
    const next = { ...options, ...patch };
    setOptionsState(next);
    saveOptions(next);
  };
  const [engraved, setEngraved] = useState(() => tryParse(source));
  const [fileName, setFileName] = useState("morceau.ymn");
  /** Fichier .ymn ouvert ou enregistré, réécrit en place par « Enregistrer » (Chrome, Edge). */
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  /** Texte tel qu'il est sur le disque, pour savoir s'il reste des modifications à enregistrer. */
  const [savedText, setSavedText] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Dernier texte gravé : la pastille « • » ne s'affiche que si le texte actuel en diffère. */
  const [engravedSource, setEngravedSource] = useState(source);
  const dirty = source !== engravedSource;
  const unsaved = savedText !== null && source !== savedText;
  const editor = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const engraveNow = useCallback(() => {
    setEngraved(tryParse(source));
    setEngravedSource(source);
    persist(source);
  }, [source]);

  /** Enregistre ; « sous » : toujours dans un nouveau fichier, choisi par l'utilisateur. */
  const saveFile = useCallback(async (as = false) => {
    try {
      let target = as ? null : handle;
      if (!target && canWriteInPlace) {
        target = await pickSaveTarget(fileName);
        if (!target) return; // annulé
        setHandle(target);
        setFileName(target.name);
      }
      if (target) {
        await writeFile(target, source);
        setSavedText(source);
        setNotice(`Enregistré dans ${target.name}`);
      } else {
        download(fileName, source);
        setSavedText(source);
        setNotice(`Téléchargé sous le nom ${fileName}`);
      }
    } catch (e) {
      setNotice(`Enregistrement impossible : ${(e as Error).message}`);
    }
  }, [handle, fileName, source]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        engraveNow();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveFile(e.shiftKey);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "o") {
        e.preventDefault();
        openFileRef.current();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        toggleEditingRef.current();
      }
      if (e.key === "F11") {
        e.preventDefault();
        toggleFullScreenRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [engraveNow, saveFile]);

  // gravure automatique, après un court délai sans frappe
  useEffect(() => {
    if (!options.autoEngrave || !dirty) return;
    const t = setTimeout(engraveNow, AUTO_ENGRAVE_DELAY);
    return () => clearTimeout(t);
  }, [options.autoEngrave, dirty, engraveNow]);

  // prévenir avant de quitter avec des modifications non enregistrées
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [unsaved]);

  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  const pages = useMemo(() => {
    if (!engraved.score) return [];
    // doigtés masqués : retirés avant la gravure, pour que les cases reprennent leur largeur
    const plain = options.fingerings ? engraved.score : { ...engraved.score, notes: engraved.score.notes.map(({ finger: _, ...n }) => n) };
    // « Ped. simile » : les pédales qu'il demande, gravées comme les autres ou atténuées, ou la mention seule
    const score = withSimile(plain, options.simile);
    return engrave(score, { compact: options.density === "compact", chords: options.chords, align: alignOf(options.notePosition), reminders: options.holdReminders });
  }, [engraved, options.density, options.fingerings, options.chords, options.notePosition, options.holdReminders, options.simile]);

  const open = async (file: File, fileHandle: FileSystemFileHandle | null = null, keepMode = false) => {
    const text = await file.text();
    let ymn = text;
    const isXml = /\.(musicxml|xml)$/i.test(file.name);
    // un MusicXML n'est jamais réécrit : le premier enregistrement crée un nouveau .ymn
    setHandle(isXml ? null : fileHandle);
    setSavedText(isXml ? null : text);
    if (isXml) {
      try {
        ymn = writeYmn(importMusicXml(text, file.name), { width: DEFAULT_WIDTH });
      } catch (e) {
        setEngraved({ problem: { message: `Import MusicXML impossible : ${(e as Error).message}` } });
        setEditing(true);
        return;
      }
      setFileName(file.name.replace(/\.(musicxml|xml)$/i, ".ymn"));
    } else {
      setFileName(file.name);
    }
    setSource(ymn);
    const parsed = tryParse(ymn);
    setEngraved(parsed);
    setEngravedSource(ymn);
    persist(ymn);
    // un import est presque toujours à retoucher ; un texte qui ne se grave pas montre son erreur ;
    // un fichier rechargé garde le mode en cours
    if (isXml || parsed.problem) setEditing(true);
    else if (!keepMode) setEditing(false);
  };

  /** Modifications perdues si l'on remplace le texte : on demande d'abord. */
  // rien à perdre : le fichier tel qu'enregistré, ou, sans fichier, un texte vide ou l'exemple de départ
  const pristine = savedText === null ? !source.trim() || source === SAMPLE : source === savedText;
  const confirmDiscard = (question: string) => pristine || window.confirm(question);

  const openFile = async () => {
    if (!confirmDiscard("Ouvrir un autre fichier ? Les modifications non enregistrées seront perdues.")) return;
    if (!canWriteInPlace) return fileInput.current?.click();
    try {
      const picked = await pickFile();
      if (picked) await open(picked.file, picked.handle);
    } catch (e) {
      setNotice(`Ouverture impossible : ${(e as Error).message}`);
    }
  };
  const openFileRef = useRef(openFile);
  openFileRef.current = openFile;
  const toggleEditingRef = useRef(() => {});
  toggleEditingRef.current = () => setEditing(!editing);
  const toggleFullScreenRef = useRef(toggleFullScreen);
  toggleFullScreenRef.current = toggleFullScreen;

  // glisser-déposer un fichier sur la fenêtre pour l'ouvrir ; le compteur suit les entrées et
  // sorties successives au-dessus des éléments de la page
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const hasFile = (e: React.DragEvent) => [...e.dataTransfer.types].includes("Files");
  const onDragEnter = (e: React.DragEvent) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    dragDepth.current++;
    setDragging(true);
  };
  const onDragLeave = (e: React.DragEvent) => {
    if (!hasFile(e)) return;
    if (--dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDragging(false);
    }
  };
  const onDragOver = (e: React.DragEvent) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };
  const onDrop = async (e: React.DragEvent) => {
    if (!hasFile(e)) return;
    e.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    const dropped = await droppedFile(e.dataTransfer);
    if (!dropped) return;
    if (!OPENABLE.test(dropped.file.name)) {
      setNotice(`« ${dropped.file.name} » : format non pris en charge (.ymn ou .musicxml non compressé)`);
      return;
    }
    if (!confirmDiscard(`Ouvrir ${dropped.file.name} ? Les modifications non enregistrées seront perdues.`)) return;
    try {
      await open(dropped.file, dropped.handle);
      setShowGuide(false);
    } catch (err) {
      setNotice(`Ouverture impossible : ${(err as Error).message}`);
    }
  };

  /** Nouvelle partition : tout est effacé. */
  const newFile = () => {
    if (!confirmDiscard("Effacer la partition en cours ? Les modifications non enregistrées seront perdues.")) return;
    setSource("");
    setEngraved({});
    setEngravedSource("");
    setHandle(null);
    setSavedText(null);
    setFileName("morceau.ymn");
    persist("");
    setEditing(true);
    setTimeout(() => editor.current?.focus());
  };

  /** Relit depuis le disque le fichier ouvert (modifié ailleurs, ou pour annuler ses changements). */
  const reloadFile = async () => {
    if (!handle) return;
    if (unsaved && !window.confirm(`Recharger ${handle.name} depuis le disque ? Les modifications non enregistrées seront perdues.`)) return;
    try {
      await open(await handle.getFile(), handle, true);
      setNotice(`${handle.name} rechargé`);
    } catch (e) {
      setNotice(`Rechargement impossible : ${(e as Error).message}`);
    }
  };

  /** Place le curseur sur la ligne et la colonne d'une erreur. */
  const goTo = (line?: number, column = 1) => {
    const ta = editor.current;
    if (!ta || !line) return;
    const lines = source.split("\n");
    let pos = 0;
    for (let i = 0; i < line - 1 && i < lines.length; i++) pos += lines[i].length + 1;
    pos += Math.max(0, column - 1);
    ta.focus();
    ta.setSelectionRange(pos, pos + 1);
    const lineH = parseFloat(getComputedStyle(ta).lineHeight) || 18;
    ta.scrollTop = Math.max(0, (line - 4) * lineH);
  };

  const { problem, score } = engraved;
  // écoute : le morceau gravé, avec le curseur sur la gravure ; arrêtée quand on regrave
  useEffect(() => player.load(score), [score]);
  // parties muettes : le temps d'une séance, rétablies quand les parties du morceau changent
  const [muted, setMuted] = useState<number[]>([]);
  const partsKey = JSON.stringify(score?.instruments ?? []);
  useEffect(() => setMuted([]), [partsKey]);
  useEffect(
    () =>
      player.setSound({
        metronome: options.metronome,
        muted,
        clickSounds: options.clickSounds,
        clickGrid: options.clickGrid,
        countIn: options.countIn,
        clickVolume: options.clickVolume,
      }),
    [options.metronome, muted, options.clickSounds, options.clickGrid, options.countIn, options.clickVolume],
  );

  return (
    <div className="app" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
      {dragging && (
        <div className="drop" aria-hidden>
          <p>Déposer pour ouvrir</p>
          <span>.ymn ou .musicxml</span>
        </div>
      )}
      <header className="bar">
        <span className="brand">ymn</span>
        <Menu
          label="Fichier"
          items={[
            { label: "Nouveau", onSelect: newFile },
            { label: "Ouvrir…", onSelect: openFile, shortcut: "Ctrl+O" },
            "separator",
            { label: "Enregistrer", onSelect: () => saveFile(), shortcut: "Ctrl+S" },
            { label: "Enregistrer sous…", onSelect: () => saveFile(true), shortcut: "Ctrl+Maj+S" },
            "separator",
            { label: "Recharger", onSelect: reloadFile, disabled: !handle },
          ]}
        />
        <Menu
          label="Gravure"
          items={[
            { label: "Graver", onSelect: engraveNow, shortcut: "Ctrl+Entrée" },
            { label: "Graver automatiquement", onSelect: () => setOptions({ autoEngrave: !options.autoEngrave }), checked: options.autoEngrave },
            { label: "Options", onSelect: () => setShowOptions((v) => !v), checked: showOptions },
            "separator",
            { label: "Imprimer…", onSelect: () => window.print(), shortcut: "Ctrl+P", disabled: !pages.length || showGuide },
          ]}
        />
        <Menu
          label="Affichage"
          items={[
            { label: "Éditeur", onSelect: () => setEditing(!editing), checked: editing, shortcut: "Ctrl+E" },
            { label: "Plein écran", onSelect: toggleFullScreen, checked: fullScreen, shortcut: "F11" },
          ]}
        />
        <Menu label="Aide" items={[{ label: "Notice", onSelect: () => setShowGuide((v) => !v), checked: showGuide }]} />
        <input
          ref={fileInput}
          type="file"
          accept=".ymn,.txt,.musicxml,.xml"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) open(f);
            e.target.value = "";
          }}
        />
        <span className="file" title={handle ? "Enregistrer réécrit ce fichier" : undefined}>
          {fileName}
          {unsaved || savedText === null ? <span className="unsaved"> · non enregistré</span> : null}
        </span>
        {notice && (
          <span className="notice" role="status">
            {notice}
          </span>
        )}
        <ListenControls
          score={score}
          disabled={!score || !pages.length}
          metronome={options.metronome}
          onMetronome={(metronome) => setOptions({ metronome })}
          muted={muted}
          onMuted={setMuted}
        />
        <button
          className={"icon gear" + (showOptions ? " on" : "")}
          onClick={() => setShowOptions((v) => !v)}
          aria-pressed={showOptions}
          aria-controls="options"
          title="Options"
          aria-label="Options"
        >
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden>
            <path
              fill="currentColor"
              fillRule="evenodd"
              d="M6.7 1h2.6l.4 1.9 1 .5 1.7-1 1.8 1.8-1 1.7.5 1 1.9.4v2.6l-1.9.4-.5 1 1 1.7-1.8 1.8-1.7-1-1 .5-.4 1.9H6.7l-.4-1.9-1-.5-1.7 1-1.8-1.8 1-1.7-.5-1L.4 9.3V6.7l1.9-.4.5-1-1-1.7 1.8-1.8 1.7 1 1-.5zM8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z"
            />
          </svg>
        </button>
      </header>


      <div className="workspace">
      {showGuide && (
        <main className="guide-pane">
          <button className="back" onClick={() => setShowGuide(false)}>
            ← Retour à la partition
          </button>
          <NoticeView options={options} />
        </main>
      )}
      <main className={"split" + (reading ? " reading" : "")} hidden={showGuide}>
        {/* la languette de l'éditeur, sur le bord où il apparaît : on le tire, on le repousse */}
        <button
          className="edge"
          onClick={() => setEditing(!editing)}
          aria-pressed={editing}
          title={editing ? "Masquer l'éditeur (Ctrl+E)" : "Afficher l'éditeur (Ctrl+E)"}
          aria-label="Éditeur"
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path fill="currentColor" d="M11.3 1.3a1.5 1.5 0 0 1 2.1 0l1.3 1.3a1.5 1.5 0 0 1 0 2.1l-8.6 8.6-3.9 1.2 1.2-3.9zM10.4 4 3.5 10.9l-.6 2.2 2.2-.6L12 5.6z" />
          </svg>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
            <path fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" d={editing ? "M10 3 5 8l5 5" : "M6 3l5 5-5 5"} />
          </svg>
        </button>
        <section className="source" hidden={reading}>
          <div className="editor">
          <textarea
            ref={editor}
            value={source}
            spellCheck={false}
            wrap="off"
            aria-label="Source .ymn"
            onChange={(e) => {
              setSource(e.target.value);
            }}
          />
          <EngraveButton dirty={dirty} auto={options.autoEngrave} onEngrave={engraveNow} onAuto={(autoEngrave) => setOptions({ autoEngrave })} />
          </div>
          {problem && (
            <button className="problem" onClick={() => goTo(problem.line, problem.column)}>
              {problem.message}
            </button>
          )}
        </section>

        <section
          className="preview"
          ref={preview}
          aria-label={reading ? "Partition" : "Aperçu"}
          // en lecture, la molette fait défiler les pages côte à côte
          onWheel={(e) => reading && Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.currentTarget.scrollBy({ left: e.deltaY })}
        >
          {score && !pages.length && <p className="empty">Aucune mesure à graver.</p>}
          {pages.map((p) => (
            <PageView key={p.index} page={p} total={pages.length} meta={score!.meta} options={options} />
          ))}
        </section>
      </main>
      {showOptions && <OptionsDrawer options={options} setOptions={setOptions} onClose={() => setShowOptions(false)} />}
      </div>
    </div>
  );
}
