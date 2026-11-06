<script setup lang="ts">
/**
 * Une grille d'accord : les cordes debout (la plus grave à gauche), les cases en travers, un point
 * par doigt, un trait pour un barré ; au-dessus, « × » pour une corde qu'on ne joue pas, « o » à
 * vide. Une forme haute commence à sa première case, numérotée à droite ; sinon le sillet, épais.
 */
import { computed } from "vue";
import { METRICS } from "../../../app/score/engrave.ts";
import { barreOf } from "../../../core/index.ts";
import type { Shape } from "../../../core/index.ts";
import { INK } from "../drawing.ts";

const { shape, x, y } = defineProps<{ shape: Shape; x: number; y: number }>();

const stringGap = METRICS.gridString;
const fretGap = METRICS.gridFret;
const frets = METRICS.gridFrets;

const start = computed(() => {
  const pressed = shape.filter((fret): fret is number => !!fret);
  const high = pressed.length ? Math.max(...pressed) : 0;
  return high <= frets ? 1 : Math.min(...pressed);
});
const top = computed(() => y + METRICS.gridMarks);
const right = computed(() => x + (shape.length - 1) * stringGap);
const bottom = computed(() => top.value + frets * fretGap);
const barre = computed(() => barreOf(shape));
const stringX = (string: number) => x + string * stringGap;
const fretMiddle = (fret: number) => top.value + (fret - start.value + 0.5) * fretGap;
/** Un doigt posé, hors du barré qui le couvre. */
const dotted = (fret: number, string: number) => !(barre.value && fret === barre.value.fret && string >= barre.value.from);
</script>

<template>
  <g>
    <line
      v-for="(_, string) in shape"
      :key="'s' + string"
      :x1="stringX(string)"
      :x2="stringX(string)"
      :y1="top"
      :y2="bottom"
      :stroke="INK"
      stroke-width="0.15"
    />
    <line
      v-for="fretLine in frets + 1"
      :key="'f' + fretLine"
      :x1="x"
      :x2="right"
      :y1="top + (fretLine - 1) * fretGap"
      :y2="top + (fretLine - 1) * fretGap"
      :stroke="INK"
      :stroke-width="fretLine === 1 && start === 1 ? 0.6 : 0.15"
    />
    <text v-if="start > 1" :x="right + 0.7" :y="fretMiddle(start) + 0.75" font-size="2.1" :fill="INK">{{ start }}</text>
    <template v-for="(fret, string) in shape" :key="string">
      <text v-if="fret === null" :x="stringX(string)" :y="top - 0.45" font-size="1.7" text-anchor="middle" :fill="INK">×</text>
      <circle v-else-if="fret === 0" :cx="stringX(string)" :cy="top - 0.85" r="0.42" fill="none" :stroke="INK" stroke-width="0.15" />
      <circle v-else-if="dotted(fret, string)" :cx="stringX(string)" :cy="fretMiddle(fret)" r="0.52" :fill="INK" />
    </template>
    <rect
      v-if="barre"
      :x="stringX(barre.from) - 0.52"
      :y="fretMiddle(barre.fret) - 0.52"
      :width="stringX(barre.to) - stringX(barre.from) + 1.04"
      height="1.04"
      rx="0.52"
      :fill="INK"
    />
  </g>
</template>
