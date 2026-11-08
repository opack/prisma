/**
 * Le curseur du texte sur la partition : le signe qu'il pointe y est encadré, et amené à l'écran quand
 * il bouge (sauf pendant l'écoute, qui mène le défilement) ; en édition, si l'option le demande. Le
 * choix d'une case ouvert, c'est elle qui est encadrée. La partition écoute textMark.
 */
import { watch } from "vue";
import type { Ref } from "vue";
import { textPlace } from "../../core/locate.ts";
import { player } from "../playback/player.ts";
import { textMark } from "./textMark.ts";
import type { RetouchMark } from "../retouch/useRetouch.ts";

export function useTextMark(linked: Readonly<Ref<boolean>>, retouch: Readonly<Ref<RetouchMark>>) {
  let caret: { line: number; column: number; text: string } | null = null;

  function mark(reveal: boolean) {
    const retouching = retouch.value;
    if (retouching)
      return textMark.set({
        place: retouching.lane === undefined ? retouching.clicked : { ...retouching.at, octave: retouching.lane, content: undefined },
        reveal: false,
      });
    const place = linked.value && caret ? textPlace(caret.text, caret.line, caret.column) : undefined;
    textMark.set(place ? { place, reveal: reveal && player.getSnapshot().state !== "playing" } : null);
  }
  watch([linked, retouch], () => mark(false), { immediate: true });

  /** Le curseur a bougé : sa ligne, sa colonne, le texte. */
  return (line: number, column: number, text: string) => {
    caret = { line, column, text };
    mark(true);
  };
}
