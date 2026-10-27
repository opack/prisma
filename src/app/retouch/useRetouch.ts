/**
 * La retouche depuis la partition : un clic y place le curseur du texte sur le signe cliqué (en
 * édition, sans prendre le clavier) ; un double-clic ouvre le choix de la note de la case
 * (RetouchMenu). Chaque choix réécrit le texte, comme une frappe, puis la partition est remise en
 * page ; la durée, les ajouts et l'octave laissent le choix ouvert. Pendant l'écoute, la partition ne
 * s'édite pas, et l'écoute qui démarre ferme le choix.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import type { ComponentProps, MutableRefObject, RefObject } from "react";
import { stringsOfStaff } from "../../core/index.ts";
import type { Score } from "../../core/index.ts";
import { STRING_LANE, locate } from "../../core/locate.ts";
import type { ScorePlace } from "../../core/locate.ts";
import type { EditorHandle } from "../editor/SourceEditor.tsx";
import type { NameDisplay } from "../options/options.ts";
import { player } from "../playback/player.ts";
import { pick } from "../score/pick.ts";
import type { ScreenPoint } from "../score/pick.ts";
import { cellOf, durationOf, freeStrings, holdChoices, holdIn, moveOctave, octaveRoomOf, placeOnString, resize, retouch } from "./retouch.ts";
import type { RetouchMenu } from "./RetouchMenu.tsx";

/** at : la note que le choix retouche (sa case d'attaque) ; clicked : la case cliquée, qui reste encadrée (une tenue de la note, par exemple). */
type Retouch = { at: ScorePlace; clicked: ScorePlace; where: ScreenPoint; content: string; canHold: boolean; duration?: ReturnType<typeof durationOf>; holds: string[] };
/** La case encadrée sur la partition, le choix ouvert : la case cliquée, ou, sur une autre corde choisie, la case où la note ira. */
export type RetouchMark = { at: ScorePlace; clicked: ScorePlace; lane?: number } | null;

type Deps = {
  /** Le texte à jour. */
  current: MutableRefObject<string>;
  /** Réécrit le texte (et le remet en page) ; faux s'il ne change pas. */
  rewrite: (r: { text: string; line: number; column: number } | undefined) => boolean;
  editor: RefObject<EditorHandle | null>;
  /** Un clic place le curseur du texte : en édition, si l'option le demande. */
  linked: boolean;
  /** La dernière mise en page, pour les cordes d'une portée. */
  score?: Score;
  names: NameDisplay;
};

const playing = () => ["playing", "loading"].includes(player.getSnapshot().state);

/** Ce que le choix montre d'une case : son contenu, la durée de sa note, les notes qu'elle peut tenir. */
function describe(text: string, at: ScorePlace, where: ScreenPoint, clicked: ScorePlace = at): Retouch | null {
  const cell = at.octave !== undefined ? cellOf(text, at) : undefined;
  if (!cell) return null;
  const duration = cell.content ? durationOf(text, at) : undefined;
  return { at: duration?.attack ?? at, clicked, where, content: cell.content, canHold: cell.canHold, duration, holds: cell.content || !cell.exact ? [] : holdChoices(text, at) };
}

export function useRetouch({ current, rewrite, editor, linked, score, names }: Deps) {
  const [open, setOpen] = useState<Retouch | null>(null);
  // la corde choisie dans le choix d'une case de corde, pour y placer la note
  const [lane, setLane] = useState<number | undefined>(undefined);
  useEffect(() => setLane(undefined), [open]);
  const mark = useRef<RetouchMark>(null);
  mark.current = open && { at: open.at, clicked: open.clicked, lane };

  useEffect(
    () =>
      pick.subscribe((at, where, kind) => {
        if (playing()) return;
        if (kind === "edit") return setOpen(describe(current.current, at, where));
        if (!linked) return;
        const p = locate(current.current, at);
        if (p) editor.current?.goTo(p.line, p.column, false);
      }),
    [linked],
  );
  useEffect(() => {
    const off = player.subscribe(() => playing() && setOpen(null));
    return () => void off();
  }, []);
  const close = useCallback(() => setOpen(null), []);

  // les cordes de la portée d'une case de corde ; la corde de la case, ce que font sonner les cordes à vide (capo compris), et celles où la note peut passer
  const stringsAt = (at: ScorePlace) => (at.octave !== undefined && at.octave >= STRING_LANE && score ? stringsOfStaff(score.parts, at.staff) : undefined);
  const stringOf = (at: ScorePlace) => {
    const strs = stringsAt(at);
    return strs && { string: at.octave! - STRING_LANE, open: strs.open.map((m) => m + strs.capo), free: freeStrings(current.current, at, strs.open.length) };
  };

  let menu: ComponentProps<typeof RetouchMenu> | null = null;
  if (open) {
    const text = () => current.current;
    menu = {
      x: open.where.x,
      y: open.where.y,
      octave: open.at.octave,
      content: open.content,
      canHold: open.canHold,
      duration: open.duration,
      holds: open.holds,
      names,
      strings: stringOf(open.at),
      octaves: open.duration && !stringsAt(open.at) ? octaveRoomOf(open.at) : undefined,
      onClose: close,
      // une note, la tenue, le vide : dans la case cliquée (sur une tenue, une note nouvelle commence là ; vide, la note s'arrête avant)
      onPick: (content) => {
        rewrite(retouch(text(), open.clicked, content));
        setOpen(null);
      },
      onHold: (note) => {
        rewrite(holdIn(text(), open.at, note));
        setOpen(null);
      },
      onResize: (by) => {
        const r = resize(text(), open.at, by);
        if (rewrite(r)) setOpen(describe(r!.text, open.at, open.where, open.clicked));
      },
      // un ajout à la note (doigté, trille, petite note)
      onAmend: (content) => {
        const r = retouch(text(), open.at, content);
        if (rewrite(r)) setOpen(describe(r!.text, { ...open.at, content }, open.where, open.clicked));
      },
      // l'octave de la note : le choix reste sur la note, à sa nouvelle place
      onOctave: (dir) => {
        const r = moveOctave(text(), open.at, dir);
        if (rewrite(r)) setOpen(describe(r!.text, { ...open.at, octave: r!.octave }, open.where, { ...open.clicked, octave: r!.octave }));
      },
      // sur une corde : la note passe à la case choisie, sur cette corde ou une autre ; sur une tenue et sa corde, une note nouvelle commence dans la case cliquée
      onString: (string, fret) => {
        const home = string === open.at.octave! - STRING_LANE;
        rewrite(home && open.content.startsWith("-") ? retouch(text(), open.clicked, String(fret)) : placeOnString(text(), open.at, string, fret));
        setOpen(null);
      },
      onTarget: (string) => setLane(string === open.at.octave! - STRING_LANE ? undefined : STRING_LANE + string),
    };
  }
  return { menu, mark, open, lane };
}
