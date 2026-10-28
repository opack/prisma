/**
 * Le morceau ouvert : son texte, sa dernière mise en page (ou ce qui l'empêche), son fichier sur le
 * disque, et ce qu'on en fait : le mettre en page, l'enregistrer, l'exporter en MusicXML, en ouvrir
 * un autre (un fichier, un morceau de la bibliothèque, un fichier déposé, un morceau reçu par un lien), en commencer un nouveau,
 * le recharger. Avant de remplacer un texte aux modifications non enregistrées, on demande ; avant
 * de quitter la page aussi.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { DEFAULT_WIDTH, PrismaError, exportMusicXml, importMusicXml, parsePrisma, writePrisma } from "../../core/index.ts";
import type { ExportOptions, Score } from "../../core/index.ts";
import type { EditorHandle } from "../editor/SourceEditor.tsx";
import { firstCell } from "../editor/templates.ts";
import type { Template } from "../editor/templates.ts";
import { markOpened } from "../library/library.ts";
import type { LibraryEntry } from "../library/library.ts";
import { readSettings, saveSettings, settingsName } from "../options/piece.ts";
import type { PieceSettings } from "../options/piece.ts";
import { OPENABLE, canWriteInPlace, download, pickExportTarget, pickFile, pickSaveTarget, targetIn } from "./files.ts";
import { UNNAMED } from "./share.ts";
import type { Shared } from "./share.ts";
import type { Readable, StoredFile, StoredFolder } from "./stored.ts";
import { SAMPLE } from "./sample.ts";
import { loadSource, saveSource } from "./storage.ts";

/** Délai sans frappe avant la gravure automatique. */
const AUTO_ENGRAVE_DELAY = 600;

/** Ce qui empêche la mise en page, et où, dans le texte. */
export type Problem = { message: string; line?: number; column?: number };

/** Le texte lu en partition, ou son erreur ; un texte vide (nouvelle partition) : rien à graver, ce n'est pas une erreur. */
export function tryParse(text: string): { score?: Score; problem?: Problem } {
  if (!text.trim()) return {};
  try {
    return { score: parsePrisma(text) };
  } catch (e) {
    if (e instanceof PrismaError) return { problem: { message: e.message, line: e.line, column: e.column } };
    return { problem: { message: (e as Error).message } };
  }
}

type Deps = {
  /** Mettre en page peu après la dernière frappe. */
  autoEngrave: boolean;
  editor: RefObject<EditorHandle | null>;
  notify: (message: string) => void;
  /** Un autre morceau, et ses réglages (lus à côté de lui, ou vides). */
  onLoaded: (settings: PieceSettings, dir: StoredFolder | null) => void;
  setEditing: (on: boolean) => void;
  /** Un morceau ouvert depuis la bibliothèque, déposé sur la fenêtre, ou reçu par un lien. */
  onOpenedFrom: (from: "library" | "drop" | "link") => void;
};

