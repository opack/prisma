/**
 * La bibliothèque sur pCloud : le dossier de l'app (Applications/Prisma), sous-dossiers compris,
 * lu en un seul appel. Ses fichiers se lisent et se réécrivent en place ; un dossier connaît ses
 * fichiers par cette lecture (les réglages d'un morceau, à côté de lui, sans appel de plus), et
 * demande à pCloud ceux qu'il ne connaît pas. Un texte lu se garde le temps de la page, tant que le
 * fichier ne change pas : la vignette ne le télécharge pas une seconde fois.
 */
import type { StoredFile, StoredFolder } from "../files/stored.ts";
import { kindOf } from "./library.ts";
import type { LibrarySource, SourceFile } from "./library.ts";
import { NOT_FOUND, PCLOUD_FOLDER, PcloudError, call, connect, download, session, upload } from "./pcloud.ts";
import type { PcloudItem } from "./pcloud.ts";

const texts = new Map<string, string>();

type Known = { fileid: number; modified: number };

/** Un fichier de pCloud, connu par son identifiant ; réécrit, il en change (written : pour le dire à son dossier). */
function pcloudFile(folder: string, name: string, known?: Known, written?: (id: Known) => void): StoredFile {
  let id = known;
  return {
    name,
    where: "sur pCloud",
    text: async () => {
      if (!id) {
        const response = await call<{ metadata: PcloudItem }>("stat", { path: join(folder, name) });
        id = { fileid: response.metadata.fileid!, modified: Date.parse(response.metadata.modified) };
      }
      const key = `${id.fileid}:${id.modified}`;
      const cached = texts.get(key);
      if (cached !== undefined) return cached;
      const text = await download(id.fileid);
      texts.set(key, text);
      return text;
    },
    write: async (text) => {
      id = await upload(folder, name, text);
      texts.set(`${id.fileid}:${id.modified}`, text);
      written?.(id);
    },
  };
}

const join = (folder: string, name: string) => `${folder}/${name}`;

/** Un dossier de pCloud, par son chemin dans le dossier de l'app (« » : sa racine) ; children : ses fichiers, s'ils sont connus. */
function pcloudFolder(path: string, children?: Map<string, Known>): StoredFolder {
  return {
    name: path.split("/").pop() || PCLOUD_FOLDER,
    file: async (name) => {
      if (children) {
        const known = children.get(name);
        return known ? pcloudFile(path, name, known) : null;
      }
      try {
        const response = await call<{ metadata: PcloudItem }>("stat", { path: join(path, name) });
        return response.metadata.isfolder
          ? null
          : pcloudFile(path, name, { fileid: response.metadata.fileid!, modified: Date.parse(response.metadata.modified) });
      } catch (error) {
        if (error instanceof PcloudError && NOT_FOUND.has(error.code)) return null;
        throw error;
      }
    },
    // un fichier créé, une fois écrit : le dossier le compte, pour qu'on le retrouve sans le redemander
    create: async (name) => pcloudFile(path, name, children?.get(name), (id) => children?.set(name, id)),
    remove: async (name) => {
      await call("deletefile", { path: join(path, name) }).catch((error) => {
        if (!(error instanceof PcloudError && NOT_FOUND.has(error.code))) throw error;
      });
      children?.delete(name);
    },
  };
}

/** Le dossier de l'app sur pCloud, en source de la bibliothèque. */
export function pcloudLibrary(): LibrarySource {
  return {
    kind: "pcloud",
    label: `pCloud, dossier « ${PCLOUD_FOLDER} »`,
    locked: {
      hint: `Connectez-vous à pCloud pour retrouver vos partitions, dans le dossier « ${PCLOUD_FOLDER} ».`,
      action: "Se connecter à pCloud",
    },
    root: pcloudFolder(""),
    // sans connexion : la demander, en réponse à un clic (on quitte la page, pCloud la rend)
    access: async (ask = false) => {
      if (session()) return true;
      if (ask) connect();
      return false;
    },
    files: async () => {
      const response = await call<{ metadata: PcloudItem }>("listfolder", { path: "/", recursive: 1 });
      const out: SourceFile[] = [];
      const walk = (item: PcloudItem, folder: string, path: string) => {
        const items = item.contents ?? [];
        const children = new Map(
          items.filter((child) => !child.isfolder).map((child) => [child.name, { fileid: child.fileid!, modified: Date.parse(child.modified) }]),
        );
        const dir = pcloudFolder(path, children);
        for (const child of items) {
          if (child.name.startsWith(".")) continue;
          if (child.isfolder) walk(child, folder ? `${folder}/${child.name}` : child.name, `${path}/${child.name}`);
          else if (kindOf(child.name)) {
            const known = children.get(child.name)!;
            out.push({
              path: folder ? `${folder}/${child.name}` : child.name,
              folder,
              name: child.name,
              modified: known.modified,
              file: pcloudFile(path, child.name, known),
              dir,
            });
          }
        }
      };
      walk(response.metadata, "", "");
      return out;
    },
  };
}
