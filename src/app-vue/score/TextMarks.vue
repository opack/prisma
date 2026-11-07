<script setup lang="ts">
/**
 * Le signe du texte sous le curseur de l'éditeur, encadré sur la partition : sa case, sur la ligne
 * qui le porte (sa portée seule pour une ligne @, tout le système pour la règle). Quand le curseur
 * vient de bouger, le cadre est amené à l'écran. Pendant l'écoute, seul le curseur de lecture se
 * montre.
 */
import { computed, useTemplateRef, watch } from "vue";
import { mainOf, rowLane } from "../../core/locate.ts";
import type { PlacedSystem } from "../../app/score/engrave.ts";
import { anchorAt, systemBand } from "../../app/score/geometry.ts";
import { textMark } from "../../app/score/textMark.ts";
import { usePlayer } from "../playback/state.ts";
import { useExternal } from "../useExternal.ts";

const { systems } = defineProps<{ systems: PlacedSystem[] }>();

const mark = useExternal((listener) => textMark.subscribe(listener), textMark.get);
const player = usePlayer();
const frame = useTemplateRef<SVGRectElement>("frame");

const shown = computed(() => {
  const at = ["playing", "loading"].includes(player.value.state) ? undefined : mark.value?.place;
  const placed = at && systems.find((candidate) => at.t >= candidate.sys.start && at.t < candidate.sys.end);
  if (!at || !placed) return null;
  const { sys } = placed;
  // la case : la dernière qui commence à l'instant du signe ou avant
  const anchor = anchorAt(placed, at.t);
  const column = sys.anchors[anchor];
  let { top, bottom } = systemBand(placed);
  const staff = at.staff >= 0 ? placed.staves[at.staff] : undefined;
  if (staff) {
    const rows = sys.staves[at.staff].rows;
    const lane = rows.map((row, index) => ({ row, index })).filter((candidate) => rowLane(candidate.row) === at.octave);
    const want = at.content === undefined ? undefined : mainOf(at.content);
    const hit = lane.find((candidate) => want && mainOf(candidate.row.cells[anchor] ?? "") === want) ?? lane[0];
    top = placed.y + staff.rowsTop + (hit ? hit.index : 0) * placed.rowH;
    bottom = hit ? top + placed.rowH : placed.y + staff.bottom;
  }
  return { x: placed.xs[column] - 0.3, y: top, width: placed.ws[column] + 0.6, height: bottom - top };
});

watch(
  [mark, shown],
  () => mark.value?.reveal && shown.value && frame.value?.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" }),
  { flush: "post" },
);
</script>

<template>
  <rect
    v-if="shown"
    ref="frame"
    class="text-mark print:hidden"
    :x="shown.x"
    :y="shown.y"
    :width="shown.width"
    :height="shown.height"
    rx="0.8"
    fill="rgba(43, 93, 110, 0.12)"
    stroke="#2b5d6e"
    stroke-width="0.35"
    style="pointer-events: none"
  />
</template>
