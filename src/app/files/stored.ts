/**
 * Un fichier et un dossier, où qu'ils soient : sur le disque (Chrome, Edge), et demain sur un
 * drive en ligne. Le reste de l'application ne connaît qu'eux : lire un fichier, le réécrire en
 * place, trouver un fichier d'un dossier par son nom (les réglages d'un morceau, le .prisma d'un
 * MusicXML importé), le créer, le retirer. Un `File` est un fichier lisible (son nom, son texte).
 */

/** Un fichier qu'on lit : son nom, son texte. */
export type Readable = { name: string; text(): Promise<string> };

/** Un fichier qu'on lit et réécrit en place. */
export type StoredFile = Readable & { write(text: string): Promise<void> };

/** Un dossier : ses fichiers, par leur nom. */
export type StoredFolder = {
  name: string;
  /** Le fichier de ce nom, s'il existe. */
  file(name: string): Promise<StoredFile | null>;
  /** Le fichier de ce nom, créé s'il n'existe pas. */
  create(name: string): Promise<StoredFile>;
  /** Retire le fichier de ce nom, s'il existe. */
  remove(name: string): Promise<void>;
};

/** Un fichier du disque. */
export function diskFile(handle: FileSystemFileHandle): StoredFile {
  return {
    name: handle.name,
    text: async () => (await handle.getFile()).text(),
    write: async (text) => {
      const out = await handle.createWritable();
      await out.write(text);
      await out.close();
    },
  };
}

/** Un dossier du disque. */
export function diskFolder(dir: FileSystemDirectoryHandle): StoredFolder {
  return {
    name: dir.name,
    file: async (name) => {
      try {
        return diskFile(await dir.getFileHandle(name));
      } catch (e) {
        if ((e as Error)?.name === "NotFoundError") return null;
        throw e;
      }
    },
    create: async (name) => diskFile(await dir.getFileHandle(name, { create: true })),
    remove: (name) => dir.removeEntry(name).catch(() => undefined),
  };
}
