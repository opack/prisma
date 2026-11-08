<script setup lang="ts">
/**
 * Lecture focalisée : deux systèmes à l'écran, toujours aux mêmes places. On joue celui du haut,
 * puis celui du bas ; à l'avant-dernière mesure de l'un, l'autre place reçoit le système joué
 * ensuite (selon l'ordre de jeu et les reprises). Le regard ne quitte jamais ces deux places : ni
 * page à tourner, ni défilement.
 */
import { computed, ref, watch } from "vue";
import type { RenderOptions } from "../options/options.ts";
import { PAGE } from "./engrave.ts";
import type { Page, PlacedSystem } from "./engrave.ts";
import { barsIn, columnAt } from "./geometry.ts";
import { player } from "../playback/player.ts";
import { usePlayer } from "../playback/state.ts";
import CursorRect from "./CursorRect.vue";
import { FONT } from "./drawing.ts";
import OrderLine from "./OrderLine.vue";
import SeekAreas from "./SeekAreas.vue";
import SystemView from "./system/SystemView.vue";
import TextMarks from "./TextMarks.vue";

type Slots = [number, number];

const { pages, options } = defineProps<{ pages: Page[]; options: RenderOptions }>();

const systems = computed(() => pages.flatMap((page) => page.systems));
const playerState = usePlayer();
const tick = computed(() => playerState.value.tick);
const at = (moment: number | null) =>
  moment === null ? -1 : systems.value.findIndex((placed) => moment >= placed.sys.start && moment < placed.sys.end);
const playing = computed(() => at(tick.value));
const column = computed(() => (playing.value >= 0 ? columnAt(systems.value[playing.value], tick.value!) : -1));
// l'autre système joué après celui-ci : la suite, le retour d'une reprise, la section suivante ;
// une reprise ou une section rejouée sur place (« A A B ») ne compte pas, la place resterait en double
const after = (index: number) => {
  const then = player.elsewhere(systems.value[index].sys.start, systems.value[index].sys.end);
  return then === null ? -1 : at(then);
};
const start = (): Slots => [0, systems.value.length > 1 ? 1 : -1];
const slots = ref<Slots>(start());
// un autre morceau, ou une autre mise en page : on repart du début
watch(systems, () => (slots.value = start()));

watch([tick, playing, column, systems], () => {
  // à l'arrêt, le début du morceau
  if (tick.value === null) {
    const initial = start();
    if (initial[0] !== slots.value[0] || initial[1] !== slots.value[1]) slots.value = initial;
    return;
  }
  if (playing.value < 0) return;
  const here = slots.value.indexOf(playing.value);
  // un saut ailleurs (un clic, une section) : le système joué en haut, le suivant dessous
  if (here < 0) return (slots.value = [playing.value, after(playing.value)]);
  // à l'avant-dernière mesure, l'autre place reçoit la suite (rien à faire si elle y est déjà)
  const bars = barsIn(systems.value[playing.value]);
  const barIndex = bars.findIndex((bar) => bar.includes(column.value));
  if (barIndex < bars.length - 2) return;
  const next = after(playing.value);
  if (next >= 0 && slots.value[1 - here] !== next) slots.value = here ? [next, slots.value[1]] : [slots.value[0], next];
});

// une même échelle pour les deux places : la largeur des systèmes, la hauteur du plus haut
const frame = computed(() => {
  const pad = 2;
  const first = systems.value[0];
  if (!first) return null;
  const named = first.parts.filter((part) => part.name).map((part) => [...part.name!].length * 1.45 + 2.6);
  const braced = first.parts.some((part) => part.last > part.first) ? 1.8 : 0;
  const x0 = PAGE.marginX - pad - Math.max(braced, ...named);
  const x1 = Math.max(...systems.value.map((placed) => placed.xs[placed.xs.length - 1] + placed.ws[placed.ws.length - 1])) + pad;
  const height = Math.max(...systems.value.map((placed) => placed.height)) + 2 * pad;
  return { x0, width: x1 - x0, height, pad };
});
const order = computed(() => pages[0]?.order ?? []);
const top = (placed: PlacedSystem) => placed.y - frame.value!.pad - (frame.value!.height - 2 * frame.value!.pad - placed.height) / 2;
// la place qu'on ne joue pas : le système à venir, à peine atténué, ou celui qu'on vient de jouer, effacé
const role = (index: number) =>
  playing.value < 0 || index === playing.value ? "" : index === after(playing.value) ? "opacity-80" : "opacity-35";
</script>

<template>
  <div
    v-if="frame"
    :class="[
      'print:hidden! grid flex-1 self-stretch gap-3 w-full min-h-0',
      order.length ? 'grid-rows-[auto_1fr_1fr]' : 'grid-rows-[1fr_1fr]',
    ]"
  >
    <!-- l'ordre de jeu, comme en tête de page : la section jouée entourée, un clic pour y aller -->
    <svg v-if="order.length > 0" class="block w-full h-auto max-h-[48px]" :viewBox="`${frame.x0} 0 ${frame.width} 6.6`" :font-family="FONT">
      <OrderLine :order="order" :y="1.6" :cx="frame.x0 + frame.width / 2" live />
    </svg>
    <div
      v-for="(index, place) in slots"
      :key="`${place}:${index}`"
      :class="[
        'min-h-0 bg-white shadow-[0_1px_3px_rgba(0,0,0,.18),0_6px_18px_rgba(0,0,0,.08)] [transition:opacity_.3s] animate-focus-in [&_svg]:block [&_svg]:w-full [&_svg]:h-full',
        role(index),
      ]"
    >
      <!-- centré dans sa place : la place a la hauteur du plus haut système -->
      <svg
        v-if="systems[index]"
        :viewBox="`${frame.x0} ${top(systems[index])} ${frame.width} ${frame.height}`"
        preserveAspectRatio="xMidYMid meet"
        :font-family="FONT"
        style="font-variant-numeric: tabular-nums"
      >
        <rect :x="frame.x0" :y="top(systems[index])" :width="frame.width" :height="frame.height" fill="#fff" />
        <SystemView :system="systems[index]" :options="options" :names="index === 0 || options.namesEverySystem" />
        <TextMarks :systems="[systems[index]]" />
        <SeekAreas :systems="[systems[index]]" />
        <CursorRect v-if="index === playing" :system="systems[index]" :column="column" />
      </svg>
    </div>
  </div>
</template>
