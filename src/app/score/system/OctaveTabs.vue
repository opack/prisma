<script setup lang="ts">
/**
 * Les onglets d'une portée, à gauche des couloirs : un onglet pâle par groupe d'octave, son numéro
 * en haut ou au centre (option) ; sur un instrument à cordes, un par corde, son numéro puis le nom
 * de la note à vide.
 */
import { computed } from "vue";
import { METRICS, PAGE } from "../engrave.ts";
import type { OctavePosition, OctaveStyle } from "../../options/options.ts";
import { octaveOffset } from "../../../core/index.ts";
import type { SystemRow } from "../../../core/index.ts";
import { TAB_TEXT } from "../drawing.ts";
import OctaveMark from "./OctaveMark.vue";

const { rows, top, rowHeight } = defineProps<{
  rows: SystemRow[];
  top: number;
  markStyle: OctaveStyle;
  position: OctavePosition;
  rowHeight: number;
  tabFill: (row: SystemRow) => string;
  stringName: (string: number) => string;
}>();

const x = PAGE.marginX + 0.6;
const width = METRICS.prefix - 1.4;

const strings = computed(() => rows.some((row) => row.string !== undefined));
/** Les groupes d'octave : une ligne qui montre son octave en commence un. */
const groups = computed(() => {
  const groups: { row: SystemRow; first: number; count: number }[] = [];
  rows.forEach((row, index) => {
    if (row.showOctave || !groups.length) groups.push({ row, first: index, count: 1 });
    else groups[groups.length - 1].count++;
  });
  return groups.map((group) => ({ ...group, y: top + group.first * rowHeight + 0.25, height: group.count * rowHeight - 0.5 }));
});
</script>

<template>
  <g v-if="strings">
    <g v-for="(row, index) in rows" :key="index">
      <rect :x="x" :y="top + index * rowHeight + 0.25" :width="width" :height="rowHeight - 0.5" rx="0.6" :fill="tabFill(row)" />
      <text
        :x="x + (stringName(row.string!) ? 1.2 : width / 2)"
        :y="top + index * rowHeight + rowHeight / 2 + 0.95"
        font-size="2.7"
        font-weight="600"
        text-anchor="middle"
        :fill="TAB_TEXT"
      >
        {{ row.string }}
      </text>
      <text
        v-if="stringName(row.string!)"
        :x="x + width - 0.4"
        :y="top + index * rowHeight + rowHeight / 2 + 0.7"
        font-size="1.8"
        text-anchor="end"
        :fill="TAB_TEXT"
      >
        {{ stringName(row.string!) }}
      </text>
    </g>
  </g>
  <g v-else>
    <g v-for="group in groups" :key="group.first">
      <rect :x="x" :y="group.y" :width="width" :height="group.height" rx="0.6" :fill="tabFill(group.row)" />
      <OctaveMark
        :cx="x + width / 2"
        :cy="position === 'top' ? top + group.first * rowHeight + rowHeight / 2 : group.y + group.height / 2"
        :offset="octaveOffset(group.row.octave)"
        :mark-style="markStyle"
      />
    </g>
  </g>
</template>
