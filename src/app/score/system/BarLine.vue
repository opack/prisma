<script setup lang="ts">
/**
 * Une barre de mesure, avec ses signes de reprise : « :|| » (points, trait fin, trait épais),
 * « ||: » (trait épais, trait fin, points). Les points sont placés au milieu de chaque portée, et
 * centrés dans la place qui leur est réservée. Entre deux sections à la suite, la fin de l'une, un
 * blanc, puis le début de l'autre.
 */
import { computed } from "vue";
import { METRICS } from "../engrave.ts";
import { spacedWidths } from "../geometry.ts";
import type { BarColumn } from "../geometry.ts";
import { INK } from "../drawing.ts";

const props = defineProps<{
  x: number;
  width: number;
  column: BarColumn;
  top: number;
  bottom: number;
  /** Le haut et le bas des lignes de chaque portée : la place des points de reprise. */
  sections: number[][];
  /** La dernière colonne du système : la barre s'aligne sur le bord droit des couloirs. */
  end: boolean;
}>();

/** Ce qui se dessine, de gauche à droite : un trait (sa place, son épaisseur), ou une colonne de points de reprise. */
type Item = { kind: "stroke"; x: number; width: number } | { kind: "dots"; x: number };

const THIN = 0.22;
const THICK = 0.6;
const stroke = (x: number, width: number): Item => ({ kind: "stroke", x, width });
const dots = (x: number): Item => ({ kind: "dots", x });

const spaced = computed(() => (props.column.spaced ? spacedWidths(props.column, props.x, props.width) : undefined));

const items = computed((): Item[] => {
  const { x, width, column, end } = props;
  // les points sont centrés dans la place qui leur est réservée
  const dotOffset = METRICS.repeatDots / 2;
  const middle = x + width / 2;
  if (column.lead) return [stroke(x + 0.55, THIN), dots(x + width - dotOffset)];
  if (!column.endRepeat && !column.startRepeat) {
    // fin du morceau : double barre, trait fin puis trait épais
    if (column.final) return [stroke(x + width - 1.1, THIN), stroke(x + width - 0.3, THICK)];
    // début de section : double barre, aussi marquée qu'une barre de mesure (deux traits de même épaisseur)
    if (column.section) {
      const center = end ? x + width - 0.65 : middle;
      return [stroke(center - 0.45, 0.4), stroke(center + 0.45, 0.4)];
    }
    // en fin de système, la barre ferme les couloirs : elle s'aligne sur leur bord droit
    return [stroke(end ? x + width - 0.225 : middle, 0.45)];
  }
  if (column.endRepeat && column.startRepeat)
    return [
      dots(x + dotOffset),
      stroke(middle - 0.75, THIN),
      stroke(middle, THICK),
      stroke(middle + 0.75, THIN),
      dots(x + width - dotOffset),
    ];
  if (column.endRepeat) return [dots(x + dotOffset), stroke(x + width - 1.1, THIN), stroke(x + width - 0.3, THICK)];
  return [stroke(x + 0.45, THICK), stroke(x + 1.25, THIN), dots(x + width - dotOffset)];
});
/** Une barre de mesure simple : un trait seul. */
const single = computed(() => items.value.length === 1);
</script>

<template>
  <g v-if="spaced">
    <BarLine
      :x="x"
      :width="spaced.close"
      :column="{ kind: 'barSep', endRepeat: column.endRepeat, section: !column.endRepeat }"
      :top="top"
      :bottom="bottom"
      :sections="sections"
      end
    />
    <line :x1="spaced.gap[1]" :x2="spaced.gap[1]" :y1="top" :y2="bottom" :stroke="INK" stroke-width="0.45" />
    <BarLine
      v-if="spaced.open > 0"
      :x="spaced.gap[1]"
      :width="spaced.open"
      :column="{ kind: 'barSep', lead: true }"
      :top="top"
      :bottom="bottom"
      :sections="sections"
      end
    />
  </g>
  <line
    v-else-if="single"
    :x1="items[0].x"
    :x2="items[0].x"
    :y1="top"
    :y2="bottom"
    :stroke="INK"
    :stroke-width="items[0].kind === 'stroke' ? items[0].width : undefined"
  />
  <g v-else>
    <template v-for="(item, index) in items" :key="index">
      <line v-if="item.kind === 'stroke'" :x1="item.x" :x2="item.x" :y1="top" :y2="bottom" :stroke="INK" :stroke-width="item.width" />
      <template v-else>
        <g v-for="([from, to], section) in sections" :key="section">
          <circle :cx="item.x" :cy="(from + to) / 2 - 0.95" r="0.38" :fill="INK" />
          <circle :cx="item.x" :cy="(from + to) / 2 + 0.95" r="0.38" :fill="INK" />
        </g>
      </template>
    </template>
  </g>
</template>
