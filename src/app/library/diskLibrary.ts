/**
 * La bibliothèque sur un dossier du disque, choisi une fois (Chrome, Edge) : le navigateur en
 * garde l'accès, à reconfirmer d'un clic quand il le demande.
 */
import { diskFile, diskFolder } from "../files/stored.ts";
import { kindOf, tx } from "./library.ts";
import type { LibrarySource, SourceFile } from "./library.ts";

type DirPicker = { showDirectoryPicker?: (o?: { id?: string; mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle> };
type Permissions = { queryPermission(o: { mode: "readwrite" }): Promise<PermissionState>; requestPermission(o: { mode: "readwrite" }): Promise<PermissionState> };
type Iterable = { values(): AsyncIterable<FileSystemHandle> };

const w = (typeof window !== "undefined" ? window : {}) as DirPicker;

/** Le navigateur sait-il ouvrir un dossier et en garder l'accès ? */
export const canUseDisk = typeof w.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";

const KEY = "folder";

/** Un dossier du disque, en source de la bibliothèque. */
export function diskLibrary(root: FileSystemDirectoryHandle): LibrarySource {
  return {
    label: `Dossier « ${root.name} »`,
    root: diskFolder(root),
    access: async (ask = false) => {
      const p = root as unknown as Permissions;
      if ((await p.queryPermission({ mode: "readwrite" })) === "granted") return true;
      return ask && (await p.requestPermission({ mode: "readwrite" })) === "granted";
    },
    files: async () => {
      const out: SourceFile[] = [];
      const walk = async (d: FileSystemDirectoryHandle, folder: string) => {
        const dir = diskFolder(d);
        for await (const h of (d as unknown as Iterable).values()) {
          if (h.name.startsWith(".")) continue;
          if (h.kind === "directory") {
            await walk(h as FileSystemDirectoryHandle, folder ? `${folder}/${h.name}` : h.name);
            continue;
          }
          if (!kindOf(h.name)) continue;
          const handle = h as FileSystemFileHandle;
          const file = await handle.getFile();
          out.push({ path: folder ? `${folder}/${h.name}` : h.name, folder, name: h.name, modified: file.lastModified, file: diskFile(handle), dir, head: () => file.slice(0, 32_000).text() });
        }
      };
      await walk(root, "");
      return out;
    },
  };
}

/** Le dossier de la bibliothèque, s'il a été choisi. */
export async function savedFolder(): Promise<LibrarySource | null> {
  try {
    const dir = (await tx("readonly", (s) => s.get(KEY))) as FileSystemDirectoryHandle | undefined;
    return dir ? diskLibrary(dir) : null;
  } catch {
    return null;
  }
}

/** Choisit le dossier de la bibliothèque et le retient. Renvoie null si l'utilisateur annule. */
export async function pickFolder(): Promise<LibrarySource | null> {
  try {
    const dir = await w.showDirectoryPicker!({ id: "prisma-library", mode: "readwrite" });
    await tx("readwrite", (s) => s.put(dir, KEY));
    return diskLibrary(dir);
  } catch (e) {
    if ((e as Error)?.name === "AbortError") return null;
    throw e;
  }
}
