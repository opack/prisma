<script setup lang="ts">
/**
 * La règle de comptage, au-dessus des couloirs : le numéro de la première mesure (préfixé de « m »,
 * pour ne pas le confondre avec les temps), le numéro de chaque temps, et ses découpages, gravés
 * comme les graduations d'une règle, à mi-hauteur des numéros, comme dans le texte : astérisque,
 * point, virgule ; puis le trait qui la ferme, coupé entre deux sections à la suite.
 */
import { computed } from "vue";
import { METRICS, PAGE } from "../engrave.ts";
import type { PlacedSystem } from "../engrave.ts";
import { GREY, LIGHT, LIGHT_TEXT } from "../drawing.ts";
import { edges, laneSpans } from "./system.ts";

const props = defineProps<{ placed: PlacedSystem }>();

const baseline = computed(() => props.placed.rulerTop + METRICS.rulerH * 0.72);

/** Une graduation : le numéro d'un temps, ou un découpage (point, virgule, astérisque). */
type Graduation =
  | { anchor: number; kind: "beat"; x: number; label: string }
  | { anchor: number; kind: "dot"; x: number; cy: number }
  | { anchor: number; kind: "comma" | "star"; path: string };

const graduations = computed(() => {
  const { sys, xs } = props.placed;
  return sys.anchors.flatMap((columnIndex, anchor): Graduation[] => {
    const column = sys.columns[columnIndex];
    if (column.kind !== "anchor" || !column.label) return [];
    if (column.cellIndex === 0) return [{ anchor, kind: "beat", x: xs[columnIndex] + 0.5, label: column.label }];
    const x = xs[columnIndex] + 0.9;
    // centrées sur la hauteur des chiffres des temps (hauteur de capitale ≈ 0,7 × 2,6 mm)
    const cy = baseline.value - 0.92;
    if (column.label === ".") return [{ anchor, kind: "dot", x, cy }];
    // « , » : un point plus petit, avec sa queue
    if (column.label === ",")
      return [{ anchor, kind: "comma", path: `M ${x - 0.22} ${cy} a 0.22 0.22 0 1 1 0.44 0 q 0 0.55 -0.4 0.8 q 0.2 -0.35 0.1 -0.62 z` }];
    // astérisque à trois branches, plus fin que le trait du « . »
    const radius = 0.8;
    const arms = [90, 30, -30].map((degrees) => {
      const angle = (degrees * Math.PI) / 180,
        dx = radius * Math.cos(angle),
        dy = radius * Math.sin(angle);
      return `M ${x - dx} ${cy + dy} L ${x + dx} ${cy - dy}`;
    });
    return [{ anchor, kind: "star", path: arms.join(" ") }];
  });
});

const lines = computed(() => {
  const { left, right } = edges(props.placed);
  return laneSpans(props.placed, left, right);
});
</script>

<template>
  <text :x="PAGE.marginX + METRICS.prefix - 1.2" :y="baseline" font-size="2.3" :fill="GREY" text-anchor="end" font-style="italic">{{
    "m" + placed.sys.bar
  }}</text>
  <!-- dans le gris clair : les graduations restent moins visibles que les numéros des temps -->
  <template v-for="graduation in graduations" :key="graduation.anchor">
    <text v-if="graduation.kind === 'beat'" :x="graduation.x" :y="baseline" font-size="2.6" font-style="italic" :fill="GREY">{{
      graduation.label
    }}</text>
    <circle v-else-if="graduation.kind === 'dot'" :cx="graduation.x" :cy="graduation.cy" r="0.3" :fill="LIGHT_TEXT" />
    <path v-else-if="graduation.kind === 'comma'" :d="graduation.path" :fill="LIGHT_TEXT" />
    <path v-else :d="graduation.path" :stroke="LIGHT_TEXT" stroke-width="0.28" stroke-linecap="round" />
  </template>
  <line
    v-for="([from, to], index) in lines"
    :key="'rl' + index"
    :x1="from"
    :x2="to"
    :y1="placed.rulerTop + METRICS.rulerH"
    :y2="placed.rulerTop + METRICS.rulerH"
    :stroke="LIGHT"
    stroke-width="0.25"
  />
</template>
