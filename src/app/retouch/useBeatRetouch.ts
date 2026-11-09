/**
 * La retouche d'un temps depuis la partition : un double-clic sur la règle ouvre le menu du temps
 * (BeatMenu) ; chaque choix réécrit le temps sur toutes les lignes de son système du texte, comme
 * une frappe (Ctrl+Z l'annule), puis la partition est remise en page. Pendant l'écoute, la
 * partition ne s'édite pas, et l'écoute qui démarre ferme le menu.
 */
import { computed, onScopeDispose, shallowRef } from "vue";
import type { Ref } from "vue";
import { TICKS_PER_BEAT } from "../../core/index.ts";
import type { Score } from "../../core/index.ts";
import { rulerCase } from "../../core/locate.ts";
import { applyRewrite, beatActions, cellWidth, mergeBeat, splitBeat } from "../editor/beat.ts";
import type { BeatAction } from "../editor/beat.ts";
import { systemOf } from "../editor/complete.ts";
import { player } from "../playback/player.ts";
import { pick } from "../score/pick.ts";
import type { ScreenPoint } from "../score/pick.ts";

type Deps = {
  source: Readonly<Ref<string>>;
  /** Réécrit le texte (et le remet en page) ; faux s'il ne change pas. */
  rewrite: (rewritten: { text: string; line: number; column: number } | undefined) => boolean;
  /** La dernière mise en page, pour nommer le temps. */
  score: Readonly<Ref<Score | undefined>>;
};

/** Le temps retouché : la ligne de sa règle et la colonne de sa case dans le texte, où ouvrir le menu, son nom. */
type Opened = { line: number; column: number; where: ScreenPoint; title: string };

const playing = () => ["playing", "loading"].includes(player.getSnapshot().state);

export function useBeatRetouch({ source, rewrite, score }: Deps) {
  const open = shallowRef<Opened | null>(null);

  const stopPick = pick.subscribe((at, where, kind) => {
    if (kind !== "edit" || at.staff >= 0 || playing()) return;
    const found = rulerCase(source.value, at.t);
    const beat = score.value?.beats[Math.floor(at.t / TICKS_PER_BEAT)];
    open.value = found
      ? { line: found.line, column: found.column, where, title: beat ? `Temps ${beat.label}, mesure ${beat.bar}` : "Temps" }
      : null;
  });
  const stopPlayer = player.subscribe(() => playing() && (open.value = null));
  onScopeDispose(() => {
    stopPick();
    void stopPlayer();
  });

  const system = (lines: string[], line: number) => systemOf(lines, line);

  /** Ce que montre le menu ouvert. */
  const menu = computed(() => {
    const opened = open.value;
    if (!opened) return null;
    const lines = source.value.split("\n");
    const sys = system(lines, opened.line);
    const actions = sys ? beatActions(lines, sys, opened.column) : [];
    return actions.length ? { x: opened.where.x, y: opened.where.y, title: opened.title, actions } : null;
  });

  return {
    menu,
    close: () => (open.value = null),
    act(action: BeatAction) {
      const opened = open.value;
      open.value = null;
      if (!opened) return;
      const lines = source.value.split("\n");
      const sys = system(lines, opened.line);
      if (!sys) return;
      const rewritten =
        action.kind === "split"
          ? splitBeat(lines, sys, opened.column, action.factor, cellWidth(source.value))
          : mergeBeat(lines, sys, opened.column);
      rewrite(applyRewrite(source.value, rewritten));
    },
  };
}
