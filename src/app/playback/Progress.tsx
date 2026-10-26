/**
 * Où en est la lecture : la mesure jouée sur le nombre de mesures du morceau, comptées dans l'ordre
 * où elles se jouent (reprises et ordre de jeu compris), sa section, et la piste de lecture : une
 * barre, remplie jusqu'à la mesure jouée, coupée au début de chaque section ; puis le temps écoulé
 * sur la durée de l'écoute, au tempo choisi, points d'orgue compris (sans le décompte). Au survol,
 * une bulle dit où l'on tombera, et à quel temps ; près d'un début de section, le pointeur s'y colle. Un clic ou un glissé
 * y place la lecture (au clavier : les flèches, une mesure ; Page précédente et suivante, une
 * section ; Début et Fin).
 */
import { useRef, useState, useSyncExternalStore } from "react";
import { follow } from "../score/follow.ts";
import { barAt, stretched } from "./performance.ts";
import type { PlayedSection } from "./performance.ts";
import { player, secondsPerTick } from "./player.ts";

/** À cette distance d'un début de section (en pixels), le pointeur s'y colle. */
const MAGNET = 6;

/** Une durée en minutes et secondes : « 1:05 ». */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function Progress({ bpm }: { bpm: number }) {
  const { played, bars, sections, holds } = useSyncExternalStore(player.subscribe, player.getSnapshot);
  const track = useRef<HTMLDivElement>(null);
  // la mesure sous le pointeur (la bulle), et pendant le glissé, celle où la lecture se placera au lâcher
  const [hovered, setHovered] = useState<number | null>(null);
  const [dragged, setDragged] = useState<number | null>(null);
  if (!bars.length) return null;

  const n = bars.length;
  const current = played === null ? null : barAt(bars, played);
  const shown = dragged ?? current;
  // la place du curseur, en mesures : la mesure jouée, et ce qui en est passé
  const position = dragged !== null ? dragged : current === null ? 0 : current + Math.min(1, (played! - bars[current].at) / (bars[current].end - bars[current].at));
  const sectionOf = (k: number) => sections.find((s) => k >= s.first && k < s.first + s.count);
  const label = (k: number) => {
    const s = sectionOf(k);
    return `mesure ${k + 1} sur ${n}${s?.label ? `, section ${s.label}` : ""}`;
  };
  const percent = (bar: number) => `${(bar / n) * 100}%`;
  // le temps, d'un instant joué : au tempo de l'écoute, les points d'orgue tenus
  const time = (at: number) => clock(stretched(holds, at) * secondsPerTick(bpm));
  const total = time(bars[n - 1].end);
  const elapsed = dragged !== null ? time(bars[dragged].at) : played === null ? null : time(played);

  const seek = (k: number) => {
    follow.release();
    player.seekPlayed(bars[Math.max(0, Math.min(n - 1, k))].at);
  };
  /** La mesure sous le pointeur ; près d'un début de section, ce début. */
  const barFromX = (x: number) => {
    const r = track.current!.getBoundingClientRect();
    const near = sections.find((s) => Math.abs(r.left + (s.first / n) * r.width - x) <= MAGNET);
    return near ? near.first : Math.max(0, Math.min(n - 1, Math.floor(((x - r.left) / r.width) * n)));
  };
  const key = (e: React.KeyboardEvent) => {
    const k = current ?? 0;
    const s = sectionOf(k);
    const at = s ? sections.indexOf(s) : 0;
    const to = { ArrowRight: k + 1, ArrowUp: k + 1, ArrowLeft: k - 1, ArrowDown: k - 1, Home: 0, End: n - 1, PageDown: sections[at + 1]?.first ?? n - 1, PageUp: s && k > s.first ? s.first : (sections[at - 1]?.first ?? 0) }[e.key];
    if (to === undefined) return;
    e.preventDefault();
    seek(to);
  };

  return (
    <span className="flex items-center gap-4 w-full">
      <Counter bar={shown} count={n} section={shown === null ? undefined : sectionOf(shown)} />
      <div
        ref={track}
        className="relative flex-1 h-5 cursor-pointer touch-none rounded focus-visible:outline-2 focus-visible:outline-accent focus-visible:outline-offset-2"
        role="slider"
        tabIndex={0}
        aria-label="Position dans le morceau"
        aria-valuemin={1}
        aria-valuemax={n}
        aria-valuenow={(shown ?? 0) + 1}
        aria-valuetext={label(shown ?? 0)}
        onKeyDown={key}
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          setDragged(barFromX(e.clientX));
        }}
        onPointerMove={(e) => {
          const k = barFromX(e.clientX);
          setHovered(k);
          if (dragged !== null) setDragged(k);
        }}
        onPointerUp={() => {
          if (dragged !== null) seek(dragged);
          setDragged(null);
        }}
        onPointerCancel={() => setDragged(null)}
        onPointerLeave={() => setHovered(null)}
      >
        {/* la barre, et la partie jouée, à la couleur de l'accent */}
        <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line">
          <span className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: percent(position) }} />
        </span>
        {/* le début de chaque section, sauf la première : une coupure de la barre, à la couleur du fond */}
        {sections.slice(1).map((s) => (
          <span key={s.first} className="absolute top-1/2 h-1.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-panel" style={{ left: percent(s.first) }} />
        ))}
        {(played !== null || dragged !== null) && <span className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-accent bg-white pointer-events-none" style={{ left: percent(position) }} />}
        {hovered !== null && <Bubble at={percent(hovered + 0.5)} bar={hovered} time={time(bars[hovered].at)} section={sectionOf(hovered)} />}
      </div>
      <span className="text-muted text-[13px] tabular-nums whitespace-nowrap" title="Le temps écoulé, sur la durée de l'écoute au tempo choisi">
        {elapsed ?? "–"} / {total}
      </span>
    </span>
  );
}

/** La mesure jouée sur le nombre de mesures, et la lettre de sa section, dans son carré comme sur la partition. */
function Counter({ bar, count, section }: { bar: number | null; count: number; section?: PlayedSection }) {
  return (
    <span className="flex items-center gap-1.5 text-muted text-[13px] tabular-nums whitespace-nowrap" title="La mesure jouée, sur les mesures du morceau dans l'ordre où elles se jouent, et sa section">
      {bar === null ? "–" : bar + 1} / {count}
      {section?.label && <SectionMark label={section.label} />}
    </span>
  );
}

/** La lettre d'une section, blanc sur noir, le signe des sections sur la partition. */
function SectionMark({ label }: { label: string }) {
  return <span className="inline-grid place-items-center min-w-[1.5em] h-[1.5em] px-1 rounded-[2px] bg-ink text-white text-[11px] font-bold leading-none">{label}</span>;
}

/** Sous le pointeur : la mesure où l'on tombera, à quel temps, et sa section. */
function Bubble({ at, bar, time, section }: { at: string; bar: number; time: string; section?: PlayedSection }) {
  return (
    <span className="absolute top-full mt-2 z-30 flex items-center gap-1.5 px-2 py-1 -translate-x-1/2 bg-white border border-line rounded-md shadow-[0_4px_14px_rgba(0,0,0,0.12)] text-[13px] tabular-nums whitespace-nowrap pointer-events-none" style={{ left: at }}>
      mesure {bar + 1}
      <span className="text-muted">{time}</span>
      {section?.label && <SectionMark label={section.label} />}
    </span>
  );
}
