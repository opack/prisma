/**
 * Bibliothèque de partitions : les morceaux d'une source (un dossier du disque, sous-dossiers
 * compris ; demain un drive en ligne). Les fichiers restent la seule référence : rien n'est copié
 * dans le navigateur, seul l'accès à la source y est mémorisé. Une source donne ses fichiers ; la
 * bibliothèque en lit le titre, le compositeur et les réglages, la même pour toutes les sources.
 */

import type { RenderOptions } from "../options/options.ts";
import { readSettings } from "../options/piece.ts";
import type { StoredFile, StoredFolder } from "../files/stored.ts";

/** Un fichier d'une source, avant d'être lu. */
export type SourceFile = {
  /** Chemin depuis la racine de la source, nom du fichier compris : « Satie/gymnopedie.prisma ». */
  path: string;
  /** Sous-dossier, vide à la racine. */
  folder: string;
  name: string;
  modified: number;
  file: StoredFile;
  /** Dossier du fichier : ses réglages y sont, un MusicXML importé s'y enregistre en .prisma, à côté de lui. */
  dir: StoredFolder;
  /** Le début du fichier, assez pour son titre et son compositeur (à défaut, tout le texte). */
  head?: () => Promise<string>;
};

/** Une source de la bibliothèque : un dossier du disque, un drive en ligne. */
export type LibrarySource = {
  /** Ce que la bibliothèque en dit : « Dossier « Partitions » ». */
  label: string;
  /** Sa racine : on y enregistre un morceau reçu. */
  root: StoredFolder;
  /** L'accès : déjà accordé, ou à redemander (ask : en réponse à un clic). */
  access(ask?: boolean): Promise<boolean>;
  /** Ses partitions (.prisma et MusicXML), sous-dossiers compris, les dossiers cachés exceptés. */
  files(): Promise<SourceFile[]>;
};

/** Un morceau de la bibliothèque. */
export type LibraryEntry = Omit<SourceFile, "head"> & {
  kind: "prisma" | "musicxml";
  title?: string;
  composer?: string;
  /** Les options définies pour la partition, dans ses réglages à côté d'elle (pour sa vignette). */
  own?: Partial<RenderOptions>;
};

const KINDS: [RegExp, LibraryEntry["kind"]][] = [
  [/\.prisma$/i, "prisma"],
  [/\.(musicxml|xml)$/i, "musicxml"],
];

/** La sorte d'un fichier de partition, ou undefined pour un autre fichier. */
export const kindOf = (name: string) => KINDS.find(([re]) => re.test(name))?.[1];

/** Les morceaux d'une source : chaque partition, son titre, son compositeur, ses options. */
export async function scan(source: LibrarySource): Promise<LibraryEntry[]> {
  const out: LibraryEntry[] = [];
  for (const { head, ...f } of await source.files()) {
    const kind = kindOf(f.name);
    if (!kind) continue;
    const start = head ? await head() : await f.file.text();
    // ses réglages, à côté d'elle : illisibles, la vignette prend les options générales
    const own = kind === "prisma" ? ((await readSettings(f.dir, f.name).catch(() => null))?.options ?? undefined) : undefined;
    out.push({ ...f, kind, ...describe(start, kind), ...(own ? { own } : {}) });
  }
  return out;
}

// l'accès à la source se garde dans IndexedDB (un accès au disque ne se range pas dans
// localStorage), avec le cache des aperçus
const DB = "prisma";
const STORE = "library";
export const THUMBS = "thumbs";

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 2);
    req.onupgradeneeded = () => {
      for (const s of [STORE, THUMBS]) if (!req.result.objectStoreNames.contains(s)) req.result.createObjectStore(s);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>, store = STORE): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = run(d.transaction(store, mode).objectStore(store));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Titre et compositeur, lus au début du fichier : l'en-tête d'un .prisma, les crédits d'un MusicXML. */
export function describe(head: string, kind: LibraryEntry["kind"]): { title?: string; composer?: string } {
  if (kind === "prisma") {
    const fm = head.match(/^\s*---\r?\n([\s\S]*?)\r?\n---/);
    const value = (key: string) => {
      const m = fm?.[1].match(new RegExp(`^\\s*${key}\\s*:\\s*(.+?)\\s*$`, "m"));
      return m ? m[1].replace(/^(["'])(.*)\1$/, "$2") || undefined : undefined;
    };
    return { title: value("title"), composer: value("composer") };
  }
  const text = (re: RegExp) => {
    const m = head.match(re);
    return m ? decode(m[1].trim()) || undefined : undefined;
  };
  return {
    title: text(/<work-title>([^<]*)<\/work-title>/) ?? text(/<movement-title>([^<]*)<\/movement-title>/),
    composer: text(/<creator[^>]*type="composer"[^>]*>([^<]*)<\/creator>/),
  };
}

const decode = (s: string) => s.replace(/&(amp|lt|gt|quot|apos|#\d+);/g, (_, e: string) => ({ amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" })[e] ?? String.fromCharCode(Number(e.slice(1))));

/** Dernière ouverture de chaque morceau, par chemin : pour les ranger du plus récent au plus ancien. */
const RECENT_KEY = "prisma:recent";
export function recentOpenings(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "{}");
  } catch {
    return {};
  }
}
export function markOpened(path: string) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify({ ...recentOpenings(), [path]: Date.now() }));
  } catch {
    /* stockage indisponible : sans conséquence */
  }
}
