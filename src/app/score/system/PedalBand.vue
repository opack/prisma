<script setup lang="ts">
/**
 * La pédale : un trait sous le système, comme sur les partitions modernes. Il commence par un
 * crochet là où la pédale s'enfonce, finit par un crochet là où elle se relâche, et marque d'une
 * pointe chaque changement. Sa longueur montre exactement ce qui est tenu. Les pédales déduites d'un
 * « Ped. simile » sont atténuées ; ses consignes s'écrivent sur la ligne, après un éventuel crochet.
 */
import { computed } from "vue";
import { METRICS, PAGE } from "../engrave.ts";
import type { PlacedSystem } from "../engrave.ts";
import type { PedalLine } from "../../../core/index.ts";
import { GREY, INK, LIGHT } from "../drawing.ts";
import { anchorX, edges } from "./system.ts";

const props = defineProps<{ placed: PlacedSystem; pedal: PedalLine; top: number }>();

/** La hauteur des crochets et des pointes, et la demi-largeur d'une pointe de changement. */
const HOOK = 1.5;
const NOTCH = 0.8;

const y = computed(() => props.top + METRICS.pedalH * 0.7);
const pedalX = (anchor: number) => anchorX(props.placed, anchor) + 0.3;

const paths = computed(() => {
  const { left, right } = edges(props.placed);
  const lineY = y.value;
  const written: string[] = [],
    implied: string[] = [];
  for (const span of props.pedal.spans) {
    const paths = span.implied ? implied : written;
    let x1 = span.fromAnchor >= 0 ? pedalX(span.fromAnchor) : left;
    let x2 = span.toAnchor >= 0 ? pedalX(span.toAnchor) : right;
    if (span.changeStart) {
      // pointe du changement, dessinée une seule fois, par la pédale qui commence
      paths.push(`M ${x1 - NOTCH} ${lineY} L ${x1} ${lineY - HOOK} L ${x1 + NOTCH} ${lineY}`);
      x1 += NOTCH;
    } else if (span.opens) paths.push(`M ${x1} ${lineY - HOOK} L ${x1} ${lineY}`);
    // un changement en fin de système se dessine au début du système suivant
    if (span.changeEnd && span.toAnchor >= 0) x2 -= NOTCH;
    paths.push(`M ${x1} ${lineY} L ${x2} ${lineY}`);
    if (span.closes && !span.changeEnd) paths.push(`M ${x2} ${lineY} L ${x2} ${lineY - HOOK}`);
  }
  return { written: written.join(" "), implied: implied.join(" ") };
});
</script>

<template>
  <g>
    <text :x="PAGE.marginX + METRICS.prefix - 1.2" :y="y" font-size="2.3" :fill="GREY" text-anchor="end" font-style="italic">Ped.</text>
    <path :d="paths.written" fill="none" :stroke="INK" stroke-width="0.3" stroke-linejoin="round" />
    <path v-if="paths.implied" :d="paths.implied" fill="none" :stroke="LIGHT" stroke-width="0.3" stroke-linejoin="round" />
    <text
      v-for="(text, index) in pedal.texts"
      :key="index"
      :x="pedalX(text.anchor) + 0.8"
      :y="y"
      font-size="2.8"
      font-style="italic"
      :fill="INK"
    >
      {{ text.text }}
    </text>
  </g>
</template>
