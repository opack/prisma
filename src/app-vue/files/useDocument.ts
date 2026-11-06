/**
 * Le morceau ouvert : son texte, sa dernière mise en page (ou ce qui l'empêche), son fichier sur le
 * disque, et ce qu'on en fait : le mettre en page, l'enregistrer, l'exporter en MusicXML, en ouvrir
 * un autre (un fichier, un morceau de la bibliothèque, un fichier déposé, un morceau reçu par un
 * lien), en commencer un nouveau, le recharger. Avant de remplacer un texte aux modifications non
 * enregistrées, on demande ; avant de quitter la page aussi.
 */
import { useEventListener, watchDebounced } from "@vueuse/core";
import { computed, ref, shallowRef, watch } from "vue";
import type { Ref } from "vue";
import { DEFAULT_WIDTH, exportMusicXml, importMusicXml, parsePrisma, writePrisma } from "../../core/index.ts";
import type { ExportOptions } from "../../core/index.ts";
import { firstCell } from "../../app/editor/templates.ts";
import type { Template } from "../../app/editor/templates.ts";
import { OPENABLE, canWriteInPlace, download, pickExportTarget, pickFile, pickSaveTarget, targetIn } from "../../app/files/files.ts";
import { tryParse } from "../../app/files/parse.ts";
import { SAMPLE } from "../../app/files/sample.ts";
import { UNNAMED } from "../../app/files/share.ts";
import type { Shared } from "../../app/files/share.ts";
import { loadSource, saveSource } from "../../app/files/storage.ts";
import type { Readable, StoredFile, StoredFolder } from "../../app/files/stored.ts";
import { markOpened } from "../../app/library/library.ts";
import type { LibraryEntry } from "../../app/library/library.ts";
import { readSettings, saveSettings, settingsName } from "../../app/options/piece.ts";
import type { PieceSettings } from "../../app/options/piece.ts";
import type { EditorHandle } from "../editor/codemirror.ts";

/** Délai sans frappe avant la gravure automatique. */
const AUTO_ENGRAVE_DELAY = 600;

type Deps = {
  /** Mettre en page peu après la dernière frappe. */
  autoEngrave: Ref<boolean>;
  editor: Ref<EditorHandle | null | undefined>;
  notify: (message: string) => void;
  /** Un autre morceau, et ses réglages (lus à côté de lui, ou vides). */
  onLoaded: (settings: PieceSettings, dir: StoredFolder | null) => void;
  setEditing: (on: boolean) => void;
  /** Le morceau enregistré dans ce dossier : ses réglages l'y suivent. */
  onSavedIn: (dir: StoredFolder) => void;
  /** Un morceau ouvert depuis la bibliothèque, déposé sur la fenêtre, ou reçu par un lien. */
  onOpenedFrom: (from: "library" | "drop" | "link") => void;
};

