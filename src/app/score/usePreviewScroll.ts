/**
 * Le défilement de la partition : Ctrl + molette y zoome (pas la page entière) ; défiler à la main
 * (molette, doigt, barre de défilement) suspend le suivi de la lecture, jusqu'à une seconde sans
 * geste ; en lecture, les flèches et Page précédente, suivante tournent les pages (une page côte à
 * côte, un écran l'une sous l'autre). La première page sortie de l'écran : le sens où l'on a défilé,
 * pour le bouton qui ramène au début.
 */
import { useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import { follow } from "./follow.ts";
import type { Fit } from "./useView.ts";

export function usePreviewScroll(preview: RefObject<HTMLElement | null>, reading: boolean, fit: Fit, zoomBy: (dir: 1 | -1) => void) {
  const [scrolled, setScrolled] = useState<"up" | "left" | null>(null);
  const zoom = useRef(zoomBy);
  zoom.current = zoomBy;
  useEffect(() => {
    const pane = preview.current;
    if (!pane) return;
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) return follow.hold();
      e.preventDefault();
      zoom.current(e.deltaY < 0 ? 1 : -1);
    };
    // pendant la promenade, tout défilement est le sien (le suivi, lui, ne fait plus défiler) et la prolonge
    const hold = () => follow.hold();
    const onBar = (e: PointerEvent) => e.target === pane && (e.offsetX > pane.clientWidth || e.offsetY > pane.clientHeight) && hold();
    const onScroll = () => {
      if (!follow.active() && follow.enabled()) hold();
      const first = pane.querySelector(".page")?.getBoundingClientRect();
      const across = first ? pane.scrollLeft > first.width : false,
        down = first ? pane.scrollTop > first.height : false;
      setScrolled(across ? "left" : down ? "up" : null);
    };
    pane.addEventListener("wheel", onWheel, { passive: false });
    pane.addEventListener("touchmove", hold, { passive: true });
    pane.addEventListener("pointerdown", onBar);
    pane.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      pane.removeEventListener("wheel", onWheel);
      pane.removeEventListener("touchmove", hold);
      pane.removeEventListener("pointerdown", onBar);
      pane.removeEventListener("scroll", onScroll);
    };
  }, []);
  useEffect(() => {
    if (!reading) return;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (e.ctrlKey || e.metaKey || e.altKey || target.closest("input, select, textarea, .cm-editor, [data-drawer]")) return;
      const turn = { PageDown: 1, ArrowRight: 1, ArrowDown: 1, PageUp: -1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
      const pane = preview.current;
      if (!turn || !pane || fit === "focus") return;
      e.preventDefault();
      follow.hold();
      if (fit === "width") return pane.scrollBy({ top: turn * pane.clientHeight * 0.9, behavior: "smooth" });
      const page = pane.querySelector<SVGSVGElement>(".page");
      const step = page ? page.getBoundingClientRect().width + parseFloat(getComputedStyle(pane).columnGap || "0") : pane.clientWidth;
      pane.scrollBy({ left: turn * step, behavior: "smooth" });
    };
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [reading, fit]);
  return scrolled;
}
