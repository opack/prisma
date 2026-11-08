/**
 * Le défilement de la partition : Ctrl + molette y zoome (pas la page entière) ; défiler à la main
 * (molette, doigt, barre de défilement) suspend le suivi de la lecture, jusqu'à une seconde sans
 * geste ; en lecture, les flèches et Page précédente, suivante tournent les pages (une page côte à
 * côte, un écran l'une sous l'autre). La première page sortie de l'écran : le sens où l'on a défilé,
 * pour le bouton qui ramène au début.
 */
import { useEventListener } from "@vueuse/core";
import { ref } from "vue";
import type { Ref } from "vue";
import { follow } from "./follow.ts";
import type { Fit } from "./view.ts";

const PAGE_TURNS: Record<string, 1 | -1> = { PageDown: 1, ArrowRight: 1, ArrowDown: 1, PageUp: -1, ArrowLeft: -1, ArrowUp: -1 };

export function usePreviewScroll(
  preview: Readonly<Ref<HTMLElement | null>>,
  reading: Readonly<Ref<boolean>>,
  fit: Readonly<Ref<Fit>>,
  zoomBy: (direction: 1 | -1) => void,
) {
  const scrolled = ref<"up" | "left" | null>(null);
  const hold = () => follow.hold();

  useEventListener(
    preview,
    "wheel",
    (event: WheelEvent) => {
      if (!event.ctrlKey) return hold();
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );
  // pendant la promenade, tout défilement est le sien (le suivi, lui, ne fait plus défiler) et la prolonge
  useEventListener(preview, "touchmove", hold, { passive: true });
  useEventListener(preview, "pointerdown", (event: PointerEvent) => {
    const pane = preview.value!;
    if (event.target === pane && (event.offsetX > pane.clientWidth || event.offsetY > pane.clientHeight)) hold();
  });
  useEventListener(
    preview,
    "scroll",
    () => {
      const pane = preview.value!;
      if (!follow.active() && follow.enabled()) hold();
      const first = pane.querySelector(".page")?.getBoundingClientRect();
      const across = first ? pane.scrollLeft > first.width : false;
      const down = first ? pane.scrollTop > first.height : false;
      scrolled.value = across ? "left" : down ? "up" : null;
    },
    { passive: true },
  );

  useEventListener(window, "keydown", (event: KeyboardEvent) => {
    const pane = preview.value;
    const turn = PAGE_TURNS[event.key];
    if (!reading.value || !turn || !pane || fit.value === "focus") return;
    const target = event.target as HTMLElement;
    if (event.ctrlKey || event.metaKey || event.altKey || target.closest("input, select, textarea, .cm-editor, [data-drawer]")) return;
    event.preventDefault();
    hold();
    if (fit.value === "width") return pane.scrollBy({ top: turn * pane.clientHeight * 0.9, behavior: "smooth" });
    const page = pane.querySelector<SVGSVGElement>(".page");
    const step = page ? page.getBoundingClientRect().width + parseFloat(getComputedStyle(pane).columnGap || "0") : pane.clientWidth;
    pane.scrollBy({ left: turn * step, behavior: "smooth" });
  });

  return scrolled;
}
