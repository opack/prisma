/**
 * La bibliothèque choisie : un dossier de l'ordinateur ou le dossier de l'app sur pCloud, retenue
 * d'une visite à l'autre. Sans choix retenu, un dossier déjà ouvert (avant pCloud) reste le choix.
 */
import { canUseDisk, savedFolder } from "./diskLibrary.ts";
import type { LibrarySource } from "./library.ts";
import { canUsePcloud } from "./pcloud.ts";
import { pcloudLibrary } from "./pcloudLibrary.ts";

export type SourceKind = LibrarySource["kind"];
const KEY = "prisma:library-source";

function chosen(): SourceKind | null {
  try {
    const k = localStorage.getItem(KEY);
    return k === "disk" || k === "pcloud" ? k : null;
  } catch {
    return null;
  }
}

/** Retient la bibliothèque choisie ; null : plus aucune (le choix est à refaire). */
export function choose(kind: SourceKind | null) {
  try {
    if (kind) localStorage.setItem(KEY, kind);
    else localStorage.removeItem(KEY);
  } catch {
    /* stockage indisponible : le choix durera le temps de la page */
  }
}

/** Les bibliothèques que ce navigateur sait ouvrir. */
export const available = { disk: canUseDisk, pcloud: canUsePcloud };

/** La bibliothèque choisie, si elle peut s'ouvrir ici (son accès, lui, peut être à redonner). */
export async function savedSource(): Promise<LibrarySource | null> {
  const kind = chosen();
  if (kind === "pcloud") return canUsePcloud ? pcloudLibrary() : null;
  if (kind === "disk" || kind === null) return canUseDisk ? savedFolder() : null;
  return null;
}

/**
 * Fichier › Enregistrer dans la bibliothèque : à la racine de la bibliothèque choisie, son accès
 * redonné s'il le faut (pour pCloud : une connexion, la page quittée, le geste à refaire au retour).
 */
export async function saveToLibrary(save: (dir: LibrarySource["root"]) => Promise<void>, notify: (message: string) => void) {
  const source = await savedSource();
  if (!source) return notify("Choisissez d'abord une bibliothèque : Fichier › Bibliothèque");
  if (!(await source.access(true))) return notify("Accès à la bibliothèque refusé");
  await save(source.root);
}
