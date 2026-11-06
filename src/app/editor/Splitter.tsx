/**
 * La barre entre l'éditeur et la partition, invisible, qui se montre au survol : on la tire pour
 * régler la largeur de l'éditeur, au clavier avec les flèches ; un double-clic rend la largeur par
 * défaut. Pendant le glissé, seule la variable CSS --editor de la zone (host) change, et la zone
 * porte data-resizing ; la largeur est retenue au lâcher.
 */
import type { KeyboardEvent, PointerEvent, RefObject } from "react";
import { EDITOR_WIDTH, clampWidth } from "../score/useView.ts";

export function Splitter({
  host,
  width,
  onWidth,
}: {
  host: RefObject<HTMLElement | null>;
  width: number;
  onWidth: (width: number) => void;
}) {
  const drag = (event: PointerEvent<HTMLDivElement>) => {
    const zone = host.current;
    if (!zone || event.button !== 0) return;
    event.preventDefault();
    const bar = event.currentTarget;
    bar.setPointerCapture(event.pointerId);
    const rect = zone.getBoundingClientRect();
    let editorWidth = width;
    const move = (ev: globalThis.PointerEvent) => {
      editorWidth = clampWidth((ev.clientX - rect.left) / rect.width);
      zone.style.setProperty("--editor", `${editorWidth * 100}%`);
    };
    const up = () => {
      bar.removeEventListener("pointermove", move);
      bar.removeEventListener("pointerup", up);
      bar.removeEventListener("pointercancel", up);
      delete zone.dataset.resizing;
      onWidth(editorWidth);
    };
    zone.dataset.resizing = "";
    bar.addEventListener("pointermove", move);
    bar.addEventListener("pointerup", up);
    bar.addEventListener("pointercancel", up);
  };
  const key = (event: KeyboardEvent) => {
    const step = event.key === "ArrowLeft" ? -0.02 : event.key === "ArrowRight" ? 0.02 : 0;
    if (!step) return;
    event.preventDefault();
    onWidth(clampWidth(width + step));
  };
  return (
    <div
      className="absolute z-2 inset-y-0 left-(--editor-width) w-[9px] -translate-x-[5px] cursor-col-resize touch-none outline-none narrow:hidden print:hidden after:absolute after:inset-y-0 after:left-[3px] after:w-[3px] after:transition-colors hover:after:bg-accent focus-visible:after:bg-accent group-data-resizing/split:after:bg-accent"
      role="separator"
      aria-orientation="vertical"
      aria-label="Largeur de l'éditeur"
      aria-valuenow={Math.round(width * 100)}
      aria-valuemin={20}
      aria-valuemax={80}
      tabIndex={0}
      title="Tirer pour régler la largeur de l'éditeur (double-clic : largeur par défaut)"
      onPointerDown={drag}
      onKeyDown={key}
      onDoubleClick={() => onWidth(EDITOR_WIDTH)}
    />
  );
}
