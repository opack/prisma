/**
 * Les réglages : les options de tous les morceaux (générales), et ceux du morceau en cours (son tempo,
 * ses portées muettes, ses instruments, ses volumes, les options de mise en page choisies pour lui
 * seul). Ceux du morceau s'enregistrent à côté de lui quand on connaît son dossier (un morceau de la
 * bibliothèque) : useSettingsAutosave ; sinon ils durent le temps qu'on le garde ouvert. Les options
 * en vigueur : celles du morceau, à défaut les générales.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import type { MutableRefObject } from "react";
import type { StoredFile, StoredFolder } from "../files/stored.ts";
import { loadOptions, saveOptions } from "./options.ts";
import type { RenderOptions } from "./options.ts";
import { isEmpty, isPieceKey, parseSettings, saveSettings, writeSettings } from "./piece.ts";
import type { PieceKey, PieceSettings } from "./piece.ts";

/** Les réglages du morceau en cours, gardés avec son texte d'une visite à l'autre. */
const PIECE_KEY = "prisma:piece";
function loadPiece(): PieceSettings {
  try {
    const text = localStorage.getItem(PIECE_KEY);
    return text ? parseSettings(text) : {};
  } catch {
    return {};
  }
}
function persistPiece(s: PieceSettings) {
  try {
    if (isEmpty(s)) localStorage.removeItem(PIECE_KEY);
    else localStorage.setItem(PIECE_KEY, writeSettings(s));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}

/** Les seules options du rendu, celles qu'une partition peut définir. */
const renderOnly = (patch: Partial<RenderOptions>) => Object.fromEntries(Object.entries(patch).filter(([k]) => isPieceKey(k))) as Partial<RenderOptions>;

export function useSettings() {
  const [general, setGeneral] = useState<RenderOptions>(loadOptions);
  const [piece, setPiece] = useState<PieceSettings>(loadPiece);
  const options = useMemo<RenderOptions>(() => ({ ...general, ...piece.options }), [general, piece.options]);
  /** Dossier du morceau, où s'enregistrent ses réglages (un morceau ouvert depuis la bibliothèque). */
  const [pieceDir, setPieceDir] = useState<StoredFolder | null>(null);
  /** Change à chaque morceau ouvert : ce qui suit un changement de morceau n'est pas un choix de l'utilisateur. */
  const [pieceId, setPieceId] = useState(0);
  // un réglage changé à la main, à enregistrer (pas ceux qu'on vient de lire)
  const changed = useRef(false);

  const updatePiece = (patch: Partial<PieceSettings>) =>
    setPiece((cur) => {
      const next = { ...cur, ...patch };
      for (const k of Object.keys(next) as (keyof PieceSettings)[]) if (next[k] === undefined) delete next[k];
      changed.current = true;
      persistPiece(next);
      return next;
    });
  /** Un autre morceau : ses réglages, lus à côté de lui ou vides. */
  const resetPiece = (s: PieceSettings, dir: StoredFolder | null) => {
    changed.current = false;
    setPiece(s);
    persistPiece(s);
    setPieceDir(dir);
    setPieceId((n) => n + 1);
  };
  /** Le morceau enregistré dans un dossier : ses réglages l'y suivent, au prochain enregistrement automatique. */
  const placePiece = (dir: StoredFolder) => {
    changed.current = true;
    setPieceDir(dir);
  };
  /** Les options générales (l'édition, l'écoute, le menu : toujours celles-là). */
  const setOptions = (patch: Partial<RenderOptions>) => {
    const next = { ...general, ...patch };
    setGeneral(next);
    saveOptions(next);
  };
  /** Les options du rendu définies pour la partition ouverte, ou retirées (elle suit alors les générales). */
  const setPieceOptions = (patch: Partial<RenderOptions>) => updatePiece({ options: { ...piece.options, ...renderOnly(patch) } });
  const unsetPieceOptions = (keys: PieceKey[]) => {
    const own: Record<string, unknown> = { ...piece.options };
    for (const k of keys) delete own[k];
    updatePiece({ options: Object.keys(own).length ? (own as PieceSettings["options"]) : undefined });
  };
  return { general, options, setOptions, piece, updatePiece, resetPiece, placePiece, setPieceOptions, unsetPieceOptions, pieceDir, pieceId, changed };
}

/**
 * Les réglages du morceau enregistrés à côté de lui, peu après le dernier changement ; il faut son
 * dossier et le morceau lui-même sur le disque (un MusicXML importé : à son premier enregistrement en .prisma).
 */
export function useSettingsAutosave(piece: PieceSettings, dir: StoredFolder | null, handle: StoredFile | null, changed: MutableRefObject<boolean>, onError: (message: string) => void) {
  useEffect(() => {
    if (!changed.current || !dir || !handle) return;
    const name = handle.name;
    const timer = setTimeout(() => {
      changed.current = false;
      saveSettings(dir, name, piece).catch((e) => onError(`Réglages du morceau non enregistrés : ${(e as Error).message}`));
    }, 400);
    return () => clearTimeout(timer);
  }, [piece, dir, handle]);
}
