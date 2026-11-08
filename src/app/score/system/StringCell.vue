<script setup lang="ts">
/**
 * Une case de corde qui porte une technique : la case (ou « x », « <12> »), ses articulations,
 * puis le glissé ou le bend dessinés, et le doigt. Un glissé est un trait penché, montant vers
 * l'aigu, descendant vers le grave ; en tirets quand il vient de rien ou y va, plein quand il va
 * vers la note suivante de la corde. Un bend, comme en tablature : une flèche qui part de la case et
 * monte au-dessus des cordes, l'écart au-dessus de sa pointe ; relâché, une flèche qui redescend.
 */
import { computed } from "vue";
import { FINGER, METRICS, SLIDE_W, bendLabel, bendStart } from "../engrave.ts";
import type { PlacedSystem } from "../engrave.ts";
import type { Direction, StringCell, SystemRow } from "../../../core/index.ts";
import { INK } from "../drawing.ts";
import Articulations from "./Articulations.vue";
import FingerBadge from "./FingerBadge.vue";

const props = defineProps<{
  placed: PlacedSystem;
  row: SystemRow;
  anchor: number;
  technique: StringCell;
  /** Le début de la note dans sa case, le haut de sa ligne, la ligne de ses chiffres, et le milieu de la ligne. */
  x: number;
  top: number;
  baseline: number;
  middle: number;
  articulations: string[];
  /** Le haut de la bande du médiator et des bends, au-dessus des cordes. */
  techTop: number;
}>();

const drawing = computed(() => {
  const { placed, row, anchor, technique, x, top, baseline, middle, techTop } = props;
  const slide = (from: number, direction: Direction, toNothing: boolean) => {
    const [y1, y2] = direction === "up" ? [baseline - 0.2, top + 1.1] : [top + 1.1, baseline - 0.2];
    return { x1: from + 0.3, x2: from + 2.4, y1, y2, dashes: toNothing ? "0.6 0.45" : undefined };
  };
  const slideIn = technique.slideIn ? slide(x + 0.1, technique.slideIn, true) : undefined;
  const labelX = x + 0.5 + (technique.slideIn ? SLIDE_W : 0);
  const labelEnd = labelX + technique.label.length * METRICS.noteDigit * (technique.harmonic ? 0.8 : 1);
  let end = labelEnd;
  const after = technique.slide ?? technique.slideOut;
  const slideOut = after ? slide(end, after, !technique.slide) : undefined;
  if (after) end += SLIDE_W;
  let bend;
  if (technique.bend !== undefined) {
    // la flèche part après la case la plus large de la colonne : elle ne coupe aucun chiffre
    const start = x + bendStart(placed.sys.staves[row.staff].rows, anchor),
      tipX = start + 2.2,
      tipY = techTop + 3.2,
      releaseX = tipX + 2.6;
    const rise = `M ${Math.min(end + 0.2, start)} ${middle} L ${start} ${middle} Q ${tipX} ${middle} ${tipX} ${tipY + 0.9}`;
    const fall = `M ${tipX + 0.3} ${tipY + 0.4} Q ${releaseX} ${tipY + 0.4} ${releaseX} ${middle - 1.1}`;
    const head = (headX: number, headY: number, direction: 1 | -1) =>
      `M ${headX - 0.6} ${headY + direction * 1} L ${headX} ${headY} L ${headX + 0.6} ${headY + direction * 1} Z`;
    bend = {
      halo: rise + (technique.release ? " " + fall : ""),
      rise,
      riseHead: head(tipX, tipY, 1),
      labelX: tipX - 0.7,
      labelY: techTop + 2.4,
      label: bendLabel(technique.bend - technique.fret),
      fall: technique.release ? fall : undefined,
      fallHead: head(releaseX, middle - 0.4, -1),
    };
    end = (technique.release ? releaseX : tipX) + 0.8;
  }
  return { slideIn, slideOut, bend, labelX, articulationX: labelX + (labelEnd - labelX) / 2 - 0.15, fingerX: end + FINGER.gap + FINGER.r };
});
</script>

<template>
  <g>
    <text :x="drawing.labelX" :y="baseline" :font-size="technique.harmonic ? 2.8 : 3.3" font-weight="600" :fill="INK">{{
      technique.label
    }}</text>
    <Articulations :signs="articulations" :cx="drawing.articulationX" :cy="top - 0.05" />
    <line
      v-for="(line, index) in [drawing.slideIn, drawing.slideOut].filter((slide) => !!slide)"
      :key="index"
      :x1="line.x1"
      :x2="line.x2"
      :y1="line.y1"
      :y2="line.y2"
      :stroke="INK"
      stroke-width="0.4"
      stroke-linecap="round"
      :stroke-dasharray="line.dashes"
    />
    <g v-if="drawing.bend">
      <!-- un liseré blanc : la flèche reste lisible là où elle croise une corde -->
      <path :d="drawing.bend.halo" fill="none" stroke="#fff" stroke-width="1" />
      <path :d="drawing.bend.rise" fill="none" :stroke="INK" stroke-width="0.32" />
      <path :d="drawing.bend.riseHead" :fill="INK" />
      <!-- l'écart, à partir de la pointe : il laisse la place au médiator, au-dessus de la case -->
      <text :x="drawing.bend.labelX" :y="drawing.bend.labelY" font-size="2.6" font-weight="700" :fill="INK">{{ drawing.bend.label }}</text>
      <g v-if="drawing.bend.fall">
        <path :d="drawing.bend.fall" fill="none" :stroke="INK" stroke-width="0.32" />
        <path :d="drawing.bend.fallHead" :fill="INK" />
      </g>
    </g>
    <FingerBadge v-if="technique.finger" :x="drawing.fingerX" :baseline="baseline" :finger="technique.finger" />
  </g>
</template>
