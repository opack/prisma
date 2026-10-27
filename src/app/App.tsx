import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WIDTH, PrismaError, convertToStrings, exportMusicXml, importMusicXml, parsePrisma, stringsOfStaff, writePrisma } from "../core/index.ts";
import type { ConversionOptions, ExportOptions, Part, Score } from "../core/index.ts";
import { ConvertDialog } from "./editor/ConvertDialog.tsx";
import { NewDialog } from "./files/NewDialog.tsx";
import { firstCell } from "./editor/templates.ts";
import type { Template } from "./editor/templates.ts";
import { ExportDialog } from "./files/ExportDialog.tsx";
import { Menu } from "./ui/Menu.tsx";
import type { MenuItem } from "./ui/Menu.tsx";
import { ListenControls } from "./playback/ListenControls.tsx";
import { EngraveButton } from "./score/EngraveButton.tsx";
import { SourceEditor } from "./editor/SourceEditor.tsx";
import { Message } from "./editor/message.tsx";
import { pick as scorePick } from "./score/pick.ts";
import { STRING_LANE, locate, textPlace } from "../core/locate.ts";
import type { ScorePlace } from "../core/locate.ts";
import type { ScreenPoint } from "./score/pick.ts";
import { cellOf, durationOf, holdChoices, holdIn, freeStrings, moveOctave, octaveRoomOf, placeOnString, resize, retouch } from "./retouch/retouch.ts";
import { RetouchMenu } from "./retouch/RetouchMenu.tsx";
import { textMark } from "./score/textMark.ts";
import type { EditorHandle } from "./editor/SourceEditor.tsx";
import { OptionsDrawer } from "./options/OptionsDrawer.tsx";

