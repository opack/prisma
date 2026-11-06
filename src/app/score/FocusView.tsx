/**
 * Lecture focalisée : deux systèmes à l'écran, toujours aux mêmes places. On joue celui du haut,
 * puis celui du bas ; à l'avant-dernière mesure de l'un, l'autre place reçoit le système joué
 * ensuite (selon l'ordre de jeu et les reprises). Le regard ne quitte jamais ces deux places : ni
 * page à tourner, ni défilement.
 */
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import type { Page, PlacedSystem } from "./engrave.ts";
import { PAGE } from "./engrave.ts";
import type { RenderOptions } from "../options/options.ts";
import { player } from "../playback/player.ts";
import { CursorRect, FONT, OrderLine, SeekAreas, SystemView, TextMarks, barsIn, columnAt } from "./PageView.tsx";

type Slots = [number, number];

export function FocusView({ pages, options }: { pages: Page[]; options: RenderOptions }) {
  const systems = useMemo(() => pages.flatMap((page) => page.systems), [pages]);
  const { tick } = useSyncExternalStore(player.subscribe, player.getSnapshot);
  const at = (moment: number | null) => (moment === null ? -1 : systems.findIndex((ps) => moment >= ps.sys.start && moment < ps.sys.end));
  const cur = at(tick);
  const ci = cur >= 0 ? columnAt(systems[cur], tick!) : -1;
  // l'autre système joué après celui-ci : la suite, le retour d'une reprise, la section suivante ;
  // une reprise ou une section rejouée sur place (« A A B ») ne compte pas, la place resterait en double
  const after = (index: number) => {
    const then = player.elsewhere(systems[index].sys.start, systems[index].sys.end);
    return then === null ? -1 : at(then);
  };
  const start = (): Slots => [0, systems.length > 1 ? 1 : -1];
  const [slots, setSlots] = useState<Slots>(start);
  // un autre morceau, ou une autre mise en page : on repart du début
  useEffect(() => setSlots(start()), [systems]);

  useEffect(() => {
    // à l'arrêt, le début du morceau
    if (tick === null) {
      const initial = start();
      if (initial[0] !== slots[0] || initial[1] !== slots[1]) setSlots(initial);
      return;
    }
    if (cur < 0) return;
    const here = slots.indexOf(cur);
    // un saut ailleurs (un clic, une section) : le système joué en haut, le suivant dessous
    if (here < 0) return setSlots([cur, after(cur)]);
    // à l'avant-dernière mesure, l'autre place reçoit la suite (rien à faire si elle y est déjà)
    const bars = barsIn(systems[cur]);
    const barIndex = bars.findIndex((bar) => bar.includes(ci));
    if (barIndex < bars.length - 2) return;
    const next = after(cur);
    if (next >= 0 && slots[1 - here] !== next) setSlots((current) => (here ? [next, current[1]] : [current[0], next]));
  }, [tick, cur, ci, slots, systems]);

  // une même échelle pour les deux places : la largeur des systèmes, la hauteur du plus haut
  const frame = useMemo(() => {
    const pad = 2;
    const first = systems[0];
    if (!first) return null;
    const named = first.parts.filter((part) => part.name).map((part) => [...part.name!].length * 1.45 + 2.6);
    const braced = first.parts.some((part) => part.last > part.first) ? 1.8 : 0;
    const x0 = PAGE.marginX - pad - Math.max(braced, ...named);
    const x1 = Math.max(...systems.map((ps) => ps.xs[ps.xs.length - 1] + ps.ws[ps.ws.length - 1])) + pad;
    const height = Math.max(...systems.map((ps) => ps.height)) + 2 * pad;
    return { x0, w: x1 - x0, h: height, pad };
  }, [systems]);
  if (!frame) return null;
  const order = pages[0]?.order ?? [];
  const top = (ps: PlacedSystem) => ps.y - frame.pad - (frame.h - 2 * frame.pad - ps.height) / 2;

  return (
    <div
      className={`print:hidden! grid flex-1 self-stretch gap-3 w-full min-h-0 ${order.length ? "grid-rows-[auto_1fr_1fr]" : "grid-rows-[1fr_1fr]"}`}
    >
      {/* l'ordre de jeu, comme en tête de page : la section jouée entourée, un clic pour y aller */}
      {order.length > 0 && (
        <svg className="block w-full h-auto max-h-[48px]" viewBox={`${frame.x0} 0 ${frame.w} 6.6`} fontFamily={FONT}>
          <OrderLine order={order} y={1.6} cx={frame.x0 + frame.w / 2} live />
        </svg>
      )}
      {slots.map((index, place) => {
        const ps: PlacedSystem | undefined = systems[index];
        // la place qu'on ne joue pas : le système à venir, à peine atténué, ou celui qu'on vient de jouer, effacé
        const role = cur < 0 || index === cur ? "" : index === after(cur) ? "opacity-80" : "opacity-35";
        return (
          <div
            key={`${place}:${index}`}
            className={`min-h-0 bg-white shadow-[0_1px_3px_rgba(0,0,0,.18),0_6px_18px_rgba(0,0,0,.08)] [transition:opacity_.3s] animate-focus-in [&_svg]:block [&_svg]:w-full [&_svg]:h-full ${role}`}
          >
            {ps && (
              // centré dans sa place : la place a la hauteur du plus haut système
              <svg
                viewBox={`${frame.x0} ${top(ps)} ${frame.w} ${frame.h}`}
                preserveAspectRatio="xMidYMid meet"
                fontFamily={FONT}
                style={{ fontVariantNumeric: "tabular-nums" }}
              >
                <rect x={frame.x0} y={top(ps)} width={frame.w} height={frame.h} fill="#fff" />
                <SystemView ps={ps} options={options} names={index === 0 || options.namesEverySystem} />
                <TextMarks systems={[ps]} />
                <SeekAreas systems={[ps]} />
                {index === cur && <CursorRect ps={ps} column={ci} />}
              </svg>
            )}
          </div>
        );
      })}
    </div>
  );
}
