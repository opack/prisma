<script setup lang="ts">
/** L'accolade fine à gauche d'une partie à plusieurs portées (le piano), de top à bottom : deux courbes qui se rejoignent en pointe au milieu. */
import { computed } from "vue";
import { INK } from "../drawing.ts";

const props = defineProps<{ x: number; top: number; bottom: number }>();

const outline = computed(() => {
  const { x, top, bottom } = props;
  const middle = (top + bottom) / 2,
    width = 1.3;
  return [
    `M ${x} ${top}`,
    `C ${x - width} ${top + 1}, ${x} ${middle - 1.5}, ${x - width} ${middle}`,
    `C ${x} ${middle + 1.5}, ${x - width} ${bottom - 1}, ${x} ${bottom}`,
    `C ${x - width * 0.6} ${bottom - 1}, ${x + 0.25} ${middle + 1.5}, ${x - width} ${middle}`,
    `C ${x + 0.25} ${middle - 1.5}, ${x - width * 0.6} ${top + 1}, ${x} ${top}`,
  ].join(" ");
});
</script>

<template>
  <path :d="outline" :fill="INK" :stroke="INK" stroke-width="0.1" />
</template>
