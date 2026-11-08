/**
 * Les réglages : les options de tous les morceaux (générales), et ceux du morceau en cours (son tempo,
 * ses portées muettes, ses instruments, ses volumes, les options de mise en page choisies pour lui
 * seul). Ceux du morceau s'enregistrent à côté de lui quand on connaît son dossier (un morceau de la
 * bibliothèque) : useSettingsAutosave ; sinon ils durent le temps qu'on le garde ouvert. Les options
 * en vigueur : celles du morceau, à défaut les générales. Un store Pinia : l'écoute, la partition et
 * le panneau des options les partagent.
 */
import { defineStore } from "pinia";
import { computed, ref, shallowRef } from "vue";
import type { StoredFolder } from "../files/stored.ts";
import { loadOptions, saveOptions } from "./options.ts";
import type { RenderOptions } from "./options.ts";
import { isEmpty, isPieceKey, parseSettings, writeSettings } from "./piece.ts";
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

function persistPiece(pieceSettings: PieceSettings) {
  try {
    if (isEmpty(pieceSettings)) localStorage.removeItem(PIECE_KEY);
    else localStorage.setItem(PIECE_KEY, writeSettings(pieceSettings));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}

/** Les seules options du rendu, celles qu'une partition peut définir. */
const renderOnly = (patch: Partial<RenderOptions>) =>
  Object.fromEntries(Object.entries(patch).filter(([key]) => isPieceKey(key))) as Partial<RenderOptions>;

export const useSettings = defineStore("settings", () => {
  const general = ref<RenderOptions>(loadOptions());
  const piece = ref<PieceSettings>(loadPiece());
  const options = computed<RenderOptions>(() => ({ ...general.value, ...piece.value.options }));
  /** Dossier du morceau, où s'enregistrent ses réglages (un morceau ouvert depuis la bibliothèque). */
  const pieceDir = shallowRef<StoredFolder | null>(null);
  /** Change à chaque morceau ouvert : ce qui suit un changement de morceau n'est pas un choix de l'utilisateur. */
  const pieceId = ref(0);
  /** Un réglage changé à la main, à enregistrer (pas ceux qu'on vient de lire). */
  const changed = ref(false);

  function updatePiece(patch: Partial<PieceSettings>) {
    const next = { ...piece.value, ...patch };
    for (const key of Object.keys(next) as (keyof PieceSettings)[]) if (next[key] === undefined) delete next[key];
    changed.value = true;
    persistPiece(next);
    piece.value = next;
  }
  /** Un autre morceau : ses réglages, lus à côté de lui ou vides. */
  function resetPiece(pieceSettings: PieceSettings, dir: StoredFolder | null) {
    changed.value = false;
    piece.value = pieceSettings;
    persistPiece(pieceSettings);
    pieceDir.value = dir;
    pieceId.value++;
  }
  /** Le morceau enregistré dans un dossier : ses réglages l'y suivent, au prochain enregistrement automatique. */
  function placePiece(dir: StoredFolder) {
    changed.value = true;
    pieceDir.value = dir;
  }
  /** Les options générales (l'édition, l'écoute, le menu : toujours celles-là). */
  function setOptions(patch: Partial<RenderOptions>) {
    general.value = { ...general.value, ...patch };
    saveOptions(general.value);
  }
  /** Les options du rendu définies pour la partition ouverte, ou retirées (elle suit alors les générales). */
  function setPieceOptions(patch: Partial<RenderOptions>) {
    updatePiece({ options: { ...piece.value.options, ...renderOnly(patch) } });
  }
  function unsetPieceOptions(keys: PieceKey[]) {
    const own: Record<string, unknown> = { ...piece.value.options };
    for (const key of keys) delete own[key];
    updatePiece({ options: Object.keys(own).length ? (own as PieceSettings["options"]) : undefined });
  }

  return {
    general,
    piece,
    options,
    pieceDir,
    pieceId,
    changed,
    updatePiece,
    resetPiece,
    placePiece,
    setOptions,
    setPieceOptions,
    unsetPieceOptions,
  };
});
