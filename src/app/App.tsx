import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WIDTH, PrismaError, importMusicXml, parsePrisma, writePrisma } from "../core/index.ts";
import type { Score } from "../core/index.ts";
import { Menu } from "./Menu.tsx";
import { ListenControls } from "./ListenControls.tsx";
import { EngraveButton } from "./EngraveButton.tsx";
import { SourceEditor } from "./SourceEditor.tsx";
import { Message } from "./message.tsx";
import { pick as scorePick } from "./pick.ts";
import { locate, textPlace } from "../core/locate.ts";
import type { ScorePlace } from "../core/locate.ts";
import type { ScreenPoint } from "./pick.ts";
import { cellOf, durationOf, holdChoices, holdIn, moveOctave, octaveRoomOf, resize, retouch } from "./retouch.ts";
import { RetouchMenu } from "./RetouchMenu.tsx";
import { textMark } from "./textMark.ts";
import type { EditorHandle } from "./SourceEditor.tsx";
import { OptionsDrawer } from "./OptionsDrawer.tsx";

import { player } from "./player.ts";
import { follow } from "./follow.ts";
import { FocusView } from "./FocusView.tsx";
import { BackIcon } from "./icons.tsx";
import { NoticeView } from "./NoticeView.tsx";
import { LibraryView } from "./LibraryView.tsx";
import { engraveOptions, engravePages } from "./render.ts";
import { markOpened } from "./library.ts";
import type { LibraryEntry } from "./library.ts";
import { PageView } from "./PageView.tsx";
import { SAMPLE } from "./sample.ts";
import { loadOptions, saveOptions } from "./options.ts";
import type { RenderOptions } from "./options.ts";
import { scoreInstrument, staffInstruments, instrumentsOf } from "./instruments.ts";
import { PIECE_KEYS, isEmpty, isPieceKey, parseSettings, readSettings, saveSettings, settingsName, writeSettings } from "./piece.ts";
import type { PieceKey, PieceSettings } from "./piece.ts";
import { OPENABLE, canWriteInPlace, download, droppedFile, pickFile, pickSaveTarget, targetIn, writeFile } from "./files.ts";

/** Délai sans frappe avant la gravure automatique. */
const AUTO_ENGRAVE_DELAY = 600;

const STORAGE_KEY = "prisma:source";
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
const EDITING_KEY = "prisma:editing";
const loadEditing = (source: string) => {
  try {
    const stored = localStorage.getItem(EDITING_KEY);
    if (stored !== null) return stored === "true";
  } catch {
    /* stockage indisponible : le mode se déduit du texte */
  }
  return !source.trim();
};
/** Zoom de la partition : un facteur parmi ces crans, et en lecture, l'ajustement des pages. */
const ZOOMS = [0.5, 0.67, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
/** Ajustement en lecture : pages à la hauteur de l'écran, à sa largeur, ou deux systèmes seuls (lecture focalisée). */
type Fit = "height" | "width" | "focus";
const FITS: Fit[] = ["height", "width", "focus"];
type View = { zoom: number; fit: Fit };
const VIEW_KEY = "prisma:view";
const loadView = (): View => {
  try {
    const raw = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "{}");
    return { zoom: ZOOMS.includes(raw.zoom) ? raw.zoom : 1, fit: FITS.includes(raw.fit) ? raw.fit : "height" };
  } catch {
    return { zoom: 1, fit: "height" };
  }
};
const persist = (s: string) => {
  try {
    localStorage.setItem(STORAGE_KEY, s);
  } catch {
    /* stockage indisponible : sans conséquence */
  }
};

/** Les seules options du rendu, celles qu'une partition peut définir. */
const pick = (patch: Partial<RenderOptions>) => Object.fromEntries(Object.entries(patch).filter(([k]) => isPieceKey(k))) as Partial<RenderOptions>;

