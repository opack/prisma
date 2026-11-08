/**
 * La retouche depuis la partition : un clic y place le curseur du texte sur le signe cliqué (en
 * édition, sans prendre le clavier) ; un double-clic ouvre le choix de la note de la case
 * (RetouchMenu). Chaque choix réécrit le texte, comme une frappe, puis la partition est remise en
 * page ; la durée, les ajouts et l'octave laissent le choix ouvert, et la note écrite dans une case
 * vide aussi, pour lui donner aussitôt son doigté, sa trille, sa durée. Pendant l'écoute, la partition ne
 * s'édite pas, et l'écoute qui démarre ferme le choix.
 */
import { computed, onScopeDispose, ref, shallowRef, watch } from "vue";
import type { Ref } from "vue";
import { stringsOfStaff } from "../../core/index.ts";
import type { Score } from "../../core/index.ts";
import { STRING_LANE, isWrittenCase, locate } from "../../core/locate.ts";
import type { ScorePlace } from "../../core/locate.ts";
import { player } from "../playback/player.ts";
import {
  cellOf,
  durationOf,
  freeStrings,
  holdChoices,
  holdIn,
  moveOctave,
  octaveRoomOf,
  placeOnString,
  resize,
  retouch,
} from "./retouch.ts";
import { pick } from "../score/pick.ts";
import type { ScreenPoint } from "../score/pick.ts";
import type { EditorHandle } from "../editor/codemirror.ts";

/** at : la note que le choix retouche (sa case d'attaque) ; clicked : la case cliquée, qui reste encadrée (une tenue de la note, par exemple). */
type Retouch = {
  at: ScorePlace;
  clicked: ScorePlace;
  where: ScreenPoint;
  content: string;
  canHold: boolean;
  duration?: ReturnType<typeof durationOf>;
  holds: string[];
};
/** La case encadrée sur la partition, le choix ouvert : la case cliquée, ou, sur une autre corde choisie, la case où la note ira. */
export type RetouchMark = { at: ScorePlace; clicked: ScorePlace; lane?: number } | null;

type Deps = {
  /** Le texte à jour. */
  source: Readonly<Ref<string>>;
  /** Réécrit le texte (et le remet en page) ; faux s'il ne change pas. */
  rewrite: (rewritten: { text: string; line: number; column: number } | undefined) => boolean;
  editor: Readonly<Ref<EditorHandle | null>>;
  /** Un clic place le curseur du texte : en édition, si l'option le demande. */
  linked: Readonly<Ref<boolean>>;
  /** La dernière mise en page, pour les cordes d'une portée. */
  score: Readonly<Ref<Score | undefined>>;
};

const playing = () => ["playing", "loading"].includes(player.getSnapshot().state);

/** Ce que le choix montre d'une case : son contenu, la durée de sa note, les notes qu'elle peut tenir. */
function describe(text: string, at: ScorePlace, where: ScreenPoint, clicked: ScorePlace = at): Retouch | null {
  const cell = at.octave !== undefined ? cellOf(text, at) : undefined;
  if (!cell) return null;
  const duration = cell.content ? durationOf(text, at) : undefined;
  return {
    at: duration?.attack ?? at,
    clicked,
    where,
    content: cell.content,
    canHold: cell.canHold,
    duration,
    holds: cell.content || !cell.exact ? [] : holdChoices(text, at),
  };
}