export function useDocument({ autoEngrave, editor, notify, onLoaded, onSavedIn, setEditing, onOpenedFrom }: Deps) {
  const source = ref(loadSource());
  const engraved = shallowRef(tryParse(source.value));
  /** Dernier texte gravé : le bouton de mise en page n'est actif que si le texte actuel en diffère. */
  const engravedSource = ref(source.value);
  const dirty = computed(() => source.value !== engravedSource.value);
  const fileName = ref(UNNAMED);
  /** Fichier .prisma ouvert ou enregistré, réécrit en place par « Enregistrer » (Chrome, Edge, un drive en ligne). */
  const handle = shallowRef<StoredFile | null>(null);
  /** Texte tel qu'il est sur le disque, pour savoir s'il reste des modifications à enregistrer. */
  const savedText = ref<string | null>(null);
  const unsaved = computed(() => savedText.value !== null && source.value !== savedText.value);
  /** Dossier d'un MusicXML ouvert depuis la bibliothèque : son .prisma s'y enregistre, à côté de lui. */
  const saveDir = shallowRef<StoredFolder | null>(null);
  /** Le choix des options de l'export, et du modèle d'un nouveau morceau, ouverts. */
  const exporting = ref(false);
  const choosingNew = ref(false);
  /** Le champ de fichier caché, pour ouvrir un fichier là où le navigateur n'a pas de sélecteur. */
  const fileInput = ref<HTMLInputElement>();

  function engraveNow() {
    engraved.value = tryParse(source.value);
    engravedSource.value = source.value;
    saveSource(source.value);
  }

  // gravure automatique, après un court délai sans frappe
  watchDebounced(source, () => autoEngrave.value && dirty.value && engraveNow(), { debounce: AUTO_ENGRAVE_DELAY });
  watch(autoEngrave, (on) => on && dirty.value && engraveNow());

  // un texte réécrit d'un geste (comme une frappe, pour l'annuler avec Ctrl+Z), puis remis en page
  let engraveAfter = false;
  const rewrite = (rewritten: { text: string; line: number; column: number } | undefined) => {
    if (!rewritten || rewritten.text === source.value) return false;
    engraveAfter = true;
    editor.value?.replace(rewritten.text, rewritten.line, rewritten.column);
    return true;
  };
  watch(source, () => {
    if (!engraveAfter) return;
    engraveAfter = false;
    engraveNow();
  });

  // prévenir avant de quitter avec des modifications non enregistrées
  useEventListener(window, "beforeunload", (beforeUnloadEvent: BeforeUnloadEvent) => unsaved.value && beforeUnloadEvent.preventDefault());

  /** Enregistre ; « sous » : toujours dans un nouveau fichier, choisi par l'utilisateur. */
  async function saveFile(as = false) {
    try {
      let target = as ? null : handle.value;
      if (!target && !as && saveDir.value) {
        target = await targetIn(saveDir.value, fileName.value);
        if (!target) return; // annulé
        handle.value = target;
      }
      if (!target && canWriteInPlace) {
        target = await pickSaveTarget(fileName.value);
        if (!target) return; // annulé
        handle.value = target;
        fileName.value = target.name;
      }
      if (target) {
        await target.write(source.value);
        savedText.value = source.value;
        notify(`${target.name} enregistré ${target.where}`);
      } else {
        download(fileName.value, source.value);
        savedText.value = source.value;
        notify(`${fileName.value} téléchargé (dans le dossier des téléchargements)`);
      }
    } catch (error) {
      notify(`Enregistrement impossible : ${(error as Error).message}`);
    }
  }

  /**
   * Fichier › Enregistrer dans la bibliothèque : le morceau écrit à la racine de la bibliothèque
   * (un dossier de l'ordinateur, pCloud), sous son nom ; il s'y réécrit ensuite, ses réglages à côté.
   */
  async function saveInto(dir: StoredFolder) {
    try {
      const target = await targetIn(dir, fileName.value);
      if (!target) return; // un fichier de ce nom, qu'on garde
      await target.write(source.value);
      handle.value = target;
      saveDir.value = null;
      savedText.value = source.value;
      onSavedIn(dir);
      notify(`${target.name} enregistré dans la bibliothèque, ${target.where}`);
    } catch (error) {
      notify(`Enregistrement impossible : ${(error as Error).message}`);
    }
  }

  /** Exporte le texte, tel qu'il est, en MusicXML : un fichier à part, le .prisma ne change pas. */
  async function exportFile(options: ExportOptions) {
    exporting.value = false;
    let xml: string;
    try {
      xml = exportMusicXml(parsePrisma(source.value), options);
    } catch (error) {
      notify(`Export impossible : ${(error as Error).message}`);
      return;
    }
    const name = fileName.value.replace(/\.(prisma|txt|musicxml|xml)$/i, "") + ".musicxml";
    try {
      if (canWriteInPlace) {
        const target = await pickExportTarget(name);
        if (!target) return; // annulé
        await target.write(xml);
        notify(`${target.name} exporté ${target.where}`);
      } else {
        download(name, xml);
        notify(`Exporté sous le nom ${name}`);
      }
    } catch (error) {
      notify(`Export impossible : ${(error as Error).message}`);
    }
  }

  /** Lit un fichier, .prisma ou MusicXML (importé) ; un fichier rechargé garde le mode en cours. Ses réglages : donnés (un morceau reçu), ou lus à côté de lui. */
  async function open(
    file: Readable,
    fileHandle: StoredFile | null = null,
    keepMode = false,
    dir: StoredFolder | null = null,
    given?: PieceSettings,
  ) {
    const text = await file.text();
    let prisma = text;
    const isXml = /\.(musicxml|xml)$/i.test(file.name);
    const name = isXml ? file.name.replace(/\.(musicxml|xml)$/i, ".prisma") : file.name;
    // les réglages du morceau, à côté de lui ; illisibles, on le dit et on part des options générales
    let settings: PieceSettings = given ?? {};
    if (dir && !given) {
      try {
        settings = (await readSettings(dir, name)) ?? {};
      } catch (error) {
        notify(`Réglages de ${name} ignorés (${settingsName(name)} : ${(error as Error).message})`);
      }
    }
    onLoaded(settings, dir);
    saveDir.value = isXml ? dir : null;
    // un MusicXML n'est jamais réécrit : le premier enregistrement crée un nouveau .prisma
    handle.value = isXml ? null : fileHandle;
    savedText.value = isXml ? null : text;
    if (isXml) {
      try {
        prisma = writePrisma(importMusicXml(text, file.name), { width: DEFAULT_WIDTH });
      } catch (error) {
        engraved.value = { problem: { message: `Import MusicXML impossible : ${(error as Error).message}` } };
        setEditing(true);
        return;
      }
    }
    fileName.value = name;
    source.value = prisma;
    const parsed = tryParse(prisma);
    engraved.value = parsed;
    engravedSource.value = prisma;
    saveSource(prisma);
    // un import est presque toujours à retoucher ; un texte qui ne se grave pas montre son erreur
    if (isXml || parsed.problem) setEditing(true);
    else if (!keepMode) setEditing(false);
  }

  /** Modifications perdues si l'on remplace le texte : on demande d'abord. */
  function confirmDiscard(question: string) {
    // rien à perdre : le fichier tel qu'enregistré, ou, sans fichier, un texte vide ou l'exemple de départ
    const pristine = savedText.value === null ? !source.value.trim() || source.value === SAMPLE : source.value === savedText.value;
    return pristine || window.confirm(question);
  }

  async function openFile() {
    if (!confirmDiscard("Ouvrir un autre fichier ? Les modifications non enregistrées seront perdues.")) return;
    if (!canWriteInPlace) return fileInput.value?.click();
    try {
      const picked = await pickFile();
      if (picked) await open(picked, picked);
    } catch (error) {
      notify(`Ouverture impossible : ${(error as Error).message}`);
    }
  }

  /** Ouvre un morceau de la bibliothèque. */
  async function openEntry(entry: LibraryEntry) {
    if (!confirmDiscard(`Ouvrir ${entry.name} ? Les modifications non enregistrées seront perdues.`)) return;
    try {
      await open(entry.file, entry.kind === "prisma" ? entry.file : null, false, entry.dir);
      markOpened(entry.path);
      onOpenedFrom("library");
    } catch (error) {
      notify(`Ouverture impossible : ${(error as Error).message}`);
    }
  }

  /** Ouvre un fichier déposé sur la fenêtre. */
  async function openDropped(dropped: { file: File; handle: StoredFile | null }) {
    if (!OPENABLE.test(dropped.file.name)) {
      notify(`« ${dropped.file.name} » : format non pris en charge (.prisma ou .musicxml non compressé)`);
      return;
    }
    if (!confirmDiscard(`Ouvrir ${dropped.file.name} ? Les modifications non enregistrées seront perdues.`)) return;
    try {
      await open(dropped.file, dropped.handle);
      onOpenedFrom("drop");
    } catch (error) {
      notify(`Ouverture impossible : ${(error as Error).message}`);
    }
  }

  /**
   * Ouvre un morceau reçu par un lien ; « into » : d'abord enregistré dans ce dossier (avec ses
   * réglages), pour s'y réécrire ensuite. Faux si l'on n'a rien ouvert (annulé, impossible).
   */
  async function openShared(shared: Shared, into?: StoredFolder) {
    if (!confirmDiscard(`Ouvrir ${shared.name} ? Les modifications non enregistrées seront perdues.`)) return false;
    try {
      const file = into ? await targetIn(into, shared.name) : null;
      if (into && !file) return false; // il y avait déjà un fichier de ce nom, qu'on garde
      if (file && into) {
        await file.write(shared.text);
        await saveSettings(into, shared.name, shared.settings);
      }
      await open({ name: shared.name, text: async () => shared.text }, file, false, into ?? null, shared.settings);
      if (!file) savedText.value = null;
      onOpenedFrom("link");
      notify(file ? `${shared.name} enregistré dans la bibliothèque, ${file.where}` : `${shared.name} ouvert`);
      return true;
    } catch (error) {
      notify(`Ouverture impossible : ${(error as Error).message}`);
      return false;
    }
  }

  /** Fichier › Nouveau : le choix d'un modèle d'abord, puis le morceau en cours remplacé. */
  function newFile(template: Template) {
    choosingNew.value = false;
    if (!confirmDiscard("Effacer la partition en cours ? Les modifications non enregistrées seront perdues.")) return;
    const text = template.text;
    // un modèle se met en page tout de suite : on voit sa mesure vide
    if (text) engraveAfter = true;
    source.value = text;
    engraved.value = {};
    engravedSource.value = "";
    handle.value = null;
    savedText.value = null;
    saveDir.value = null;
    onLoaded({}, null);
    fileName.value = UNNAMED;
    saveSource(text);
    setEditing(true);
    // le curseur dans la première case du modèle
    const at = firstCell(text);
    setTimeout(() => (at ? editor.value?.goTo(at.line, at.column) : editor.value?.focus()));
  }

  /** Relit depuis le disque le fichier ouvert (modifié ailleurs, ou pour annuler ses changements). */
  async function reloadFile() {
    const opened = handle.value;
    if (!opened) return;
    if (unsaved.value && !window.confirm(`Recharger ${opened.name} depuis le disque ? Les modifications non enregistrées seront perdues.`))
      return;
    try {
      await open(opened, opened, true);
      notify(`${opened.name} rechargé`);
    } catch (error) {
      notify(`Rechargement impossible : ${(error as Error).message}`);
    }
  }

  return {
    source,
    engraved,
    dirty,
    engraveNow,
    rewrite,
    fileName,
    handle,
    savedText,
    unsaved,
    saveFile,
    saveInto,
    exporting,
    exportFile,
    open,
    openFile,
    openEntry,
    openDropped,
    openShared,
    fileInput,
    choosingNew,
    newFile,
    reloadFile,
  };
}