import { DEFAULT_BPM, player } from "./playback/player.ts";
import { Progress } from "./playback/Progress.tsx";
import { follow } from "./score/follow.ts";
import { FocusView } from "./score/FocusView.tsx";
import { ReferenceView } from "./reference/ReferenceView.tsx";
import { LibraryView } from "./library/LibraryView.tsx";
import { engraveOptions, engravePages } from "./score/render.ts";
import { markOpened } from "./library/library.ts";
import type { LibraryEntry } from "./library/library.ts";
import { PageView } from "./score/PageView.tsx";
import { SAMPLE } from "./files/sample.ts";
import { loadOptions, saveOptions } from "./options/options.ts";
import type { RenderOptions } from "./options/options.ts";
import { scoreInstrument, staffInstruments, instrumentsOf } from "./playback/instruments.ts";
import { PIECE_KEYS, isEmpty, isPieceKey, parseSettings, readSettings, saveSettings, settingsName, writeSettings } from "./options/piece.ts";
import type { PieceKey, PieceSettings } from "./options/piece.ts";
import { BackButton } from "./ui/BackButton.tsx";
import { ScrollBackButton } from "./ui/ScrollBackButton.tsx";
import { OPENABLE, canWriteInPlace, download, droppedFile, pickExportTarget, pickFile, pickSaveTarget, targetIn, writeFile } from "./files/files.ts";

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
/** La largeur de l'éditeur, en part de la largeur de l'écran : par défaut, et ses bornes. */
const EDITOR_WIDTH = 0.42;
const clampWidth = (w: number) => Math.round(Math.min(0.8, Math.max(0.2, w)) * 1000) / 1000;
/** La vue : le zoom, l'ajustement des pages, la largeur de l'éditeur, la piste de lecture montrée ou non. */
type View = { zoom: number; fit: Fit; editorWidth: number; progress: boolean };
const VIEW_KEY = "prisma:view";
const loadView = (): View => {
  try {
    const raw = JSON.parse(localStorage.getItem(VIEW_KEY) ?? "{}");
    return {
      zoom: ZOOMS.includes(raw.zoom) ? raw.zoom : 1,
      fit: FITS.includes(raw.fit) ? raw.fit : "height",
      editorWidth: typeof raw.editorWidth === "number" ? clampWidth(raw.editorWidth) : EDITOR_WIDTH,
      progress: raw.progress !== false,
    };
  } catch {
    return { zoom: 1, fit: "height", editorWidth: EDITOR_WIDTH, progress: true };
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

/** Un message dans l'aperçu : pourquoi la partition ne se met pas en page. */
const previewProblem = "max-w-[460px] mx-auto my-12 px-5 py-4 bg-white border border-line border-l-4 rounded-md shadow-[0_2px_10px_rgba(0,0,0,0.06)] [&_p]:mb-2";

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
  /** La référence, affichée à la place de l'éditeur et de l'aperçu. */
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
  const [scrolled, setScrolled] = useState<"up" | "left" | null>(null);
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
  /**
   * La barre entre l'éditeur et la partition : on la tire pour régler la largeur de l'éditeur, au
   * clavier avec les flèches ; un double-clic rend la largeur par défaut. Pendant le glissé, seule
   * la variable CSS change ; la largeur est retenue au lâcher.
   */
  const split = useRef<HTMLElement>(null);
  const dragSplitter = (e: React.PointerEvent<HTMLDivElement>) => {
    const host = split.current;
    if (!host || e.button !== 0) return;
    e.preventDefault();
    const bar = e.currentTarget;
    bar.setPointerCapture(e.pointerId);
    const rect = host.getBoundingClientRect();
    let width = view.editorWidth;
    const move = (ev: PointerEvent) => {
      width = clampWidth((ev.clientX - rect.left) / rect.width);
      host.style.setProperty("--editor", `${width * 100}%`);
    };
    const up = () => {
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.removeEventListener("pointercancel", up);
      host.classList.remove("resizing");
      setView({ editorWidth: width });
    };
    host.classList.add("resizing");
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    bar.addEventListener("pointercancel", up);
  };
  const keySplitter = (e: React.KeyboardEvent) => {
    const step = e.key === "ArrowLeft" ? -0.02 : e.key === "ArrowRight" ? 0.02 : 0;
    if (!step) return;
    e.preventDefault();
    setView({ editorWidth: clampWidth(view.editorWidth + step) });
  };
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
    const onScroll = () => {
      if (!follow.active() && follow.enabled()) hold();
      // la première page sortie de l'écran : le bouton qui ramène au début, sa flèche dans le sens du défilement
      const first = pane.querySelector(".page")?.getBoundingClientRect();
      const across = first ? pane.scrollLeft > first.width : false, down = first ? pane.scrollTop > first.height : false;
      setScrolled(across ? "left" : down ? "up" : null);
    };
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
      if (e.ctrlKey || e.metaKey || e.altKey || target.closest("input, select, textarea, .cm-editor, [data-drawer]")) return;
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

  /** Exporte le texte, tel qu'il est, en MusicXML : un fichier à part, le .prisma ne change pas. */
  // l'export demande d'abord ses options
  const [exporting, setExporting] = useState(false);
  const exportFile = useCallback(async (options: ExportOptions) => {
    setExporting(false);
    let xml: string;
    try {
      xml = exportMusicXml(parsePrisma(source), options);
    } catch (e) {
      setNotice(`Export impossible : ${(e as Error).message}`);
      return;
    }
    const name = fileName.replace(/\.(prisma|txt|musicxml|xml)$/i, "") + ".musicxml";
    try {
      if (canWriteInPlace) {
        const target = await pickExportTarget(name);
        if (!target) return; // annulé
        await writeFile(target, xml);
        setNotice(`Exporté dans ${target.name}`);
      } else {
        download(name, xml);
        setNotice(`Exporté sous le nom ${name}`);
      }
    } catch (e) {
      setNotice(`Export impossible : ${(e as Error).message}`);
    }
  }, [source, fileName]);

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
  // Fichier › Nouveau : le choix d'un modèle d'abord, puis le morceau en cours remplacé
  const [choosingNew, setChoosingNew] = useState(false);
  const newFile = (template: Template) => {
    setChoosingNew(false);
    if (!confirmDiscard("Effacer la partition en cours ? Les modifications non enregistrées seront perdues.")) return;
    const text = template.text;
    // un modèle se met en page tout de suite : on voit sa mesure vide
    if (text) engraveAfter.current = true;
    setSource(text);
    setEngraved({});
    setEngravedSource("");
    setHandle(null);
    setSavedText(null);
    setSaveDir(null);
    resetPiece({}, null);
    setFileName("morceau.prisma");
    persist(text);
    setEditing(true);
    // le curseur dans la première case du modèle
    const at = firstCell(text);
    setTimeout(() => (at ? editor.current?.goTo(at.line, at.column) : editor.current?.focus()));
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
  // at : la note que le choix retouche (sa case d'attaque) ; clicked : la case cliquée, qui reste encadrée (une tenue de la note, par exemple)
  type Retouch = { at: ScorePlace; clicked: ScorePlace; where: ScreenPoint; content: string; canHold: boolean; duration?: ReturnType<typeof durationOf>; holds: string[] };
  const [retouchAt, setRetouchAt] = useState<Retouch | null>(null);
  // la corde choisie dans le choix d'une case de corde, pour y placer la note
  const [retouchLane, setRetouchLane] = useState<number | undefined>(undefined);
  const retouchNow = useRef<{ at: ScorePlace; clicked: ScorePlace; lane?: number } | null>(null);
  retouchNow.current = retouchAt && { at: retouchAt.at, clicked: retouchAt.clicked, lane: retouchLane };
  useEffect(() => setRetouchLane(undefined), [retouchAt]);
  // ce que le choix montre d'une case : son contenu, la durée de sa note, les notes qu'elle peut tenir
  const describe = (text: string, at: ScorePlace, where: ScreenPoint, clicked: ScorePlace = at): Retouch | null => {
    const cell = at.octave !== undefined ? cellOf(text, at) : undefined;
    if (!cell) return null;
    const duration = cell.content ? durationOf(text, at) : undefined;
    return { at: duration?.attack ?? at, clicked, where, content: cell.content, canHold: cell.canHold, duration, holds: cell.content || !cell.exact ? [] : holdChoices(text, at) };
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
  // les cordes de la portée d'une case de corde (celles de la dernière mise en page)
  const stringsAt = (at: ScorePlace) => (at.octave !== undefined && at.octave >= STRING_LANE && engraved.score ? stringsOfStaff(engraved.score.parts, at.staff) : undefined);
  // la corde d'une case, ce que font sonner les cordes à vide (capo compris), et celles où la note peut passer
  const stringOf = (at: ScorePlace) => {
    const strs = stringsAt(at);
    return strs && { string: at.octave! - STRING_LANE, open: strs.open.map((m) => m + strs.capo), free: freeStrings(sourceNow.current, at, strs.open.length) };
  };
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
  // la conversion pour la guitare ou la basse : ses options d'abord, sur les parties du texte
  const [converting, setConverting] = useState<Part[] | null>(null);
  const startConversion = () => {
    try {
      setConverting(parsePrisma(sourceNow.current).parts);
    } catch (e) {
      setNotice(`Conversion impossible : ${(e as Error).message}`);
    }
  };
  const convert = (part: number, conversion: ConversionOptions) => {
    setConverting(null);
    try {
      const { score, report } = convertToStrings(parsePrisma(sourceNow.current), part, conversion);
      write({ text: writePrisma(score), line: 1, column: 1 });
      const changes = [
        report.octave && conversion.octave === undefined ? "une octave plus bas" : "",
        report.moved ? `${report.moved} note${report.moved > 1 ? "s" : ""} ramenée${report.moved > 1 ? "s" : ""} dans la tessiture` : "",
        report.dropped ? `${report.dropped} note${report.dropped > 1 ? "s" : ""} retirée${report.dropped > 1 ? "s" : ""}` : "",
      ].filter(Boolean);
      setNotice(`Converti${changes.length ? " : " + changes.join(", ") : ""} (Ctrl+Z pour revenir)`);
    } catch (e) {
      setNotice(`Conversion impossible : ${(e as Error).message}`);
    }
  };
  // une note, la tenue, le vide : dans la case cliquée (sur une tenue, une note nouvelle commence là ; vide, la note s'arrête avant)
  const applyRetouch = (content: string) => {
    if (retouchAt) write(retouch(sourceNow.current, retouchAt.clicked, content));
    setRetouchAt(null);
  };
  // la durée : le choix reste ouvert, pour allonger ou raccourcir encore
  const applyResize = (by: 1 | -1) => {
    if (!retouchAt) return;
    const r = resize(sourceNow.current, retouchAt.at, by);
    if (write(r)) setRetouchAt(describe(r!.text, retouchAt.at, retouchAt.where, retouchAt.clicked));
  };
  // un ajout à la note (doigté, trille, petite note) : le choix reste ouvert, pour en faire d'autres
  const applyAmend = (content: string) => {
    if (!retouchAt) return;
    const r = retouch(sourceNow.current, retouchAt.at, content);
    if (write(r)) setRetouchAt(describe(r!.text, { ...retouchAt.at, content }, retouchAt.where, retouchAt.clicked));
  };
  // l'octave de la note : le choix reste ouvert, sur la note à sa nouvelle place
  const applyOctave = (dir: 1 | -1) => {
    if (!retouchAt) return;
    const r = moveOctave(sourceNow.current, retouchAt.at, dir);
    if (write(r)) setRetouchAt(describe(r!.text, { ...retouchAt.at, octave: r!.octave }, retouchAt.where, { ...retouchAt.clicked, octave: r!.octave }));
  };
  // sur une corde : la note passe à la case choisie, sur cette corde ou une autre ; sur une tenue et sa
  // corde, une note nouvelle commence dans la case cliquée
  const applyString = (string: number, fret: number) => {
    if (retouchAt) {
      const home = string === retouchAt.at.octave! - STRING_LANE;
      write(home && retouchAt.content.startsWith("-") ? retouch(sourceNow.current, retouchAt.clicked, String(fret)) : placeOnString(sourceNow.current, retouchAt.at, string, fret));
    }
    setRetouchAt(null);
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
    // le choix d'une case ouvert : c'est la case cliquée qui est encadrée (ou, sur une autre corde choisie, la case où la note ira)
    const r = retouchNow.current;
    if (r) {
      textMark.set({ place: r.lane === undefined ? r.clicked : { ...r.at, octave: r.lane, content: undefined }, reveal: false });
      return;
    }
    const c = caretAt.current;
    const place = linkedNow.current && c ? textPlace(c[2], c[0], c[1]) : undefined;
    textMark.set(place ? { place, reveal: reveal && player.getSnapshot().state !== "playing" } : null);
  }, []);
  useEffect(() => markCaret(false), [linked, markCaret, retouchAt, retouchLane]);

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
  // volumes, propres au morceau : un par partie, 0 tel quel
  const volumes = useMemo(() => parts.map((_, i) => piece.volumes?.[i] ?? 0), [parts, piece.volumes]);
  const setVolume = (part: number, db: number) => {
    const next = volumes.map((v, i) => (i === part ? db : v));
    updatePiece({ volumes: next.some((v) => v !== 0) ? next : undefined });
  };
  const gains = useMemo(() => parts.flatMap((p, i) => Array.from({ length: p.staves }, () => volumes[i])), [parts, volumes]);
  const partsKey = JSON.stringify(score?.parts ?? []);
  // tempo choisi, propre au morceau : un nouveau tempo écrit dans la partition reprend la main ;
  // de nouvelles parties effacent les portées muettes, les instruments et les volumes choisis
  const written = score?.meta.bpm;
  const seen = useRef({ pieceId, partsKey, written });
  useEffect(() => {
    // une partition illisible (une erreur à corriger) ne change rien : on compare à la dernière lue
    if (!score && seen.current.pieceId === pieceId) return;
    const before = seen.current;
    seen.current = { pieceId, partsKey, written };
    if (before.pieceId !== pieceId) return; // un autre morceau : ses réglages viennent d'être lus
    if (before.partsKey !== partsKey && (piece.muted || piece.instruments || piece.volumes)) updatePiece({ muted: undefined, instruments: undefined, volumes: undefined });
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
        gains,
        clickSounds: options.clickSounds,
        clickGrid: options.clickGrid,
        countIn: options.countIn,
        clickVolume: options.clickVolume,
      }),
    [options.metronome, muted, gains, options.clickSounds, options.clickGrid, options.countIn, options.clickVolume],
  );


  // les menus de la barre
  const fileMenu: MenuItem[] = [
    { label: "Nouveau…", onSelect: () => setChoosingNew(true) },
    { label: "Ouvrir…", onSelect: openFile, shortcut: "Ctrl+O" },
    { label: "Bibliothèque", onSelect: () => setShowLibrary((v) => !v), checked: showLibrary, shortcut: "Ctrl+B" },
    "separator",
    { label: "Enregistrer", onSelect: () => saveFile(), shortcut: "Ctrl+S" },
    { label: "Enregistrer sous…", onSelect: () => saveFile(true), shortcut: "Ctrl+Maj+S" },
    { label: "Exporter en MusicXML…", onSelect: () => setExporting(true) },
    "separator",
    { label: "Recharger", onSelect: reloadFile, disabled: !handle },
    "separator",
    // le site qui présente Prisma, autour de l'application (app/) ; le navigateur prévient
    // avant de quitter un morceau aux modifications non enregistrées
    { label: "Retour au site", onSelect: () => location.assign("..") },
  ];
  const scoreMenu: MenuItem[] = [
    { label: "Mettre en page", onSelect: engraveNow, shortcut: "Ctrl+Entrée" },
    { label: "Mettre en page automatiquement", onSelect: () => setOptions({ autoEngrave: !options.autoEngrave }), checked: options.autoEngrave },
    { label: "Options", onSelect: () => setShowOptions((v) => !v), checked: showOptions },
    "separator",
    { label: "Convertir pour la guitare ou la basse…", onSelect: startConversion },
    "separator",
    { label: "Imprimer…", onSelect: () => window.print(), shortcut: "Ctrl+P", disabled: !pages.length || showGuide || showLibrary },
  ];
  const viewMenu: MenuItem[] = [
    { label: "Éditeur", onSelect: () => setEditing(!editing), checked: editing, shortcut: "Ctrl+E" },
    { label: "Piste de lecture", onSelect: () => setView({ progress: !view.progress }), checked: view.progress },
    { label: "Plein écran", onSelect: toggleFullScreen, checked: fullScreen, shortcut: "F11" },
    "separator",
    { label: "Zoom avant", onSelect: () => zoomBy(1), shortcut: "Ctrl++", disabled: view.zoom >= ZOOMS[ZOOMS.length - 1] || focused },
    { label: "Zoom arrière", onSelect: () => zoomBy(-1), shortcut: "Ctrl+−", disabled: view.zoom <= ZOOMS[0] || focused },
    { label: `Taille normale${view.zoom !== 1 ? ` (zoom ${Math.round(view.zoom * 100)} %)` : ""}`, onSelect: () => setView({ zoom: 1 }), shortcut: "Ctrl+0", disabled: view.zoom === 1 || focused },
    "separator",
    { label: "Ajuster à la hauteur", onSelect: () => setView({ fit: "height", zoom: 1 }), checked: view.fit === "height" && view.zoom === 1 },
    { label: "Ajuster à la largeur", onSelect: () => setView({ fit: "width", zoom: 1 }), checked: view.fit === "width" && view.zoom === 1 },
    { label: "Lecture focalisée : deux systèmes", onSelect: () => setView({ fit: "focus", zoom: 1 }), checked: view.fit === "focus" },
  ];
  const helpMenu: MenuItem[] = [{ label: "Référence", onSelect: () => setShowGuide((v) => !v), checked: showGuide }];

  return (
    <div className="app relative flex flex-col h-full" onDragEnter={onDragEnter} onDragLeave={onDragLeave} onDragOver={onDragOver} onDrop={onDrop}>
      {dragging && (
        <div className="absolute inset-0 z-20 grid place-content-center text-center gap-1 bg-[rgba(43,93,110,.12)] border-3 border-dashed border-accent pointer-events-none" aria-hidden>
          <p className="text-[22px] font-bold text-accent">Déposer pour ouvrir</p>
          <span className="text-muted">.prisma ou .musicxml</span>
        </div>
      )}
      <header className="flex gap-2 items-center px-4 py-2 bg-panel border-b border-line print:hidden! stacked:flex-wrap stacked:px-2">
        <span className="font-bold tracking-[.06em] mr-3">Prisma</span>
        {/* quatre menus ; quand la place manque, un seul, qui les range sous leurs titres */}
        <span className="flex gap-2 compact:hidden">
          <Menu label="Fichier" items={fileMenu} />
          <Menu label="Partition" items={scoreMenu} />
          <Menu label="Affichage" items={viewMenu} />
          <Menu label="Aide" items={helpMenu} />
        </span>
        <span className="hidden compact:block">
          <Menu label="Menu" items={[{ heading: "Fichier" }, ...fileMenu, { heading: "Partition" }, ...scoreMenu, { heading: "Affichage" }, ...viewMenu, { heading: "Aide" }, ...helpMenu]} />
        </span>
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
        {/* le nom du fichier ; un point, à la couleur de l'accent, tant qu'il y a des modifications non enregistrées */}
        <span className="text-muted ml-2 truncate min-w-[6em] stacked:flex-1" title={[unsaved || savedText === null ? "Modifications non enregistrées" : "", handle ? "Enregistrer réécrit ce fichier" : ""].filter(Boolean).join(" ; ") || undefined}>
          {fileName}
          {unsaved || savedText === null ? (
            <>
              <span className="text-accent" aria-hidden>
                {" "}●
              </span>
              <span className="sr-only">, non enregistré</span>
            </>
          ) : null}
        </span>
        {notice && (
          <span className="text-accent ml-3 whitespace-nowrap" role="status">
            {notice}
          </span>
        )}
        {/* l'écoute ; quand la place manque, sur sa propre ligne, sous les menus */}
        <span className="contents stacked:flex stacked:order-last stacked:w-full stacked:items-center stacked:gap-1">
        <ListenControls
          score={score}
          disabled={!score || !pages.length}
          metronome={options.metronome}
          onMetronome={(metronome) => setOptions({ metronome })}
          clickGrid={options.clickGrid}
          onClickGrid={(clickGrid) => setOptions({ clickGrid })}
          muted={muted}
          onMuted={setMuted}
          instruments={instruments}
          onInstrument={setInstrument}
          volumes={volumes}
          onVolume={setVolume}
          tempo={piece.tempo ?? null}
          onTempo={(tempo) => updatePiece({ tempo: tempo ?? undefined })}
        />
        </span>
        <button
          className={"flex items-center px-2 py-1.5 " + (showOptions ? "text-accent" : "text-muted enabled:hover:text-accent")}
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
      {/* où en est la lecture, sur toute la largeur, sous la barre */}
      {view.progress && score && pages.length > 0 && (
        <div className="flex px-4 py-px bg-panel border-b border-line print:hidden!">
          <Progress bpm={piece.tempo ?? score.meta.bpm ?? DEFAULT_BPM} />
        </div>
      )}


      <div className="flex-1 relative flex flex-col min-h-0">
      {showGuide && (
        <main className="guide-pane flex-1 overflow-auto bg-white">
          <BackButton onClick={() => setShowGuide(false)} />
          <ReferenceView options={general} />
        </main>
      )}
      {showLibrary && <LibraryView options={general} onOpen={openEntry} onClose={() => setShowLibrary(false)} />}
      {exporting && <ExportDialog onExport={exportFile} onClose={() => setExporting(false)} />}
      {choosingNew && <NewDialog onCreate={newFile} onClose={() => setChoosingNew(false)} />}
      {converting && <ConvertDialog parts={converting} noteNames={options.noteNames === "english" ? "english" : "latin"} onConvert={convert} onClose={() => setConverting(null)} />}
      <main
        ref={split}
        className={"split" + (reading ? " reading" : "") + ` fit-${view.fit}` + (view.zoom > 1 ? " zoomed" : "")}
        style={{ "--editor": `${view.editorWidth * 100}%` } as React.CSSProperties}
        hidden={showGuide || showLibrary}
      >
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
        {editing && (
          <div
            className="splitter"
            role="separator"
            aria-orientation="vertical"
            aria-label="Largeur de l'éditeur"
            aria-valuenow={Math.round(view.editorWidth * 100)}
            aria-valuemin={20}
            aria-valuemax={80}
            tabIndex={0}
            title="Tirer pour régler la largeur de l'éditeur (double-clic : largeur par défaut)"
            onPointerDown={dragSplitter}
            onKeyDown={keySplitter}
            onDoubleClick={() => setView({ editorWidth: EDITOR_WIDTH })}
          />
        )}
        <section className="source" hidden={reading}>
          <SourceEditor value={source} onChange={setSource} editor={editor} noteNames={options.noteNames} colors={options.sourceColors} palette={options.octaveColors} onCheck={setChecked} onCaret={(line, column, text) => ((caretAt.current = [line, column, text]), markCaret(true))}>
            <EngraveButton dirty={dirty} auto={options.autoEngrave} onEngrave={engraveNow} onAuto={(autoEngrave) => setOptions({ autoEngrave })} />
          </SourceEditor>
          {problem && (
            <div className="flex items-center gap-2 min-w-0 border-t border-error bg-error-bg text-error">
              <button className="flex-1 min-w-0 border-0 rounded-none bg-transparent text-inherit text-left px-4 py-2.5" onClick={() => goTo(problem.line, problem.column)} title="aller à l'erreur">
                <Message text={problem.message} />
              </button>
              {problems.length > 1 && (
                <span className="shrink-0 flex items-center gap-1 pr-2.5 tabular-nums text-[13px] whitespace-nowrap">
                  <button className="px-2 py-px text-error border-[color-mix(in_srgb,var(--error)_40%,#fff)]" onClick={() => showError(shown - 1)} title="erreur précédente (Maj+F8 dans l'éditeur)" aria-label="Erreur précédente">
                    ‹
                  </button>
                  <span>
                    {shown + 1}/{problems.length}
                  </span>
                  <button className="px-2 py-px text-error border-[color-mix(in_srgb,var(--error)_40%,#fff)]" onClick={() => showError(shown + 1)} title="erreur suivante (F8 dans l'éditeur)" aria-label="Erreur suivante">
                    ›
                  </button>
                </span>
              )}
            </div>
          )}
        </section>

        {/* au doigt, deux touchers ouvrent la retouche, sans agrandir la page */}
        <section
          className="preview touch-manipulation"
          ref={preview}
          aria-label={reading ? "Partition" : "Aperçu"}
          // la molette fait défiler de côté les pages côte à côte
          // (ajustées à la hauteur et sans zoom : sinon la molette garde son sens, de haut en bas)
          onWheel={(e) => view.fit === "height" && view.zoom <= 1 && !e.ctrlKey && Math.abs(e.deltaY) > Math.abs(e.deltaX) && e.currentTarget.scrollBy({ left: e.deltaY })}
          style={{ "--zoom": view.zoom } as React.CSSProperties}
        >
          {score && !pages.length && <p className="text-muted">Aucune mesure à mettre en page.</p>}
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
              strings={stringOf(retouchAt.at)}
              onString={applyString}
              onTarget={(string) => setRetouchLane(string === retouchAt.at.octave! - STRING_LANE ? undefined : STRING_LANE + string)}
              octaves={retouchAt.duration && !stringsAt(retouchAt.at) ? octaveRoomOf(retouchAt.at) : undefined}
              onOctave={applyOctave}
              onClose={closeRetouch}
            />
          )}
          {/* une erreur : la partition n'a pas pu être mise en page ; on dit pourquoi, et où corriger */}
          {fixed && (
            <div className={`${previewProblem} border-l-accent`} role="status">
              <p className="font-semibold">L'erreur est corrigée.</p>
              <p className="text-muted">Mettez le texte en page (Ctrl+Entrée) pour voir la partition.</p>
              <button onClick={engraveNow}>Mettre en page</button>
            </div>
          )}
          {problem && (
            <div className={`${previewProblem} border-l-[#d22c2c]`} role="alert">
              <p className="font-semibold">
                {problem.line ? `La partition ne peut pas être mise en page : le texte contient ${problems.length > 1 ? `${problems.length} erreurs` : "une erreur"}.` : "La partition ne peut pas être affichée."}
              </p>
              <p>
                <Message text={problems[0].message} />
              </p>
              {problem.line !== undefined && (
                <>
                  <p className="text-muted">
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
