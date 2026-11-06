/**
 * La bibliothèque sur un dossier du disque, choisi une fois (Chrome, Edge) : le navigateur en
 * garde l'accès, à reconfirmer d'un clic quand il le demande.
 */
import { diskFile, diskFolder } from "../files/stored.ts";
import { kindOf, tx } from "./library.ts";
import type { LibrarySource, SourceFile } from "./library.ts";

type DirPicker = { showDirectoryPicker?: (o?: { id?: string; mode?: "read" | "readwrite" }) => Promise<FileSystemDirectoryHandle> };
type Permissions = {
  queryPermission(o: { mode: "readwrite" }): Promise<PermissionState>;
  requestPermission(o: { mode: "readwrite" }): Promise<PermissionState>;
};
type Iterable = { values(): AsyncIterable<FileSystemHandle> };

const dirPicker = (typeof window !== "undefined" ? window : {}) as DirPicker;

/** Le navigateur sait-il ouvrir un dossier et en garder l'accès ? */
export const canUseDisk = typeof dirPicker.showDirectoryPicker === "function" && typeof indexedDB !== "undefined";

const KEY = "folder";

/** Un dossier du disque, en source de la bibliothèque. */
export function diskLibrary(root: FileSystemDirectoryHandle): LibrarySource {
  return {
    kind: "disk",
    label: `Dossier « ${root.name} »`,
    locked: { hint: `Le navigateur demande de confirmer l'accès au dossier « ${root.name} ».`, action: "Autoriser l'accès" },
    root: diskFolder(root),
    access: async (ask = false) => {
      const permissions = root as unknown as Permissions;
      if ((await permissions.queryPermission({ mode: "readwrite" })) === "granted") return true;
      return ask && (await permissions.requestPermission({ mode: "readwrite" })) === "granted";
    },
    files: async () => {
      const out: SourceFile[] = [];
      const walk = async (fileSystemDirectoryHandle: FileSystemDirectoryHandle, folder: string) => {
        const dir = diskFolder(fileSystemDirectoryHandle);
        for await (const fileSystemHandle of (fileSystemDirectoryHandle as unknown as Iterable).values()) {
          if (fileSystemHandle.name.startsWith(".")) continue;
          if (fileSystemHandle.kind === "directory") {
            await walk(
              fileSystemHandle as FileSystemDirectoryHandle,
              folder ? `${folder}/${fileSystemHandle.name}` : fileSystemHandle.name,
            );
            continue;
          }
          if (!kindOf(fileSystemHandle.name)) continue;
          const handle = fileSystemHandle as FileSystemFileHandle;
          const file = await handle.getFile();
          out.push({
            path: folder ? `${folder}/${fileSystemHandle.name}` : fileSystemHandle.name,
            folder,
            name: fileSystemHandle.name,
            modified: file.lastModified,
            file: diskFile(handle),
            dir,
            head: () => file.slice(0, 32_000).text(),
          });
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
    const dir = (await tx("readonly", (objectStore) => objectStore.get(KEY))) as FileSystemDirectoryHandle | undefined;
    return dir ? diskLibrary(dir) : null;
  } catch {
    return null;
  }
}

/** Choisit le dossier de la bibliothèque et le retient. Renvoie null si l'utilisateur annule. */
export async function pickFolder(): Promise<LibrarySource | null> {
  try {
    const dir = await dirPicker.showDirectoryPicker!({ id: "prisma-library", mode: "readwrite" });
    await tx("readwrite", (objectStore) => objectStore.put(dir, KEY));
    return diskLibrary(dir);
  } catch (error) {
    if ((error as Error)?.name === "AbortError") return null;
    throw error;
  }
}
