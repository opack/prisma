/**
 * Aperçus de la bibliothèque, calculés à part pour ne pas figer l'interface : un fichier lu,
 * importé s'il le faut, gravé ; on renvoie sa première page.
 */
import { engravePages, scoreOf } from "../score/render.ts";
import type { EngraveOptions } from "../score/render.ts";

export type ThumbRequest = { id: number; text: string; kind: "prisma" | "musicxml"; name: string; options: EngraveOptions };

self.onmessage = (e: MessageEvent<ThumbRequest>) => {
  const { id, text, kind, name, options } = e.data;
  try {
    const score = scoreOf(text, kind, name);
    const pages = engravePages(score, options);
    self.postMessage({ id, thumb: pages.length ? { page: pages[0], total: pages.length, meta: score.meta } : null });
  } catch (err) {
    self.postMessage({ id, error: (err as Error).message });
  }
};
