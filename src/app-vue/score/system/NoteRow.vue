<script setup lang="ts">
/**
 * Une ligne de notes : ses petites notes, puis case par case la note (son numéro), sa tenue (un
 * trait), sa trille (un trait ondulé), ou sur une corde sa technique. Une note commencée au système
 * précédent rappelle, en gris, la note tenue (option).
 */
import { computed } from "vue";
import { METRICS, graceSlotW, leadExtra, techniqueOf } from "../../../app/score/engrave.ts";
import type { PlacedSystem } from "../../../app/score/engrave.ts";
import { trillPath } from "../../../app/score/geometry.ts";
import { FINGER_MARK, TRILL_MARK } from "../../../core/index.ts";
import type { StringCell as StringCellType, SystemRow } from "../../../core/index.ts";
import { GRACE, GREY, INK, WAVE } from "../drawing.ts";
import AnnotatedNote from "./AnnotatedNote.vue";
import StringCell from "./StringCell.vue";

const props = defineProps<{
  placed: PlacedSystem;
  row: SystemRow;
  /** Le haut de la ligne, sur la page. */
  y: number;
  /** Option « notes centrées » : le bloc de notes est centré dans son couloir. */
  centered: boolean;
  articulations: Map<number, string[]>;
  /** Rappeler la note tenue depuis le système précédent (« — 8 »). */
  reminders: boolean;
  techTop: number;
}>();

const baseline = computed(() => props.y + props.placed.rowH * 0.74);
const shift = (anchor: number) => (props.centered ? props.row.center[anchor] * props.placed.rowH : 0);

/** Les petites notes : en petit, en exposant et en gris foncé, en tête de case, rang par rang. */
const graces = computed(() => {
  const { placed, row } = props;
  const { sys, xs } = placed;
  return row.graces.flatMap((list, anchor) => {
    let x = xs[sys.anchors[anchor]] + 0.4;
    return sys.staves[row.staff].graceDigits[anchor].flatMap((digits, slot) => {
      const graceX = x;
      x += graceSlotW(digits);
      return list[slot] ? [{ key: `${anchor}-${slot}`, x: graceX, y: baseline.value + shift(anchor) - 1.05, text: list[slot] }] : [];
    });
  });
});

/** Une case dessinée : sa sorte, et sa place (le début de la note, la fin de sa case, le haut de sa ligne, la ligne de ses chiffres et son milieu). */
type Place = { anchor: number; cell: string; x: number; cellEnd: number; top: number; baseline: number; middle: number };
type DrawnCell = Place &
  (
    | { kind: "trill"; wave: string }
    | { kind: "technique"; technique: StringCellType; articulations: string[] }
    | { kind: "annotated"; articulations: string[] }
    | { kind: "trillReminder"; wave?: string }
    | { kind: "hold" | "holdReminder"; x1: number; x2: number }
    | { kind: "note" }
  );

const cells = computed(() => {
  const { placed, row, y, reminders } = props;
  const { sys, xs, ws } = placed;
  return row.cells.flatMap((cell, anchor): DrawnCell[] => {
    if (!cell) return [];
    const dy = shift(anchor);
    const column = sys.anchors[anchor];
    // la note vient après les petites notes et l'arpège de sa case
    const extra = leadExtra(sys, anchor);
    const x = xs[column] + extra;
    const cellEnd = xs[column] + ws[column];
    const width = ws[column] - extra;
    const place = { anchor, cell, x, cellEnd, top: y + dy, baseline: baseline.value + dy, middle: y + dy + placed.rowH / 2 };
    // trille : la note, sa voisine en petit, puis un trait ondulé sur toute sa durée
    if (row.trill[anchor] && cell === "-") return [{ ...place, kind: "trill", wave: trillPath(xs[column], cellEnd, place.middle) }];
    const articulations = !cell.startsWith("-") ? props.articulations.get(anchor) : undefined;
    const technique = row.string !== undefined ? techniqueOf(cell) : undefined;
    if (technique) return [{ ...place, kind: "technique", technique, articulations: articulations ?? [] }];
    if (!cell.startsWith("-") && (cell.includes(TRILL_MARK) || cell.includes(FINGER_MARK) || articulations))
      return [{ ...place, kind: "annotated", articulations: articulations ?? [] }];
    if (row.trill[anchor]) {
      // trille commencée au système précédent : le rappel « –N », puis l'ondulation
      const end = x + 0.5 + cell.length * METRICS.noteDigit;
      return [{ ...place, kind: "trillReminder", wave: end < cellEnd ? trillPath(end, cellEnd, place.middle) : undefined }];
    }
    // sans rappel (option), une note commencée au système précédent n'est qu'un trait de tenue
    if (cell === "-" || (cell.startsWith("-") && !reminders))
      return [{ ...place, kind: "hold", x1: x + width * 0.22, x2: x + width * 0.62 }];
    // note commencée au système précédent : le trait de tenue habituel, puis en petit et en gris le
    // rappel de la note tenue (« — 8 »), pour ne pas le lire comme un nombre négatif
    if (cell.startsWith("-")) return [{ ...place, kind: "holdReminder", x1: x + 0.5, x2: x + 0.5 + METRICS.holdW }];
    return [{ ...place, kind: "note" }];
  });
});
</script>

<template>
  <g>
    <text v-for="grace in graces" :key="grace.key" :x="grace.x" :y="grace.y" font-size="2.3" font-weight="600" :fill="GRACE">{{
      grace.text
    }}</text>
    <template v-for="drawn in cells" :key="drawn.anchor">
      <path v-if="drawn.kind === 'trill'" :d="drawn.wave" v-bind="WAVE" />
      <StringCell
        v-else-if="drawn.kind === 'technique'"
        :placed="placed"
        :row="row"
        :anchor="drawn.anchor"
        :technique="drawn.technique"
        :x="drawn.x"
        :top="drawn.top"
        :baseline="drawn.baseline"
        :middle="drawn.middle"
        :articulations="drawn.articulations"
        :tech-top="techTop"
      />
      <AnnotatedNote
        v-else-if="drawn.kind === 'annotated'"
        :cell="drawn.cell"
        :x="drawn.x"
        :cell-end="drawn.cellEnd"
        :top="drawn.top"
        :baseline="drawn.baseline"
        :middle="drawn.middle"
        :articulations="drawn.articulations"
      />
      <g v-else-if="drawn.kind === 'trillReminder'">
        <text :x="drawn.x + 0.5" :y="drawn.baseline" font-size="3.1" :fill="GREY">{{ "–" + drawn.cell.slice(1) }}</text>
        <path v-if="drawn.wave" :d="drawn.wave" v-bind="WAVE" />
      </g>
      <line
        v-else-if="drawn.kind === 'hold'"
        :x1="drawn.x1"
        :x2="drawn.x2"
        :y1="drawn.middle"
        :y2="drawn.middle"
        :stroke="INK"
        stroke-width="0.32"
      />
      <g v-else-if="drawn.kind === 'holdReminder'">
        <line :x1="drawn.x1" :x2="drawn.x2" :y1="drawn.middle" :y2="drawn.middle" :stroke="INK" stroke-width="0.32" />
        <text :x="drawn.x2 + 0.6" :y="drawn.baseline - 0.2" font-size="2.7" font-weight="600" :fill="GREY">{{ drawn.cell.slice(1) }}</text>
      </g>
      <text v-else :x="drawn.x + 0.5" :y="drawn.baseline" font-size="3.3" font-weight="600" :fill="INK">{{ drawn.cell }}</text>
    </template>
  </g>
</template>
