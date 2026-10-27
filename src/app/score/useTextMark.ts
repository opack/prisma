/**
 * Le curseur du texte sur la partition : le signe qu'il pointe y est encadré, et amené à l'écran quand
 * il bouge (sauf pendant l'écoute, qui mène le défilement) ; en édition, si l'option le demande. Le
 * choix d'une case ouvert, c'est elle qui est encadrée. Sans rendu de l'application à chaque
 * mouvement du curseur : la partition écoute textMark.
 */
import { useCallback, useEffect, useRef } from "react";
import type { MutableRefObject } from "react";
import { textPlace } from "../../core/locate.ts";
import { player } from "../playback/player.ts";
import type { RetouchMark } from "../retouch/useRetouch.ts";
import { textMark } from "./textMark.ts";

export function useTextMark(linked: boolean, retouch: MutableRefObject<RetouchMark>, open: unknown, lane: number | undefined) {
  const caret = useRef<[number, number, string] | null>(null);
  const linkedNow = useRef(linked);
  linkedNow.current = linked;
  const mark = useCallback((reveal: boolean) => {
    const r = retouch.current;
    if (r) return textMark.set({ place: r.lane === undefined ? r.clicked : { ...r.at, octave: r.lane, content: undefined }, reveal: false });
    const c = caret.current;
    const place = linkedNow.current && c ? textPlace(c[2], c[0], c[1]) : undefined;
    textMark.set(place ? { place, reveal: reveal && player.getSnapshot().state !== "playing" } : null);
  }, []);
  useEffect(() => mark(false), [linked, mark, open, lane]);
  /** Le curseur a bougé : sa ligne, sa colonne, le texte. */
  return useCallback(
    (line: number, column: number, text: string) => {
      caret.current = [line, column, text];
      mark(true);
    },
    [mark],
  );
}
