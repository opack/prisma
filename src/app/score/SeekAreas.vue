<script setup lang="ts">
/**
 * Zones cliquables, une par système : un clic sur une colonne y place le curseur de lecture, d'où
 * la lecture démarre ou reprend (ou repart tout de suite si elle est en cours). Un double-clic,
 * ou au doigt deux touchers rapprochés, ouvre la retouche de la case ; sur la règle, celle du temps.
 */
import { rowLane } from "../../core/locate.ts";
import { METRICS } from "./engrave.ts";
import type { PlacedSystem } from "./engrave.ts";
import { follow } from "./follow.ts";
import { nearestColumn, systemBand } from "./geometry.ts";
import { pick } from "./pick.ts";
import { player } from "../playback/player.ts";

defineProps<{ systems: PlacedSystem[] }>();

/** Deux touchers du doigt font un double toucher s'ils sont aussi proches, dans le temps (ms) et sur la page (px). */
const TAP_DELAY = 350;
const TAP_SLOP = 30;

// le dernier toucher du doigt (quand, où), et le dernier double toucher, dont le navigateur peut
// donner aussi son double-clic
const tap = { touch: false, at: 0, x: 0, y: 0, double: 0 };

function area(placed: PlacedSystem) {
  const { top, bottom } = systemBand(placed);
  const left = placed.xs[placed.sys.anchors[0]],
    last = placed.sys.anchors[placed.sys.anchors.length - 1];
  return { x: left, y: top, width: placed.xs[last] + placed.ws[last] - left, height: bottom - top };
}

/** Le signe sous le pointeur : son instant, sa portée, son octave, le contenu de sa case. */
function placeOf(placed: PlacedSystem, event: MouseEvent) {
  const matrix = (event.currentTarget as SVGRectElement).getScreenCTM();
  if (!matrix) return undefined;
  const { x, y } = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
  const { sys } = placed;
  // la colonne sous le clic, ou la plus proche quand on clique entre deux
  const best = nearestColumn(placed, x);
  const tick = (sys.columns[best] as { t: number }).t;
  // la ligne sous le clic (les places des portées se comptent depuis le haut du système)
  const dy = y - placed.y;
  // sur la règle : le temps, sans portée (son double-clic retouche le temps)
  if (dy < placed.rulerTop + METRICS.rulerH) return { at: { t: tick, staff: -1 }, where: { x: event.clientX, y: event.clientY } };
  const staff = placed.staves.findIndex(
    (staffPlace, index) => dy >= staffPlace.rowsTop && dy < staffPlace.rowsTop + sys.staves[index].rows.length * placed.rowH,
  );
  const nearest =
    staff >= 0
      ? staff
      : Math.max(
          0,
          placed.staves.findIndex((staffPlace) => dy < staffPlace.bottom),
        );
  const rows = sys.staves[nearest]?.rows ?? [];
  const row = staff >= 0 ? rows[Math.floor((dy - placed.staves[staff].rowsTop) / placed.rowH)] : undefined;
  const anchor = sys.anchors.indexOf(best);
  let content = row?.cells[anchor];
  // une tenue dit quelle note elle prolonge (« -7 ») : celle de la dernière attaque de sa ligne
  if (row && content?.startsWith("-") && !/\d/.test(content)) {
    for (let previous = anchor - 1; previous >= 0; previous--) {
      const cell = row.cells[previous] ?? "";
      const name = cell.match(/^-?(\d+)/)?.[1];
      if (name) {
        content = "-" + name;
        break;
      }
      if (!cell.startsWith("-")) break;
    }
  }
  return {
    at: { t: tick, staff: rows[0]?.staff ?? nearest, octave: row && rowLane(row), content },
    where: { x: event.clientX, y: event.clientY },
  };
}

// un clic place l'écoute (et le curseur du texte) ; un double-clic ouvre la retouche de la case
function seek(placed: PlacedSystem, event: MouseEvent) {
  if (tap.touch) {
    const now = performance.now(),
      near = Math.hypot(event.clientX - tap.x, event.clientY - tap.y) <= TAP_SLOP;
    const twice = now - tap.at <= TAP_DELAY && near;
    Object.assign(tap, { at: twice ? 0 : now, x: event.clientX, y: event.clientY });
    if (twice) {
      tap.double = now;
      return edit(placed, event);
    }
  }
  const place = placeOf(placed, event);
  if (!place) return;
  follow.release();
  player.seek(place.at.t);
  pick.emit(place.at, place.where, "click");
}

function edit(placed: PlacedSystem, event: MouseEvent) {
  if (event.type === "dblclick" && performance.now() - tap.double <= TAP_DELAY) return;
  const place = placeOf(placed, event);
  if (place) pick.emit(place.at, place.where, "edit");
}
</script>

<template>
  <g class="seek">
    <rect
      v-for="(placed, index) in systems"
      :key="index"
      v-bind="area(placed)"
      class="system-area cursor-pointer"
      fill="transparent"
      :data-start="placed.sys.start"
      :data-end="placed.sys.end"
      :data-top="placed.y"
      :data-bottom="placed.y + placed.height"
      @pointerdown="tap.touch = $event.pointerType === 'touch'"
      @click="seek(placed, $event)"
      @dblclick="edit(placed, $event)"
    />
  </g>
</template>