/** Les réglages du morceau en cours, gardés avec son texte d'une visite à l'autre. */
const PIECE_KEY = "prisma:piece";
const loadPiece = (): PieceSettings => {
  try {
    const text = localStorage.getItem(PIECE_KEY);
    return text ? parseSettings(text) : {};
  } catch {
    return {};
  }
};
const persistPiece = (s: PieceSettings) => {
  try {
    if (isEmpty(s)) localStorage.removeItem(PIECE_KEY);
    else localStorage.setItem(PIECE_KEY, writeSettings(s));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
};

type Problem = { message: string; line?: number; column?: number };

function tryParse(text: string): { score?: Score; problem?: Problem } {
  // texte vide (nouvelle partition) : rien à graver, ce n'est pas une erreur
  if (!text.trim()) return {};
  try {
    return { score: parsePrisma(text) };
  } catch (e) {
    if (e instanceof PrismaError) return { problem: { message: e.message, line: e.line, column: e.column } };
    return { problem: { message: (e as Error).message } };
  }
}

export function App() {
  const [source, setSource] = useState(load);
  /** Les options de tous les morceaux. */
  const [general, setGeneral] = useState<RenderOptions>(loadOptions);
  /**
   * Les réglages du morceau en cours : son tempo, ses portées muettes, les options de mise en
   * page choisies pour lui seul. Ils s'enregistrent à côté de lui quand on connaît son dossier
   * (un morceau de la bibliothèque) ; sinon ils durent le temps qu'on le garde ouvert.
   */
  const [piece, setPieceState] = useState<PieceSettings>(loadPiece);
  /** Les options en vigueur : celles du morceau, à défaut les générales. */
  const options = useMemo<RenderOptions>(() => ({ ...general, ...piece.options }), [general, piece.options]);
  /** Dossier du morceau, où s'enregistrent ses réglages (un morceau ouvert depuis la bibliothèque). */
  const [pieceDir, setPieceDir] = useState<FileSystemDirectoryHandle | null>(null);
  /** Change à chaque morceau ouvert : ce qui suit un changement de morceau n'est pas un choix de l'utilisateur. */
  const [pieceId, setPieceId] = useState(0);
  // un réglage changé à la main, à enregistrer (pas ceux qu'on vient de lire)
  const pieceChanged = useRef(false);
  const updatePiece = (patch: Partial<PieceSettings>) =>
    setPieceState((cur) => {
      const next = { ...cur, ...patch };
      for (const k of Object.keys(next) as (keyof PieceSettings)[]) if (next[k] === undefined) delete next[k];
      pieceChanged.current = true;
      persistPiece(next);
      return next;
    });
  /** Un autre morceau : ses réglages, lus à côté de lui ou vides. */
  const resetPiece = (s: PieceSettings, dir: FileSystemDirectoryHandle | null) => {
    pieceChanged.current = false;
    setPieceState(s);
    persistPiece(s);
    setPieceDir(dir);
    setPieceId((n) => n + 1);
  };
  const [showOptions, setShowOptions] = useState(false);
  // Échap ferme le panneau d'options
  useEffect(() => {
    if (!showOptions) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShowOptions(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [showOptions]);
  /** Notice du pianiste, affichée à la place de l'éditeur et de l'aperçu. */
  const [showGuide, setShowGuideState] = useState(false);
  /** Bibliothèque, affichée elle aussi à la place de l'éditeur et des pages. */
  const [showLibrary, setShowLibraryState] = useState(false);
  // l'une chasse l'autre
  const setShowGuide = (v: boolean | ((v: boolean) => boolean)) =>
    setShowGuideState((cur) => {
      const next = typeof v === "function" ? v(cur) : v;
      if (next) setShowLibraryState(false);
      return next;
    });
  const setShowLibrary = (v: boolean | ((v: boolean) => boolean)) =>
    setShowLibraryState((cur) => {
      const next = typeof v === "function" ? v(cur) : v;
      if (next) setShowGuideState(false);
      return next;
    });
  /** Dossier d'un MusicXML ouvert depuis la bibliothèque : son .prisma s'y enregistre, à côté de lui. */
  const [saveDir, setSaveDir] = useState<FileSystemDirectoryHandle | null>(null);
  /**
   * Lecture, le mode ordinaire : pour jouer. Sans l'éditeur, les pages côte à côte, chacune de toute
   * la hauteur de l'écran ; on tourne les pages au clavier ou avec une pédale tourne-pages.
   * Édition : l'éditeur à côté des pages. Une nouvelle partition, un MusicXML importé ou un .prisma
   * qui ne se grave pas s'ouvrent en édition, un .prisma en lecture.
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
  /**
   * Zoom de la partition, retenu d'une visite à l'autre : un facteur, et l'ajustement des pages à
   * la place laissée à la partition (la moitié de l'écran éditeur ouvert, tout l'écran sinon) : à
   * sa hauteur (côte à côte), à sa largeur (l'une sous l'autre, pour jouer en plus grand en faisant
   * défiler de haut en bas), ou deux systèmes seuls (lecture focalisée). Choisir un ajustement
   * remet le zoom à 100 % : la page tient alors exactement ; le zoom part de là.
   */
  const [view, setViewState] = useState(loadView);
  const setView = (patch: Partial<View>) =>
    setViewState((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible : sans conséquence */
      }
      return next;
    });
  const zoomBy = (dir: 1 | -1) =>
    setViewState((cur) => {
      if (focusRef.current) return cur;
      const zoom = dir > 0 ? (ZOOMS.find((z) => z > cur.zoom + 1e-6) ?? cur.zoom) : ([...ZOOMS].reverse().find((z) => z < cur.zoom - 1e-6) ?? cur.zoom);
      const next = { ...cur, zoom };
      try {
        localStorage.setItem(VIEW_KEY, JSON.stringify(next));
      } catch {
        /* stockage indisponible : sans conséquence */
      }
      return next;
    });
  // en lecture focalisée, les deux systèmes remplissent l'écran : pas de zoom
  const focused = view.fit === "focus";
  const focusRef = useRef(false);
  focusRef.current = focused;
  const zoomByRef = useRef(zoomBy);
  zoomByRef.current = zoomBy;
  // Ctrl + molette sur la partition : le zoom de la partition, pas celui de la page entière
  useEffect(() => {
    const pane = preview.current;
    if (!pane) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return follow.hold();
      e.preventDefault();
      zoomByRef.current(e.deltaY < 0 ? 1 : -1);
    };
    // défiler à la main (molette, doigt, barre de défilement) suspend le suivi de la lecture ;
    // pendant la promenade, tout défilement est le sien (le suivi, lui, ne fait plus défiler) et
    // la prolonge, jusqu'à une seconde sans geste
    const hold = () => follow.hold();
    const onBar = (e: PointerEvent) => e.target === pane && (e.offsetX > pane.clientWidth || e.offsetY > pane.clientHeight) && hold();
    const onScroll = () => !follow.active() && follow.enabled() && hold();
    pane.addEventListener("wheel", onWheel, { passive: false });
    pane.addEventListener("touchmove", hold, { passive: true });
    pane.addEventListener("pointerdown", onBar);
    pane.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      pane.removeEventListener("wheel", onWheel);
      pane.removeEventListener("touchmove", hold);
      pane.removeEventListener("pointerdown", onBar);
      pane.removeEventListener("scroll", onScroll);
    };
  }, []);
  useEffect(() => {
    if (!reading) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || target.closest("input, select, textarea, .cm-editor, .drawer")) return;
      const turn = { PageDown: 1, ArrowRight: 1, ArrowDown: 1, PageUp: -1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      const pane = preview.current;
      if (!turn || !pane || view.fit === "focus") return;
      e.preventDefault();
      follow.hold();
      // ajustées à la largeur, les pages se suivent de haut en bas : on avance d'un écran
      if (view.fit === "width") return pane.scrollBy({ top: turn * pane.clientHeight * 0.9, behavior: "smooth" });
      const page = pane.querySelector<SVGSVGElement>(".page");
      const step = page ? page.getBoundingClientRect().width + parseFloat(getComputedStyle(pane).columnGap || "0") : pane.clientWidth;
      pane.scrollBy({ left: turn * step, behavior: "smooth" });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reading, view.fit]);
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
  const saveGeneral = (next: RenderOptions) => {
    setGeneral(next);
    saveOptions(next);
  };
  /** Les options générales (l'édition, l'écoute, le menu : toujours celles-là). */
  const setOptions = (patch: Partial<RenderOptions>) => saveGeneral({ ...general, ...patch });
  /** Les options du rendu définies pour la partition ouverte, ou retirées (elle suit alors les générales). */
  const setPieceOptions = (patch: Partial<RenderOptions>) => updatePiece({ options: { ...piece.options, ...pick(patch) } });
  const unsetPieceOptions = (keys: PieceKey[]) => {
    const own: Record<string, unknown> = { ...piece.options };
    for (const k of keys) delete own[k];
    updatePiece({ options: Object.keys(own).length ? (own as PieceSettings["options"]) : undefined });
  };
  const [engraved, setEngraved] = useState(() => tryParse(source));
  const [fileName, setFileName] = useState("morceau.prisma");
  /** Fichier .prisma ouvert ou enregistré, réécrit en place par « Enregistrer » (Chrome, Edge). */
  const [handle, setHandle] = useState<FileSystemFileHandle | null>(null);
  /** Texte tel qu'il est sur le disque, pour savoir s'il reste des modifications à enregistrer. */
  const [savedText, setSavedText] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  /** Dernier texte gravé : la pastille « • » ne s'affiche que si le texte actuel en diffère. */
  const [engravedSource, setEngravedSource] = useState(source);
  const dirty = source !== engravedSource;
  const unsaved = savedText !== null && source !== savedText;
  const editor = useRef<EditorHandle>(null);
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
      if (!target && !as && saveDir) {
        target = await targetIn(saveDir, fileName);
        if (!target) return; // annulé
        setHandle(target);
      }
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
  }, [handle, fileName, source, saveDir]);

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
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        setShowLibrary((v) => !v);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "e") {
        e.preventDefault();
        toggleEditingRef.current();
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === "+" || e.key === "=" || e.key === "-" || e.key === "0")) {
        e.preventDefault();
        if (e.key === "0") setViewRef.current({ zoom: 1 });
        else zoomByRef.current(e.key === "-" ? -1 : 1);
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

  const engraving = JSON.stringify(engraveOptions(options));
  const pages = useMemo(() => (engraved.score ? engravePages(engraved.score, JSON.parse(engraving)) : []), [engraved, engraving]);

  const open = async (file: File, fileHandle: FileSystemFileHandle | null = null, keepMode = false, dir: FileSystemDirectoryHandle | null = null) => {
    const text = await file.text();
    let prisma = text;
    const isXml = /\.(musicxml|xml)$/i.test(file.name);
    const name = isXml ? file.name.replace(/\.(musicxml|xml)$/i, ".prisma") : file.name;
    // les réglages du morceau, à côté de lui ; illisibles, on le dit et on part des options générales
    let settings: PieceSettings = {};
    if (dir) {
      try {
        settings = (await readSettings(dir, name)) ?? {};
      } catch (e) {
        setNotice(`Réglages de ${name} ignorés (${settingsName(name)} : ${(e as Error).message})`);
      }
    }
    resetPiece(settings, dir);
    setSaveDir(isXml ? dir : null);
    // un MusicXML n'est jamais réécrit : le premier enregistrement crée un nouveau .prisma
    setHandle(isXml ? null : fileHandle);
    setSavedText(isXml ? null : text);
    if (isXml) {
      try {
        prisma = writePrisma(importMusicXml(text, file.name), { width: DEFAULT_WIDTH });
      } catch (e) {
        setEngraved({ problem: { message: `Import MusicXML impossible : ${(e as Error).message}` } });
        setEditing(true);
        return;
      }
      setFileName(file.name.replace(/\.(musicxml|xml)$/i, ".prisma"));
    } else {
      setFileName(file.name);
    }
    setSource(prisma);
    const parsed = tryParse(prisma);
    setEngraved(parsed);
    setEngravedSource(prisma);
    persist(prisma);
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
  /** Ouvre un morceau de la bibliothèque. */
  const openEntry = async (entry: LibraryEntry) => {
    if (!confirmDiscard(`Ouvrir ${entry.name} ? Les modifications non enregistrées seront perdues.`)) return;
    try {
      await open(await entry.handle.getFile(), entry.kind === "prisma" ? entry.handle : null, false, entry.dir);
      markOpened(entry.path);
      setShowLibrary(false);
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
  const setViewRef = useRef(setView);
  setViewRef.current = setView;

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
      setNotice(`« ${dropped.file.name} » : format non pris en charge (.prisma ou .musicxml non compressé)`);
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
    setSaveDir(null);
    resetPiece({}, null);
    setFileName("morceau.prisma");
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
    if (line) editor.current?.goTo(line, column);
  };

  const playing = () => ["playing", "loading"].includes(player.getSnapshot().state);
  // un clic sur la partition : le curseur du texte va sur le signe cliqué, sans prendre le clavier ;
  // un double-clic ouvre le choix de la note de la case
  const sourceNow = useRef(source);
  sourceNow.current = source;
  type Retouch = { at: ScorePlace; where: ScreenPoint; content: string; canHold: boolean; duration?: ReturnType<typeof durationOf>; holds: string[] };
  const [retouchAt, setRetouchAt] = useState<Retouch | null>(null);
  // ce que le choix montre d'une case : son contenu, la durée de sa note, les notes qu'elle peut tenir
  const describe = (text: string, at: ScorePlace, where: ScreenPoint): Retouch | null => {
    const cell = at.octave !== undefined ? cellOf(text, at) : undefined;
    if (!cell) return null;
    const duration = cell.content ? durationOf(text, at) : undefined;
    return { at: duration?.attack ?? at, where, content: cell.content, canHold: cell.canHold, duration, holds: cell.content || !cell.exact ? [] : holdChoices(text, at) };
  };
  useEffect(
    () =>
      scorePick.subscribe((at, where, kind) => {
        // pendant l'écoute, la partition ne s'édite pas : le clic n'y place que l'écoute
        if (playing()) return;
        if (kind === "edit") {
          setRetouchAt(describe(sourceNow.current, at, where));
          return;
        }
        if (reading || !options.scoreToText) return;
        const p = locate(sourceNow.current, at);
        if (p) editor.current?.goTo(p.line, p.column, false);
      }),
    [reading, options.scoreToText],
  );
  const closeRetouch = useCallback(() => setRetouchAt(null), []);
  // l'écoute qui démarre ferme le choix
  useEffect(() => {
    const off = player.subscribe(() => playing() && setRetouchAt(null));
    return () => void off();
  }, []);
  // la retouche écrite dans le texte (comme une frappe), puis la partition remise en page
  const engraveAfter = useRef(false);
  const write = (r: { text: string; line: number; column: number } | undefined) => {
    if (!r || r.text === sourceNow.current) return false;
    engraveAfter.current = true;
    editor.current?.replace(r.text, r.line, r.column);
    return true;
  };
  const applyRetouch = (content: string) => {
    if (retouchAt) write(retouch(sourceNow.current, retouchAt.at, content));
    setRetouchAt(null);
  };
  // la durée : le choix reste ouvert, pour allonger ou raccourcir encore
  const applyResize = (by: 1 | -1) => {
    if (!retouchAt) return;
    const r = resize(sourceNow.current, retouchAt.at, by);
    if (write(r)) setRetouchAt(describe(r!.text, retouchAt.at, retouchAt.where));
  };
  // un ajout à la note (doigté, trille, petite note) : le choix reste ouvert, pour en faire d'autres
  const applyAmend = (content: string) => {
    if (!retouchAt) return;
    const r = retouch(sourceNow.current, retouchAt.at, content);
    if (write(r)) setRetouchAt(describe(r!.text, { ...retouchAt.at, content }, retouchAt.where));
  };
  // l'octave de la note : le choix reste ouvert, sur la note à sa nouvelle place
  const applyOctave = (dir: 1 | -1) => {
    if (!retouchAt) return;
    const r = moveOctave(sourceNow.current, retouchAt.at, dir);
    if (write(r)) setRetouchAt(describe(r!.text, { ...retouchAt.at, octave: r!.octave }, retouchAt.where));
  };
  const applyHold = (note: string) => {
    if (retouchAt) write(holdIn(sourceNow.current, retouchAt.at, note));
    setRetouchAt(null);
  };
  useEffect(() => {
    if (!engraveAfter.current) return;
    engraveAfter.current = false;
    engraveNow();
  }, [source, engraveNow]);

  // le curseur du texte : le signe qu'il pointe est encadré sur la partition, et amené à l'écran
  // quand il bouge (sauf pendant l'écoute, qui mène le défilement)
  // (sans rendu de l'application à chaque mouvement du curseur : la partition écoute textMark)
  const caretAt = useRef<[number, number, string] | null>(null);
  const linked = !reading && options.scoreToText;
  const linkedNow = useRef(linked);
  linkedNow.current = linked;
  const markCaret = useCallback((reveal: boolean) => {
    const c = caretAt.current;
    const place = linkedNow.current && c ? textPlace(c[2], c[0], c[1]) : undefined;
    textMark.set(place ? { place, reveal: reveal && player.getSnapshot().state !== "playing" } : null);
  }, []);
  useEffect(() => markCaret(false), [linked, markCaret]);

  const { problem: engravedProblem, score } = engraved;
  // le texte relu pendant la frappe : ses erreurs, toutes (undefined : pas encore relu)
  const [checked, setChecked] = useState<Problem[] | undefined>(undefined);
  // les erreurs à montrer : celles du texte tel qu'il est, pas celle de la dernière mise en page,
  // qu'on a pu corriger depuis (une erreur sans place, celle d'un import, reste celle de la mise en page)
  const problems: Problem[] = engravedProblem?.line !== undefined && checked !== undefined ? checked : engravedProblem ? [engravedProblem] : [];
  // celle du bandeau sous l'éditeur, quand il y en a plusieurs : on passe de l'une à l'autre
  const [shownError, setShownError] = useState(0);
  const shown = problems.length ? Math.min(shownError, problems.length - 1) : 0;
  const problem: Problem | undefined = problems[shown];
  const showError = (k: number) => {
    const n = (k + problems.length) % problems.length;
    setShownError(n);
    goTo(problems[n].line, problems[n].column);
  };
  // corrigée, mais pas encore remise en page
  const fixed = !!engravedProblem && engravedProblem.line !== undefined && checked !== undefined && !checked.length;
  // écoute : le morceau gravé, avec le curseur sur la gravure ; arrêtée quand on regrave
  useEffect(() => player.load(score), [score]);
  // portées muettes, propres au morceau : rétablies quand on change ses portées en l'écrivant
  const muted = piece.muted ?? [];
  const setMuted = (staves: number[]) => updatePiece({ muted: staves.length ? staves : undefined });
  // instruments, propres au morceau : chaque partie a le sien, deviné d'après son nom ou choisi
  const parts = useMemo(() => score?.parts ?? [], [score]);
  const instruments = useMemo(() => instrumentsOf(parts, piece.instruments), [parts, piece.instruments]);
  const setInstrument = (part: number, instrument: string) => {
    const chosen = parts.map((_, i) => piece.instruments?.[i] ?? null);
    // l'instrument de la partition n'est pas un choix : il n'est pas retenu
    chosen[part] = parts[part] && instrument === scoreInstrument(parts[part]) ? null : instrument;
    updatePiece({ instruments: chosen.some((t) => t !== null) ? chosen : undefined });
  };
  useEffect(() => {
    player.setInstruments(staffInstruments(parts, instruments));
  }, [parts, instruments]);
  const partsKey = JSON.stringify(score?.parts ?? []);
  // tempo choisi, propre au morceau : un nouveau tempo écrit dans la partition reprend la main ;
  // de nouvelles parties effacent les portées muettes et les instruments choisis
  const written = score?.meta.bpm;
  const seen = useRef({ pieceId, partsKey, written });
  useEffect(() => {
    // une partition illisible (une erreur à corriger) ne change rien : on compare à la dernière lue
    if (!score && seen.current.pieceId === pieceId) return;
    const before = seen.current;
    seen.current = { pieceId, partsKey, written };
    if (before.pieceId !== pieceId) return; // un autre morceau : ses réglages viennent d'être lus
    if (before.partsKey !== partsKey && (piece.muted || piece.instruments)) updatePiece({ muted: undefined, instruments: undefined });
    if (before.written !== written && piece.tempo !== undefined) updatePiece({ tempo: undefined });
  }, [pieceId, partsKey, written]);
  // enregistrement des réglages du morceau, à côté de lui, peu après le dernier changement ; il
  // faut son dossier et le morceau lui-même sur le disque (un MusicXML importé : à son
  // premier enregistrement en .prisma)
  useEffect(() => {
    if (!pieceChanged.current || !pieceDir || !handle) return;
    const name = handle.name;
    const timer = setTimeout(() => {
      pieceChanged.current = false;
      saveSettings(pieceDir, name, piece).catch((e) => setNotice(`Réglages du morceau non enregistrés : ${(e as Error).message}`));
    }, 400);
    return () => clearTimeout(timer);
  }, [piece, pieceDir, handle]);
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
          <span>.prisma ou .musicxml</span>
        </div>
      )}
      <header className="bar">
        <span className="brand">Prisma</span>
        <Menu
          label="Fichier"
          items={[
            { label: "Nouveau", onSelect: newFile },
            { label: "Ouvrir…", onSelect: openFile, shortcut: "Ctrl+O" },
            { label: "Bibliothèque", onSelect: () => setShowLibrary((v) => !v), checked: showLibrary, shortcut: "Ctrl+B" },
            "separator",
            { label: "Enregistrer", onSelect: () => saveFile(), shortcut: "Ctrl+S" },
            { label: "Enregistrer sous…", onSelect: () => saveFile(true), shortcut: "Ctrl+Maj+S" },
            "separator",
            { label: "Recharger", onSelect: reloadFile, disabled: !handle },
          ]}
        />
        <Menu
          label="Partition"
          items={[
            { label: "Mettre en page", onSelect: engraveNow, shortcut: "Ctrl+Entrée" },
            { label: "Mettre en page automatiquement", onSelect: () => setOptions({ autoEngrave: !options.autoEngrave }), checked: options.autoEngrave },
            { label: "Options", onSelect: () => setShowOptions((v) => !v), checked: showOptions },
            "separator",
            { label: "Imprimer…", onSelect: () => window.print(), shortcut: "Ctrl+P", disabled: !pages.length || showGuide || showLibrary },
          ]}
        />
        <Menu
          label="Affichage"
          items={[
            { label: "Éditeur", onSelect: () => setEditing(!editing), checked: editing, shortcut: "Ctrl+E" },
            { label: "Plein écran", onSelect: toggleFullScreen, checked: fullScreen, shortcut: "F11" },
            "separator",
            { label: "Zoom avant", onSelect: () => zoomBy(1), shortcut: "Ctrl++", disabled: view.zoom >= ZOOMS[ZOOMS.length - 1] || focused },
            { label: "Zoom arrière", onSelect: () => zoomBy(-1), shortcut: "Ctrl+−", disabled: view.zoom <= ZOOMS[0] || focused },
            { label: `Taille normale${view.zoom !== 1 ? ` (zoom ${Math.round(view.zoom * 100)} %)` : ""}`, onSelect: () => setView({ zoom: 1 }), shortcut: "Ctrl+0", disabled: view.zoom === 1 || focused },
            "separator",
            { label: "Ajuster à la hauteur", onSelect: () => setView({ fit: "height", zoom: 1 }), checked: view.fit === "height" && view.zoom === 1 },
            { label: "Ajuster à la largeur", onSelect: () => setView({ fit: "width", zoom: 1 }), checked: view.fit === "width" && view.zoom === 1 },
            { label: "Lecture focalisée : deux systèmes", onSelect: () => setView({ fit: "focus", zoom: 1 }), checked: view.fit === "focus" },
          ]}
        />
        <Menu label="Aide" items={[{ label: "Notice", onSelect: () => setShowGuide((v) => !v), checked: showGuide }]} />
        <input
          ref={fileInput}
          type="file"
          accept=".prisma,.txt,.musicxml,.xml"
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
          instruments={instruments}
          onInstrument={setInstrument}
          tempo={piece.tempo ?? null}
          onTempo={(tempo) => updatePiece({ tempo: tempo ?? undefined })}
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
          <button className="back icon" onClick={() => setShowGuide(false)} title="Retour à la partition" aria-label="Retour à la partition">
            <BackIcon />
          </button>
          <NoticeView options={general} />
        </main>
      )}
      {showLibrary && <LibraryView options={general} onOpen={openEntry} onClose={() => setShowLibrary(false)} />}
      <main className={"split" + (reading ? " reading" : "") + ` fit-${view.fit}` + (view.zoom > 1 ? " zoomed" : "")} hidden={showGuide || showLibrary}>
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
          <SourceEditor value={source} onChange={setSource} editor={editor} noteNames={options.noteNames} colors={options.sourceColors} palette={options.octaveColors} onCheck={setChecked} onCaret={(line, column, text) => ((caretAt.current = [line, column, text]), markCaret(true))}>
            <EngraveButton dirty={dirty} auto={options.autoEngrave} onEngrave={engraveNow} onAuto={(autoEngrave) => setOptions({ autoEngrave })} />
          </SourceEditor>
          {problem && (
            <div className="problem">
              <button className="problem-message" onClick={() => goTo(problem.line, problem.column)} title="aller à l'erreur">
                <Message text={problem.message} />
              </button>
              {problems.length > 1 && (
                <span className="problem-nav">
                  <button onClick={() => showError(shown - 1)} title="erreur précédente (Maj+F8 dans l'éditeur)" aria-label="Erreur précédente">
                    ‹
                  </button>
                  <span>
                    {shown + 1}/{problems.length}
                  </span>
                  <button onClick={() => showError(shown + 1)} title="erreur suivante (F8 dans l'éditeur)" aria-label="Erreur suivante">
                    ›
                  </button>
                </span>
              )}
            </div>
          )}
        </section>

        <section
          className="preview"
          ref={preview}
          aria-label={reading ? "Partition" : "Aperçu"}
          // la molette fait défiler de côté les pages côte à côte
          // (ajustées à la hauteur et sans zoom : sinon la molette garde son sens, de haut en bas)
          onWheel={(e) => view.fit === "height" && view.zoom <= 1 && !e.ctrlKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.currentTarget.scrollBy({ left: e.deltaY })}
          style={{ "--zoom": view.zoom } as React.CSSProperties}
        >
          {score && !pages.length && <p className="empty">Aucune mesure à mettre en page.</p>}
          {retouchAt && (
            <RetouchMenu
              x={retouchAt.where.x}
              y={retouchAt.where.y}
              octave={retouchAt.at.octave}
              content={retouchAt.content}
              canHold={retouchAt.canHold}
              duration={retouchAt.duration}
              holds={retouchAt.holds}
              names={options.noteNames}
              onPick={applyRetouch}
              onResize={applyResize}
              onHold={applyHold}
              onAmend={applyAmend}
              octaves={retouchAt.duration ? octaveRoomOf(retouchAt.at) : undefined}
              onOctave={applyOctave}
              onClose={closeRetouch}
            />
          )}
          {/* une erreur : la partition n'a pas pu être mise en page ; on dit pourquoi, et où corriger */}
          {fixed && (
            <div className="preview-problem fixed" role="status">
              <p className="preview-problem-title">L'erreur est corrigée.</p>
              <p className="empty">Mettez le texte en page (Ctrl+Entrée) pour voir la partition.</p>
              <button onClick={engraveNow}>Mettre en page</button>
            </div>
          )}
          {problem && (
            <div className="preview-problem" role="alert">
              <p className="preview-problem-title">
                {problem.line ? `La partition ne peut pas être mise en page : le texte contient ${problems.length > 1 ? `${problems.length} erreurs` : "une erreur"}.` : "La partition ne peut pas être affichée."}
              </p>
              <p>
                <Message text={problems[0].message} />
              </p>
              {problem.line !== undefined && (
                <>
                  <p className="empty">
                    {options.autoEngrave ? `Une fois ${problems.length > 1 ? "les erreurs corrigées" : "l'erreur corrigée"}, la mise en page reprend d'elle-même.` : `Une fois ${problems.length > 1 ? "les erreurs corrigées" : "l'erreur corrigée"}, remettez en page (Ctrl+Entrée).`}
                  </p>
                  <button onClick={() => showError(0)}>{problems.length > 1 ? "Aller à la première" : "Aller à l'erreur"}</button>
                </>
              )}
            </div>
          )}
          {focused ? (
            <>
              <FocusView pages={pages} options={options} />
              {/* à l'impression, les pages, comme dans les autres lectures */}
              <div className="print-pages">
                {pages.map((p) => (
                  <PageView key={p.index} page={p} total={pages.length} meta={score!.meta} options={options} still />
                ))}
              </div>
            </>
          ) : (
            pages.map((p) => <PageView key={p.index} page={p} total={pages.length} meta={score!.meta} options={options} />)
          )}
        </section>
      </main>
      {showOptions && (
        <OptionsDrawer
          piece={{
            general,
            own: piece.options ?? {},
            setGeneral: setOptions,
            setPiece: setPieceOptions,
            unsetPiece: unsetPieceOptions,
            name: fileName,
            where: pieceDir && handle ? settingsName(handle.name) : null,
            keys: PIECE_KEYS,
          }}
          onClose={() => setShowOptions(false)}
        />
      )}
      </div>
    </div>
  );
}
