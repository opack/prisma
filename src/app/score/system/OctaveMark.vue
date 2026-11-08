<script setup lang="ts">
/**
 * Numéro d'octave : « 0 » pour l'octave du do central, sinon une flèche dessinée (vers le haut pour
 * les octaves aiguës) suivie de l'écart ; ou, selon l'option, un signe (+1, −1) ou un triangle.
 * La flèche est tracée plutôt que prise dans la police, pour avoir la même épaisseur partout.
 */
import { computed } from "vue";
import type { OctaveStyle } from "../../options/options.ts";
import { TAB_TEXT } from "../drawing.ts";

const { cx, cy, offset, markStyle } = defineProps<{ cx: number; cy: number; offset: number; markStyle: OctaveStyle }>();

const up = computed(() => offset > 0);
// flèche ou triangle à gauche, chiffre à droite
const arrowX = computed(() => cx - 0.95);
const triangle = computed(() => {
  const half = 0.95;
  const base = up.value ? cy + half : cy - half;
  const tip = up.value ? cy - half : cy + half;
  return `M ${arrowX.value - 0.95} ${base} L ${arrowX.value + 0.95} ${base} L ${arrowX.value} ${tip} Z`;
});
const arrow = computed(() => {
  const half = 1.25; // demi-hauteur de la flèche
  const tip = up.value ? cy - half : cy + half;
  const tail = up.value ? cy + half : cy - half;
  const head = up.value ? 0.85 : -0.85;
  const x = arrowX.value;
  return `M ${x} ${tail} L ${x} ${tip} M ${x - 0.75} ${tip + head} L ${x} ${tip} L ${x + 0.75} ${tip + head}`;
});
</script>

<template>
  <!-- vrai signe moins (−), plus lisible que le trait d'union -->
  <text
    v-if="offset !== 0 && markStyle === 'sign'"
    :x="cx"
    :y="cy + 0.95"
    font-size="2.7"
    font-weight="600"
    text-anchor="middle"
    :fill="TAB_TEXT"
  >
    {{ (offset > 0 ? "+" : "−") + Math.abs(offset) }}
  </text>
  <g v-else-if="offset !== 0 && markStyle === 'triangle'">
    <path :d="triangle" :fill="TAB_TEXT" />
    <text :x="cx + 0.35" :y="cy + 0.95" font-size="2.7" font-weight="600" :fill="TAB_TEXT">{{ Math.abs(offset) }}</text>
  </g>
  <text v-else-if="offset === 0" :x="cx" :y="cy + 0.95" font-size="2.7" font-weight="600" text-anchor="middle" :fill="TAB_TEXT">0</text>
  <g v-else>
    <path :d="arrow" fill="none" :stroke="TAB_TEXT" stroke-width="0.42" stroke-linecap="round" stroke-linejoin="round" />
    <text :x="cx + 0.35" :y="cy + 0.95" font-size="2.7" font-weight="600" :fill="TAB_TEXT">{{ Math.abs(offset) }}</text>
  </g>
</template>
