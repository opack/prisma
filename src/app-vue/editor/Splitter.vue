<script setup lang="ts">
/**
 * La barre entre l'éditeur et la partition, invisible, qui se montre au survol : on la tire pour
 * régler la largeur de l'éditeur, au clavier avec les flèches ; un double-clic rend la largeur par
 * défaut. Pendant le glissé, seule la variable CSS --editor de la zone (host) change, et la zone
 * porte data-resizing ; la largeur est retenue au lâcher.
 */
import { EDITOR_WIDTH, clampWidth } from "../../app/score/view.ts";

const props = defineProps<{ host?: HTMLElement }>();
const width = defineModel<number>({ required: true });

function drag(event: PointerEvent) {
  const zone = props.host;
  if (!zone || event.button !== 0) return;
  event.preventDefault();
  const bar = event.currentTarget as HTMLElement;
  bar.setPointerCapture(event.pointerId);
  const rect = zone.getBoundingClientRect();
  let editorWidth = width.value;
  const move = (moveEvent: PointerEvent) => {
    editorWidth = clampWidth((moveEvent.clientX - rect.left) / rect.width);
    zone.style.setProperty("--editor", `${editorWidth * 100}%`);
  };
  const up = () => {
    bar.removeEventListener("pointermove", move);
    bar.removeEventListener("pointerup", up);
    bar.removeEventListener("pointercancel", up);
    delete zone.dataset.resizing;
    width.value = editorWidth;
  };
  zone.dataset.resizing = "";
  bar.addEventListener("pointermove", move);
  bar.addEventListener("pointerup", up);
  bar.addEventListener("pointercancel", up);
}

function key(event: KeyboardEvent) {
  const step = event.key === "ArrowLeft" ? -0.02 : event.key === "ArrowRight" ? 0.02 : 0;
  if (!step) return;
  event.preventDefault();
  width.value = clampWidth(width.value + step);
}
</script>

<template>
  <div
    class="absolute z-2 inset-y-0 left-(--editor-width) w-[9px] -translate-x-[5px] cursor-col-resize touch-none outline-none narrow:hidden print:hidden after:absolute after:inset-y-0 after:left-[3px] after:w-[3px] after:transition-colors hover:after:bg-accent focus-visible:after:bg-accent group-data-resizing/split:after:bg-accent"
    role="separator"
    aria-orientation="vertical"
    aria-label="Largeur de l'éditeur"
    :aria-valuenow="Math.round(width * 100)"
    :aria-valuemin="20"
    :aria-valuemax="80"
    tabindex="0"
    title="Tirer pour régler la largeur de l'éditeur (double-clic : largeur par défaut)"
    @pointerdown="drag"
    @keydown="key"
    @dblclick="width = EDITOR_WIDTH"
  />
</template>