export function useDocument({ autoEngrave, editor, notify, onLoaded, setEditing, onOpenedFrom }: Deps) {
  const [source, setSource] = useState(loadSource);
  const [engraved, setEngraved] = useState(() => tryParse(source));
  /** Dernier texte gravé : le bouton de mise en page n'est actif que si le texte actuel en diffère. */
  const [engravedSource, setEngravedSource] = useState(source);
  const dirty = source !== engravedSource;
  const [fileName, setFileName] = useState(UNNAMED);
  /** Fichier .prisma ouvert ou enregistré, réécrit en place par « Enregistrer » (Chrome, Edge, un drive en ligne). */
  const [handle, setHandle] = useState<StoredFile | null>(null);
  /** Texte tel qu'il est sur le disque, pour savoir s'il reste des modifications à enregistrer. */
  const [savedText, setSavedText] = useState<string | null>(null);
  const unsaved = savedText !== null && source !== savedText;
  /** Dossier d'un MusicXML ouvert depuis la bibliothèque : son .prisma s'y enregistre, à côté de lui. */
  const [saveDir, setSaveDir] = useState<StoredFolder | null>(null);
  /** Le choix des options de l'export, et du modèle d'un nouveau morceau, ouverts. */
  const [exporting, setExporting] = useState(false);
  const [choosingNew, setChoosingNew] = useState(false);
  /** Le champ de fichier caché, pour ouvrir un fichier là où le navigateur n'a pas de sélecteur. */
  const fileInput = useRef<HTMLInputElement>(null);
  // le texte à jour, pour les gestes qui le réécrivent (la retouche, la conversion)
  const current = useRef(source);
  current.current = source;

  const engraveNow = useCallback(() => {
    setEngraved(tryParse(source));
    setEngravedSource(source);
    saveSource(source);
  }, [source]);

  // gravure automatique, après un court délai sans frappe
  useEffect(() => {
    if (!autoEngrave || !dirty) return;
    const t = setTimeout(engraveNow, AUTO_ENGRAVE_DELAY);
    return () => clearTimeout(t);
  }, [autoEngrave, dirty, engraveNow]);

  // un texte réécrit d'un geste (comme une frappe, pour l'annuler avec Ctrl+Z), puis remis en page
  const engraveAfter = useRef(false);
  const rewrite = (r: { text: string; line: number; column: number } | undefined) => {
    if (!r || r.text === current.current) return false;
    engraveAfter.current = true;
    editor.current?.replace(r.text, r.line, r.column);
    return true;
  };
  useEffect(() => {
    if (!engraveAfter.current) return;
    engraveAfter.current = false;
    engraveNow();
  }, [source, engraveNow]);

  // prévenir avant de quitter avec des modifications non enregistrées
  useEffect(() => {
    if (!unsaved) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [unsaved]);

  /** Enregistre ; « sous » : toujours dans un nouveau fichier, choisi par l'utilisateur. */
  const saveFile = async (as = false) => {
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
        await target.write(source);
        setSavedText(source);
        notify(`Enregistré dans ${target.name}`);
      } else {
        download(fileName, source);
        setSavedText(source);
        notify(`Téléchargé sous le nom ${fileName}`);
      }
    } catch (e) {
      notify(`Enregistrement impossible : ${(e as Error).message}`);
    }
  };

  /** Exporte le texte, tel qu'il est, en MusicXML : un fichier à part, le .prisma ne change pas. */
  const exportFile = async (options: ExportOptions) => {
    setExporting(false);
    let xml: string;
    try {
      xml = exportMusicXml(parsePrisma(source), options);
    } catch (e) {
      notify(`Export impossible : ${(e as Error).message}`);
      return;
    }
    const name = fileName.replace(/\.(prisma|txt|musicxml|xml)$/i, "") + ".musicxml";
    try {
      if (canWriteInPlace) {
        const target = await pickExportTarget(name);
        if (!target) return; // annulé
        await target.write(xml);
        notify(`Exporté dans ${target.name}`);
      } else {
        download(name, xml);
        notify(`Exporté sous le nom ${name}`);
      }
    } catch (e) {
      notify(`Export impossible : ${(e as Error).message}`);
    }
  };

  /** Lit un fichier, .prisma ou MusicXML (importé) ; un fichier rechargé garde le mode en cours. Ses réglages : donnés (un morceau reçu), ou lus à côté de lui. */
  const open = async (file: Readable, fileHandle: StoredFile | null = null, keepMode = false, dir: StoredFolder | null = null, given?: PieceSettings) => {
    const text = await file.text();
    let prisma = text;
    const isXml = /\.(musicxml|xml)$/i.test(file.name);
    const name = isXml ? file.name.replace(/\.(musicxml|xml)$/i, ".prisma") : file.name;
    // les réglages du morceau, à côté de lui ; illisibles, on le dit et on part des options générales
    let settings: PieceSettings = given ?? {};
    if (dir && !given) {
      try {
        settings = (await readSettings(dir, name)) ?? {};
      } catch (e) {
        notify(`Réglages de ${name} ignorés (${settingsName(name)} : ${(e as Error).message})`);
      }
    }
    onLoaded(settings, dir);
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
    }
    setFileName(name);
    setSource(prisma);
    const parsed = tryParse(prisma);
    setEngraved(parsed);
    setEngravedSource(prisma);
    saveSource(prisma);
    // un import est presque toujours à retoucher ; un texte qui ne se grave pas montre son erreur
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
      if (picked) await open(picked, picked);
    } catch (e) {
      notify(`Ouverture impossible : ${(e as Error).message}`);
    }
  };
  /** Ouvre un morceau de la bibliothèque. */
  const openEntry = async (entry: LibraryEntry) => {
    if (!confirmDiscard(`Ouvrir ${entry.name} ? Les modifications non enregistrées seront perdues.`)) return;
    try {
      await open(entry.file, entry.kind === "prisma" ? entry.file : null, false, entry.dir);
      markOpened(entry.path);
      onOpenedFrom("library");
    } catch (e) {
      notify(`Ouverture impossible : ${(e as Error).message}`);
    }
  };
  /** Ouvre un fichier déposé sur la fenêtre. */
  const openDropped = async (dropped: { file: File; handle: StoredFile | null }) => {
    if (!OPENABLE.test(dropped.file.name)) {
      notify(`« ${dropped.file.name} » : format non pris en charge (.prisma ou .musicxml non compressé)`);
      return;
    }
    if (!confirmDiscard(`Ouvrir ${dropped.file.name} ? Les modifications non enregistrées seront perdues.`)) return;
    try {
      await open(dropped.file, dropped.handle);
      onOpenedFrom("drop");
    } catch (e) {
      notify(`Ouverture impossible : ${(e as Error).message}`);
    }
  };

  /**
   * Ouvre un morceau reçu par un lien ; « into » : d'abord enregistré dans ce dossier (avec ses
   * réglages), pour s'y réécrire ensuite. Faux si l'on n'a rien ouvert (annulé, impossible).
   */
  const openShared = async (shared: Shared, into?: StoredFolder) => {
    if (!confirmDiscard(`Ouvrir ${shared.name} ? Les modifications non enregistrées seront perdues.`)) return false;
    try {
      const file = into ? await targetIn(into, shared.name) : null;
      if (into && !file) return false; // il y avait déjà un fichier de ce nom, qu'on garde
      if (file && into) {
        await file.write(shared.text);
        await saveSettings(into, shared.name, shared.settings);
      }
      await open({ name: shared.name, text: async () => shared.text }, file, false, into ?? null, shared.settings);
      if (!file) setSavedText(null);
      onOpenedFrom("link");
      notify(file ? `${shared.name} enregistré dans la bibliothèque` : `${shared.name} ouvert`);
      return true;
    } catch (e) {
      notify(`Ouverture impossible : ${(e as Error).message}`);
      return false;
    }
  };

  /** Fichier › Nouveau : le choix d'un modèle d'abord, puis le morceau en cours remplacé. */
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
    onLoaded({}, null);
    setFileName(UNNAMED);
    saveSource(text);
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
      await open(handle, handle, true);
      notify(`${handle.name} rechargé`);
    } catch (e) {
      notify(`Rechargement impossible : ${(e as Error).message}`);
    }
  };

  return {
    source, setSource, current, engraved, dirty, engraveNow, rewrite,
    fileName, handle, savedText, unsaved,
    saveFile, exporting, setExporting, exportFile,
    open, openFile, openEntry, openDropped, openShared, fileInput,
    choosingNew, setChoosingNew, newFile, reloadFile,
  };
}
