<script setup lang="ts">
/** Les séparations verticales d'une partie : le trait d'entrée, les temps (fins), les mesures (épaisses) et les reprises. */
import { computed } from "vue";
import type { PlacedSystem } from "../../../app/score/engrave.ts";
import { INK, LIGHT } from "../drawing.ts";
import BarLine from "./BarLine.vue";
import { edges, rowTop } from "./system.ts";

const props = defineProps<{ placed: PlacedSystem; part: PlacedSystem["parts"][number] }>();

const left = computed(() => edges(props.placed).left);
const bottom = computed(() => {
  const last = props.placed.staves[props.part.last];
  return last.voiceTop + last.voiceBand;
});
/** Le haut et le bas des lignes de chaque portée de la partie. */
const sections = computed(() => {
  const { placed, part } = props;
  return placed.sys.staves.flatMap((systemStaff, staff) =>
    staff >= part.first && staff <= part.last && systemStaff.rows.length
      ? [[rowTop(placed, staff, 0), rowTop(placed, staff, systemStaff.rows.length)]]
      : [],
  );
});
</script>

<template>
  <g>
    <line :x1="left" :x2="left" :y1="part.top" :y2="bottom" :stroke="INK" stroke-width="0.45" />
    <template v-for="(column, index) in placed.sys.columns" :key="index">
      <line
        v-if="column.kind === 'beatSep'"
        :x1="placed.xs[index] + placed.ws[index] / 2"
        :x2="placed.xs[index] + placed.ws[index] / 2"
        :y1="part.top"
        :y2="bottom"
        :stroke="LIGHT"
        stroke-width="0.22"
      />
      <BarLine
        v-else-if="column.kind === 'barSep'"
        :x="placed.xs[index]"
        :width="placed.ws[index]"
        :column="column"
        :top="part.top"
        :bottom="bottom"
        :sections="sections"
        :end="index === placed.sys.columns.length - 1"
      />
    </template>
  </g>
</template>
