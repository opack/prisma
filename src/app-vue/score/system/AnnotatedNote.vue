<script setup lang="ts">
/**
 * Une note annotée : son articulation au-dessus d'elle, la voisine de sa trille en petit (en haut à
 * droite) suivie d'un trait ondulé jusqu'au bout de sa case, et son doigt en négatif (en bas à droite).
 */
import { computed } from "vue";
import { FINGER, METRICS, splitNote } from "../../../app/score/engrave.ts";
import { trillPath } from "../../../app/score/geometry.ts";
import { GRACE, INK, WAVE } from "../drawing.ts";
import Articulations from "./Articulations.vue";
import FingerBadge from "./FingerBadge.vue";

const props = defineProps<{
  cell: string;
  /** Le début de la note et la fin de sa case, le haut de sa ligne, la ligne de ses chiffres, et le milieu de la ligne. */
  x: number;
  cellEnd: number;
  top: number;
  baseline: number;
  middle: number;
  articulations: string[];
}>();

const drawing = computed(() => {
  const { cell, x } = props;
  const { main, aux, finger } = splitNote(cell);
  let end = x + 0.5 + main.length * METRICS.noteDigit;
  const auxX = end + 0.35;
  if (aux) end = auxX + aux.length * 1.25;
  const fingerX = end + FINGER.gap + FINGER.r;
  if (finger) end = fingerX + FINGER.r;
  return {
    main,
    aux,
    finger,
    auxX,
    fingerX,
    // au-dessus des chiffres, à cheval sur le haut de la ligne : assez d'air pour rester lisible
    articulationX: x + 0.5 + (main.length * METRICS.noteDigit) / 2 - 0.15,
    wave: aux && end + 0.3 < props.cellEnd ? trillPath(end + 0.3, props.cellEnd, props.middle) : undefined,
  };
});
</script>

<template>
  <g>
    <text :x="x + 0.5" :y="baseline" font-size="3.3" font-weight="600" :fill="INK">{{ drawing.main }}</text>
    <Articulations :signs="articulations" :cx="drawing.articulationX" :cy="top - 0.05" />
    <text v-if="drawing.aux" :x="drawing.auxX" :y="baseline - 1.05" font-size="2.3" font-weight="600" :fill="GRACE">{{ drawing.aux }}</text>
    <FingerBadge v-if="drawing.finger" :x="drawing.fingerX" :baseline="baseline" :finger="drawing.finger" />
    <path v-if="drawing.wave" :d="drawing.wave" v-bind="WAVE" />
  </g>
</template>
