<script setup lang="ts">
/** Les accords, au-dessus de la règle : le nom en haut, les notes Prisma empilées dessous, la basse en bas ; ou la grille sous le nom (options). */
import { computed } from "vue";
import { METRICS, chordGrid, leadExtra, splitChord } from "../../../app/score/engrave.ts";
import type { PlacedSystem } from "../../../app/score/engrave.ts";
import type { RenderOptions } from "../../../app/options/options.ts";
import { INK, TAB_TEXT } from "../drawing.ts";
import ChordGrid from "./ChordGrid.vue";
import { anchorX } from "./system.ts";

const props = defineProps<{ placed: PlacedSystem; options: RenderOptions }>();

/** Le haut de la bande des accords, juste au-dessus de la règle. */
const top = computed(() => props.placed.y + props.placed.textBand + props.placed.structBand);

const chords = computed(() => {
  const { placed, options } = props;
  return placed.sys.chords.map((chord) => {
    const { notes, name } = splitChord(chord.text, options.chordNames);
    const named = !!name && options.chords !== "notes";
    const grid = options.chords === "grid" ? chordGrid(chord.text, placed.sys.parts) : undefined;
    const stacked = !grid && (options.chords === "notes" || options.chords === "both" || !name);
    return { x: anchorX(placed, chord.anchor) + leadExtra(placed.sys, chord.anchor) + 0.5, name, named, grid, notes: stacked ? notes : [] };
  });
});
</script>

<template>
  <g v-for="(chord, index) in chords" :key="'ch' + index">
    <text v-if="chord.named" :x="chord.x" :y="top + 3.4" font-size="3.4" font-weight="700" :fill="INK">{{ chord.name }}</text>
    <ChordGrid v-if="chord.grid" :shape="chord.grid" :x="chord.x + 0.3" :y="top + (chord.named ? METRICS.chordNameH : 0.8)" />
    <text
      v-for="(note, noteIndex) in chord.notes"
      :key="noteIndex"
      :x="chord.x"
      :y="placed.rulerTop - 0.6 - noteIndex * METRICS.chordNoteH"
      font-size="2.2"
      font-weight="600"
      :fill="TAB_TEXT"
    >
      {{ note }}
    </text>
  </g>
</template>
