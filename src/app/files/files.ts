/**
 * Ouverture et enregistrement de fichiers.
 *
 * Chrome et Edge permettent de réécrire directement le fichier ouvert (API File System
 * Access). Ailleurs, on se rabat sur le sélecteur de fichier classique pour ouvrir et
 * sur un téléchargement pour enregistrer.
 */
import { diskFile } from "./stored.ts";
import type { StoredFile, StoredFolder } from "./stored.ts";

type PickerType = { description: string; accept: Record<string, string[]> };
type Picker = {
  showOpenFilePicker?: (o: { types: PickerType[]; multiple?: boolean }) => Promise<FileSystemFileHandle[]>;
  showSaveFilePicker?: (o: { suggestedName: string; types: PickerType[] }) => Promise<FileSystemFileHandle>;
};
const w = (typeof window !== "undefined" ? window : {}) as Picker;

export const canWriteInPlace = typeof w.showOpenFilePicker === "function" && typeof w.showSaveFilePicker === "function";

const PRISMA: PickerType = { description: "Partition Prisma", accept: { "text/plain": [".prisma"] } };
const XML: PickerType = { description: "MusicXML", accept: { "application/xml": [".musicxml", ".xml"] } };

const isAbort = (e: unknown) => (e as Error)?.name === "AbortError";

/** Ouvre un fichier .prisma ou .musicxml. Renvoie null si l'utilisateur annule. */
export async function pickFile(): Promise<StoredFile | null> {
  try {
    const [handle] = await w.showOpenFilePicker!({ types: [PRISMA, XML], multiple: false });
    return diskFile(handle);
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

/** Demande où enregistrer un nouveau fichier .prisma. Renvoie null si l'utilisateur annule. */
export async function pickSaveTarget(suggestedName: string): Promise<StoredFile | null> {
  try {
    return diskFile(await w.showSaveFilePicker!({ suggestedName, types: [PRISMA] }));
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

/** Demande où enregistrer un MusicXML exporté. Renvoie null si l'utilisateur annule. */
export async function pickExportTarget(suggestedName: string): Promise<StoredFile | null> {
  try {
    return diskFile(await w.showSaveFilePicker!({ suggestedName, types: [XML] }));
  } catch (e) {
    if (isAbort(e)) return null;
    throw e;
  }
}

/** Formats ouverts par l'application. */
export const OPENABLE = /\.(prisma|txt|musicxml|xml)$/i;

/**
 * Fichier déposé sur la fenêtre, avec son accès en écriture quand le navigateur le donne
 * (Chrome, Edge) : on peut alors l'enregistrer en place, comme un fichier ouvert.
 */
export async function droppedFile(data: DataTransfer): Promise<{ file: File; handle: StoredFile | null } | null> {
  const item = [...data.items].find((i) => i.kind === "file");
  if (!item) return null;
  const withHandle = item as DataTransferItem & { getAsFileSystemHandle?: () => Promise<FileSystemHandle | null> };
  // à demander avant tout « await » : la liste des éléments déposés n'est valable qu'un instant
  const pending = withHandle.getAsFileSystemHandle?.();
  const file = item.getAsFile();
  if (!file) return null;
  const handle = await pending?.catch(() => null);
  return { file, handle: handle?.kind === "file" ? diskFile(handle as FileSystemFileHandle) : null };
}

/**
 * Le fichier « name » d'un dossier, à créer pour l'enregistrer : un MusicXML de la bibliothèque
 * s'enregistre en .prisma à côté de lui. Un fichier de ce nom existe déjà : on demande avant de
 * le remplacer (null si l'utilisateur refuse).
 */
export async function targetIn(dir: StoredFolder, name: string): Promise<StoredFile | null> {
  const existing = await dir.file(name);
  if (!existing) return dir.create(name);
  return window.confirm(`${name} existe déjà dans ce dossier. Le remplacer ?`) ? existing : null;
}

export function download(name: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}
