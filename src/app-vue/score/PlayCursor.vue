<script setup lang="ts">
/**
 * Le curseur de lecture sur la page : la case jouée. La partition suit le curseur et montre d'avance
 * la mesure suivante, quand l'écran le permet ; dans la dernière mesure d'un système (lookAhead), la
 * page glisse pour que le système joué ensuite soit en vue à mi-mesure.
 */
import { computed, useTemplateRef, watch } from "vue";
import type { Page } from "../../app/score/engrave.ts";
import { PAGE } from "../../app/score/engrave.ts";
import { barsIn, columnAt } from "../../app/score/geometry.ts";
import { glide } from "../../app/score/glide.ts";
import { player } from "../../app/playback/player.ts";
import { useFollowing, usePlayer } from "../playback/state.ts";
import CursorRect from "./CursorRect.vue";

const { page, lookAhead } = defineProps<{ page: Page; lookAhead: boolean }>();

const playerState = usePlayer();
const following = useFollowing(true);
const cursor = useTemplateRef<InstanceType<typeof CursorRect>>("cursor");

const tick = computed(() => playerState.value.tick);
const current = computed(() =>
  tick.value === null ? -1 : page.systems.findIndex((placed) => tick.value! >= placed.sys.start && tick.value! < placed.sys.end),
);
// la case jouée
const column = computed(() => (current.value >= 0 ? columnAt(page.systems[current.value], tick.value!) : -1));

/**
 * La place d'un système à l'écran, en entier (textes au-dessus de la règle, pédale en dessous) et
 * non sa seule bande jouée : d'après la zone de clic du système, qui la porte.
 */
function extent(area: SVGRectElement) {
  const svg = area.ownerSVGElement!,
    pageBox = svg.getBoundingClientRect(),
    unit = pageBox.width / svg.viewBox.baseVal.width;
  const rect = area.getBoundingClientRect();
  return {
    left: rect.left,
    right: rect.right,
    top: pageBox.top + Number(area.dataset.top) * unit,
    bottom: pageBox.top + Number(area.dataset.bottom) * unit,
  };
}

// la descente vers le système suivant, une par système
let ahead = "";

watch(
  [current, column, following, () => lookAhead],
  () => {
    const element = cursor.value?.$el as SVGRectElement | undefined,
      pane = element?.closest<HTMLElement>("[data-fit]");
    if (!following.value) ahead = "";
    if (!element || !pane || !following.value) return;
    const glider = glide(pane);
    const view = pane.getBoundingClientRect();
    const box = element.getBoundingClientRect();
    const svg = element.ownerSVGElement!;
    const pageBox = svg.getBoundingClientRect();
    const unit = pageBox.width / PAGE.w; // une unité de la page, à l'écran
    const margin = 16; // la marge gardée au bord de l'écran
    const placed = page.systems[current.value];
    const bars = barsIn(placed);
    const barIndex = Math.max(
      0,
      bars.findIndex((bar) => bar.includes(column.value)),
    );
    const left = (bar: number[]) => pageBox.left + placed.xs[bar[0]] * unit;
    const right = (bar: number[]) => pageBox.left + (placed.xs[bar[bar.length - 1]] + placed.ws[bar[bar.length - 1]]) * unit;
    // en coordonnées du contenu, qui ne bougent pas pendant un défilement en cours
    const x = (value: number) => value - view.left + pane.scrollLeft;
    const y = (value: number) => value - view.top + pane.scrollTop;
    // de côté. Pages côte à côte (ajustées à la hauteur) : la page jouée vient à gauche si elle
    // tient dans l'écran, les suivantes se lisent d'avance. Une ligne plus large que l'écran
    // (zoom) : quand la mesure suivante n'est pas en vue, la mesure jouée vient au bord gauche,
    // la suivante à sa droite ; si les deux n'y tiennent pas, la case jouée revient au premier
    // quart avant d'approcher du bord
    const pad = parseFloat(getComputedStyle(pane).scrollPaddingLeft || "0");
    if (pane.dataset.fit === "height" && pageBox.width <= view.width - pad) glider.to("left", x(pageBox.left) - pad);
    else {
      const start = left(bars[barIndex]),
        end = right(bars[Math.min(barIndex + 1, bars.length - 1)]);
      if (box.left < view.left || end > view.right - margin) {
        if (end - start <= view.width - 2 * margin) glider.to("left", x(start) - margin);
        else if (box.left < view.left || box.right > view.right - view.width * 0.15) glider.to("left", x(box.left) - view.width / 4);
      }
    }
    // de haut en bas. Un système hors de l'écran y revient, en haut. Dans la dernière mesure
    // d'un système (option), la page glisse d'un seul mouvement, au rythme de la musique, pour
    // que le système joué ensuite (le suivant, ou celui où ramène une reprise) soit en vue à
    // mi-mesure, sauf s'il est sur la page d'à côté ; le système joué reste en vue, quitte à ne
    // montrer qu'un bout de l'autre. Un système compte en entier : ses textes, sa pédale
    const key = `${page.index}:${current.value}`;
    if (box.top < view.top || box.bottom > view.bottom) glider.to("top", y(box.top) - margin);
    else if (lookAhead && barIndex === bars.length - 1 && ahead !== key) {
      ahead = key;
      const then = player.upcoming(placed.sys.end);
      const area =
        then === null
          ? undefined
          : [...pane.querySelectorAll<SVGRectElement>("rect.system-area")].find(
              (candidate) => then >= Number(candidate.dataset.start) && then < Number(candidate.dataset.end),
            );
      const next = area && extent(area);
      const here = extent(svg.querySelectorAll<SVGRectElement>("rect.system-area")[current.value]);
      if (next && next.left < pageBox.right && next.right > pageBox.left) {
        const below = next.top >= here.bottom - 1,
          above = next.bottom <= here.top + 1;
        const goal = below
          ? Math.min(y(next.bottom) - (view.height - margin), y(here.top) - margin)
          : above
            ? Math.max(y(next.top) - margin, y(here.bottom) - (view.height - margin))
            : pane.scrollTop;
        if ((below && goal > pane.scrollTop + 1) || (above && goal < pane.scrollTop - 1)) {
          // d'ici au milieu de la mesure, en durée de musique (le tempo, les points d'orgue compris)
          const from = player.position() ?? tick.value!,
            mid = (from + placed.sys.end) / 2;
          const bar0 = (placed.sys.columns[bars[barIndex][0]] as { t: number }).t,
            half = (bar0 + placed.sys.end) / 2;
          const until = Math.max(mid, half);
          glider.to("top", goal, () => {
            const now = player.position();
            return now === null || now < from ? 1 : (now - from) / (until - from);
          });
        }
      }
    }
  },
  { flush: "post" },
);
</script>

<template>
  <CursorRect v-if="current >= 0" ref="cursor" :system="page.systems[current]" :column="column" />
</template>