export function useRetouch({ source, rewrite, editor, linked, score }: Deps) {
  const open = shallowRef<Retouch | null>(null);
  // la corde choisie dans le choix d'une case de corde, pour y placer la note
  const lane = ref<number | undefined>(undefined);
  watch(open, () => (lane.value = undefined));
  const mark = computed<RetouchMark>(() => open.value && { at: open.value.at, clicked: open.value.clicked, lane: lane.value });

  const stopPick = pick.subscribe((at, where, kind) => {
    if (playing()) return;
    // une case que la règle détaillée ajoute n'est pas dans le texte : rien à y retoucher
    if (kind === "edit") return void (open.value = isWrittenCase(source.value, at.t) ? describe(source.value, at, where) : null);
    if (!linked.value) return;
    const place = locate(source.value, at);
    if (place) editor.value?.goTo(place.line, place.column, false);
  });
  const stopPlayer = player.subscribe(() => playing() && (open.value = null));
  onScopeDispose(() => {
    stopPick();
    void stopPlayer();
  });

  // les cordes de la portée d'une case de corde ; la corde de la case, ce que font sonner les cordes à vide (capo compris), et celles où la note peut passer
  const stringsAt = (at: ScorePlace) =>
    at.octave !== undefined && at.octave >= STRING_LANE && score.value ? stringsOfStaff(score.value.parts, at.staff) : undefined;
  function stringOf(at: ScorePlace) {
    const strings = stringsAt(at);
    return (
      strings && {
        string: at.octave! - STRING_LANE,
        open: strings.open.map((midi) => midi + strings.capo),
        free: freeStrings(source.value, at, strings.open.length),
      }
    );
  }

  /** Ce que montre le choix ouvert. */
  const menu = computed(() => {
    const retouching = open.value;
    if (!retouching) return null;
    return {
      x: retouching.where.x,
      y: retouching.where.y,
      octave: retouching.at.octave,
      content: retouching.content,
      canHold: retouching.canHold,
      duration: retouching.duration,
      holds: retouching.holds,
      strings: stringOf(retouching.at),
      octaves: retouching.duration && !stringsAt(retouching.at) ? octaveRoomOf(retouching.at) : undefined,
    };
  });

  const close = () => (open.value = null);
  return {
    menu,
    mark,
    close,
    // une note, la tenue, le vide : dans la case cliquée (sur une tenue, une note nouvelle commence là ; vide, la note s'arrête avant)
    // dans une case vide, la note choisie : le choix reste ouvert sur elle, pour son doigté, sa trille, sa durée
    pick(content: string) {
      const { clicked, where, content: before } = open.value!;
      const result = retouch(source.value, clicked, content);
      const fresh = !before && /^\d+$/.test(content);
      open.value = rewrite(result) && fresh ? describe(result!.text, clicked, where) : null;
    },
    hold(note: string) {
      rewrite(holdIn(source.value, open.value!.at, note));
      close();
    },
    resize(by: 1 | -1) {
      const { at, where, clicked } = open.value!;
      const done = resize(source.value, at, by);
      if (rewrite(done)) open.value = describe(done!.text, at, where, clicked);
    },
    // un ajout à la note (doigté, trille, petite note)
    amend(content: string) {
      const { at, where, clicked } = open.value!;
      const result = retouch(source.value, at, content);
      if (rewrite(result)) open.value = describe(result!.text, { ...at, content }, where, clicked);
    },
    // l'octave de la note : le choix reste sur la note, à sa nouvelle place
    octave(direction: 1 | -1) {
      const { at, where, clicked } = open.value!;
      const result = moveOctave(source.value, at, direction);
      if (rewrite(result))
        open.value = describe(result!.text, { ...at, octave: result!.octave }, where, { ...clicked, octave: result!.octave });
    },
    // sur une corde : la note passe à la case choisie, sur cette corde ou une autre ; sur une tenue et sa corde, une note nouvelle commence dans la case cliquée
    string(string: number, fret: number) {
      const { at, clicked, where, content } = open.value!;
      const home = string === at.octave! - STRING_LANE;
      const result =
        home && content.startsWith("-") ? retouch(source.value, clicked, String(fret)) : placeOnString(source.value, at, string, fret);
      // dans une case vide de la corde, comme une note : le choix reste ouvert sur elle
      open.value = rewrite(result) && home && !content ? describe(result!.text, clicked, where) : null;
    },
    target(string: number) {
      lane.value = string === open.value!.at.octave! - STRING_LANE ? undefined : STRING_LANE + string;
    },
  };
}
