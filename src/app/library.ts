/**
 * Bibliothèque de partitions : un dossier du disque, choisi une fois, dont l'application montre
 * les morceaux (sous-dossiers compris). Les fichiers restent la seule référence : rien n'est
 * copié dans le navigateur, seul l'accès au dossier y est mémorisé (Chrome, Edge).
 */

type DirPicker = { showDirectoryPicker?: (o?: { id?: string; mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle> };
type Permissions = { queryPermission(o: { mode: "readwrite" }): Promise<PermissionState>; requestPermission(o: { mode: "readwrite" }): Promise<PermissionState> };
type Iterable = { values(): AsyncIterable<FileSystemHandle> };

const w = (typeof window !== "undefined" ? window : {}) as DirPicker;

/** Le navigateur sait-il ouvrir un dossier et en garder l'accès ? */
export const canUseLibrary = typeof w.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";

/** Un morceau de la bibliothèque. */
export type LibraryEntry = {
  /** Chemin depuis le dossier de la bibliothèque, nom du fichier compris : « Satie/gymnopedie.ymn ». */
  path: string;
  /** Sous-dossier, vide à la racine. */
  folder: string;
  name: string;
  kind: "ymn" | "musicxml";
  title?: string;
  composer?: string;
  modified: number;
  handle: FileSystemFileHandle;
  /** Dossier du fichier : un MusicXML importé s'y enregistre en .ymn, à côté de lui. */
  dir: FileSystemDirectoryHandle;
};

// l'accès au dossier se garde dans IndexedDB : un accès ne se range pas dans localStorage
const DB = "ymn", STORE = "library", KEY = "folder";

function db(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function tx<T>(mode: IDBTransactionMode, run: (s: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const d = await db();
  return new Promise((resolve, reject) => {
    const req = run(d.transaction(STORE, mode).objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/** Le dossier de la bibliothèque, s'il a été choisi. */
export async function savedFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return ((await tx("readonly", (s) => s.get(KEY))) as FileSystemDirectoryHandle | undefined) ?? null;
  } catch {
    return null;
  }
}

/** Choisit le dossier de la bibliothèque et le retient. Renvoie null si l'utilisateur annule. */
export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const dir = await w.showDirectoryPicker!({ id: "ymn-library", mode: "readwrite" });
    await tx("readwrite", (s) => s.put(dir, KEY));
    return dir;
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return null;
    throw e;
  }
}

/**
 * L'accès au dossier : déjà accordé, ou à redemander. Le navigateur ne le redonne qu'après un
 * geste de l'utilisateur (ask : en réponse à un clic).
 */
export async function access(dir: FileSystemDirectoryHandle, ask = false): Promise<boolean> {
  const p = dir as unknown as Permissions;
  if ((await p.queryPermission({ mode: "readwrite" })) === "granted") return true;
  return ask && (await p.requestPermission({ mode: "readwrite" })) === "granted";
}

const KINDS: [RegExp, LibraryEntry["kind"]][] = [
  [/\.ymn$/i, "ymn"],
  [/\.(musicxml|xml)$/i, "musicxml"],
];

/** Tous les morceaux du dossier et de ses sous-dossiers (les dossiers cachés exceptés). */
export async function scan(dir: FileSystemDirectoryHandle): Promise<LibraryEntry[]> {
  const out: LibraryEntry[] = [];
  const walk = async (d: FileSystemDirectoryHandle, folder: string) => {
    for await (const h of (d as unknown as Iterable).values()) {
      if (h.name.startsWith(".")) continue;
      if (h.kind === "directory") {
        await walk(h as FileSystemDirectoryHandle, folder ? `${folder}/${h.name}` : h.name);
        continue;
      }
      const kind = KINDS.find(([re]) => re.test(h.name))?.[1];
      if (!kind) continue;
      const handle = h as FileSystemFileHandle;
      const file = await handle.getFile();
      const head = await file.slice(0, 32_000).text();
      out.push({ path: folder ? `${folder}/${h.name}` : h.name, folder, name: h.name, kind, modified: file.lastModified, handle, dir: d, ...describe(head, kind) });
    }
  };
  await walk(dir, "");
  return out;
}

/** Titre et compositeur, lus au début du fichier : l'en-tête d'un .ymn, les crédits d'un MusicXML. */
export function describe(head: string, kind: LibraryEntry["kind"]): { title?: string; composer?: string } {
  if (kind === "ymn") {
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
const RECENT_KEY = "ymn:recent";
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
