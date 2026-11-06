/**
 * Aperçus de la bibliothèque : la première page de chaque morceau, calculée à la demande (quand
 * le morceau paraît à l'écran), un morceau à la fois, hors de l'interface. Le résultat se garde
 * dans le navigateur, pour chaque morceau : il ne se recalcule que si le fichier a changé, si les
 * options de gravure ne sont plus les mêmes ou si l'application a changé (une lecture qui
 * échouait peut réussir, une gravure changer). Ce n'est qu'un cache : perdu, il se refait.
 */
import type { Meta } from "../../core/index.ts";
import type { Page } from "../score/engrave.ts";
import type { LibraryEntry } from "./library.ts";
import { THUMBS, tx } from "./library.ts";
import type { EngraveOptions } from "../score/render.ts";
import type { ThumbRequest } from "./thumbs.worker.ts";

/** Première page d'un morceau ; null : un morceau sans mesure. */
export type Thumb = { page: Page; total: number; meta: Meta } | null;
type Cached = { modified: number; options: string; thumb?: Thumb; error?: string };

const memory = new Map<string, Cached>();
let worker: Worker | undefined;
let nextId = 0;
const waiting = new Map<number, (r: { thumb?: Thumb; error?: string }) => void>();

function compute(req: Omit<ThumbRequest, "id">): Promise<{ thumb?: Thumb; error?: string }> {
  if (!worker) {
    worker = new Worker(new URL("./thumbs.worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (messageEvent: MessageEvent<{ id: number; thumb?: Thumb; error?: string }>) => {
      waiting.get(messageEvent.data.id)?.(messageEvent.data);
      waiting.delete(messageEvent.data.id);
    };
  }
  const id = nextId++;
  return new Promise((resolve) => {
    waiting.set(id, resolve);
    worker!.postMessage({ ...req, id });
  });
}

// un morceau à la fois : les premiers demandés (les premiers à l'écran) d'abord
let chain: Promise<unknown> = Promise.resolve();
const inFlight = new Map<string, Promise<Cached>>();

/** L'aperçu d'un morceau, du cache ou calculé ; une erreur de lecture le remplace par son message. */
export function thumbOf(entry: LibraryEntry, options: EngraveOptions): Promise<Cached> {
  // un aperçu fait par une autre version de l'application se refait
  const key = JSON.stringify({ build: __BUILD__, options });
  const fresh = (cached?: Cached) => cached && cached.modified === entry.modified && cached.options === key;
  const hit = memory.get(entry.path);
  if (fresh(hit)) return Promise.resolve(hit!);
  const pending = inFlight.get(entry.path + key);
  if (pending) return pending;
  const job = (async () => {
    const stored = await tx<Cached | undefined>("readonly", (objectStore) => objectStore.get(entry.path), THUMBS).catch(() => undefined);
    if (fresh(stored)) return stored!;
    const run = chain.then(async () => {
      const text = await entry.file.text();
      return compute({ text, kind: entry.kind, name: entry.name, options });
    });
    chain = run.catch(() => undefined);
    const result = await run;
    const cached: Cached = { modified: entry.modified, options: key, ...result };
    await tx("readwrite", (store) => store.put(cached, entry.path), THUMBS).catch(() => undefined);
    return cached;
  })().then((thumb) => {
    memory.set(entry.path, thumb);
    inFlight.delete(entry.path + key);
    return thumb;
  });
  inFlight.set(entry.path + key, job);
  return job;
}
