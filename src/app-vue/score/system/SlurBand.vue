<script setup lang="ts">
/**
 * Les liaisons d'une portée : un arc fin, creux vers le haut comme une liaison sous les notes, de la
 * première note à la dernière ; une liaison coupée reste ouverte au bord du système. Sur une corde,
 * deux notes liées l'une après l'autre : un hammer-on (H) si la seconde est plus haute sur la corde,
 * un pull-off (P) si elle est plus basse ; la lettre sous la liaison, entre elles.
 */
import { computed } from "vue";
import { METRICS, leadExtra, slurH } from "../../../app/score/engrave.ts";
import type { PlacedSystem } from "../../../app/score/engrave.ts";
import type { SystemRow, Voice } from "../../../core/index.ts";
import { INK } from "../drawing.ts";
import { edges } from "./system.ts";

const props = defineProps<{ placed: PlacedSystem; voice: Voice; rows: SystemRow[]; top: number }>();

const noteX = (anchor: number) => {
  const { sys, xs } = props.placed;
  return xs[sys.anchors[anchor]] + leadExtra(sys, anchor) + 1.4;
};
const fretOf = (cell: string) => (cell && !cell.startsWith("-") ? Number(cell.match(/\d+/)?.[0] ?? NaN) : NaN);

const letters = computed(() => {
  const { placed, voice, rows } = props;
  const letters: { x: number; text: string }[] = [];
  for (const slur of voice.slurs) {
    for (const row of rows.filter((candidate) => candidate.string !== undefined)) {
      let previous: { anchor: number; fret: number } | undefined;
      const last = slur.closes ? slur.toAnchor : placed.sys.anchors.length - 1;
      for (let anchor = slur.opens ? slur.fromAnchor : 0; anchor <= last; anchor++) {
        const fret = fretOf(row.cells[anchor] ?? "");
        if (Number.isNaN(fret)) continue;
        if (previous && fret !== previous.fret)
          letters.push({ x: (noteX(previous.anchor) + noteX(anchor)) / 2, text: fret > previous.fret ? "H" : "P" });
        previous = { anchor, fret };
      }
    }
  }
  return letters;
});
const letterY = computed(() => props.top + slurH(props.voice) + 1.5);

const arcs = computed(() => {
  const { left, right } = edges(props.placed);
  return props.voice.slurs.map((slur) => {
    const x1 = slur.opens ? noteX(slur.fromAnchor) : left;
    const x2 = slur.closes ? noteX(slur.toAnchor) : right;
    const y = props.top + 0.5 + slur.level * METRICS.slurLevel;
    const depth = Math.min(1.1, 0.45 + (x2 - x1) * 0.02); // creux, un peu plus marqué pour une longue liaison
    const middle = (x1 + x2) / 2;
    return `M ${x1} ${y} Q ${middle} ${y + 2 * depth} ${x2} ${y} Q ${middle} ${y + 2 * depth - 0.7} ${x1} ${y} Z`;
  });
});
</script>

<template>
  <g>
    <text
      v-for="(letter, index) in letters"
      :key="'hp' + index"
      :x="letter.x"
      :y="letterY"
      font-size="2.7"
      font-weight="700"
      text-anchor="middle"
      :fill="INK"
    >
      {{ letter.text }}
    </text>
    <path v-for="(arc, index) in arcs" :key="index" :d="arc" :fill="INK" />
  </g>
</template>
