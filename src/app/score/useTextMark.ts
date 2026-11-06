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
    const retouching = retouch.current;
    if (retouching)
      return textMark.set({
        place: retouching.lane === undefined ? retouching.clicked : { ...retouching.at, octave: retouching.lane, content: undefined },
        reveal: false,
      });
    const caretAt = caret.current;
    const place = linkedNow.current && caretAt ? textPlace(caretAt[2], caretAt[0], caretAt[1]) : undefined;
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
