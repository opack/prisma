<script setup lang="ts">
/**
 * Les bandes au-dessus de la règle, de haut en bas : les textes (rit., a tempo…), puis les débuts de
 * section (leur lettre contre la barre qui les ouvre), les points d'orgue et les « 3× ».
 */
import { computed } from "vue";
import { METRICS, leadExtra } from "../../../app/score/engrave.ts";
import type { PlacedSystem } from "../../../app/score/engrave.ts";
import { spacedWidths } from "../../../app/score/geometry.ts";
import type { BarColumn } from "../../../app/score/geometry.ts";
import { INK } from "../drawing.ts";
import SectionBox from "../SectionBox.vue";
import { anchorEnd, anchorX, edges } from "./system.ts";

const props = defineProps<{ placed: PlacedSystem }>();

const marksOf = (kind: string) => props.placed.sys.marks.filter((mark) => mark.kind === kind);
const textY = computed(() => props.placed.y + METRICS.markH * 0.72);
/** Le haut de la bande de structure. */
const top = computed(() => props.placed.y + props.placed.textBand + 0.35);

/** La lettre d'une section : en cours de ligne, contre la barre qui l'ouvre (après le blanc, s'il y en a un). */
const markerX = (column: number) => {
  const { sys, xs, ws } = props.placed;
  if (column < 0) return edges(props.placed).left + 0.6;
  const bar = sys.columns[column] as BarColumn;
  return (bar.spaced ? spacedWidths(bar, xs[column], ws[column]).gap[1] : xs[column] + ws[column] / 2) + 0.6;
};
/** Un point d'orgue : un arc aplati ouvert vers le bas, son point dessous, au-dessus de la note. */
const fermata = (anchor: number) => {
  const cx = anchorX(props.placed, anchor) + leadExtra(props.placed.sys, anchor) + 1.4;
  const base = top.value + 2.5;
  return { arc: `M ${cx - 1.8} ${base} A 1.8 1.25 0 0 1 ${cx + 1.8} ${base}`, cx, cy: base - 0.35 };
};
</script>

<template>
  <g>
    <text
      v-for="(mark, index) in marksOf('text')"
      :key="'t' + index"
      :x="anchorX(placed, mark.anchor!) + 0.5"
      :y="textY"
      font-size="2.9"
      font-style="italic"
      :fill="INK"
    >
      {{ mark.text }}
    </text>
    <SectionBox v-for="(mark, index) in marksOf('marker')" :key="'r' + index" :x="markerX(mark.column!)" :y="top" :label="mark.label!" />
    <g v-for="(mark, index) in marksOf('fermata')" :key="'f' + index">
      <path :d="fermata(mark.anchor!).arc" fill="none" :stroke="INK" stroke-width="0.4" />
      <circle :cx="fermata(mark.anchor!).cx" :cy="fermata(mark.anchor!).cy" r="0.38" :fill="INK" />
    </g>
    <text
      v-for="(mark, index) in marksOf('times')"
      :key="'x' + index"
      :x="anchorEnd(placed, mark.anchor!) - 0.4"
      :y="top + 2.55"
      font-size="2.6"
      font-weight="700"
      text-anchor="end"
      :fill="INK"
    >
      {{ mark.text }}
    </text>
  </g>
</template>
