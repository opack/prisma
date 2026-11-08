<script setup lang="ts">
/**
 * Les signes d'articulation d'une note, côte à côte, à la verticale de ses chiffres, en haut de sa
 * ligne : staccato (point), accent (« > »), marcato (« ^ »), et le sens du médiator (⊓, V).
 * cx : le milieu des chiffres ; cy : le milieu des signes.
 */
import { METRICS } from "../engrave.ts";
import { INK } from "../drawing.ts";

const { signs, cx } = defineProps<{ signs: string[]; cx: number; cy: number }>();

const scale = METRICS.articulationScale;
const signX = (index: number) => cx + (index - (signs.length - 1) / 2) * METRICS.articulationStep * scale;
</script>

<template>
  <!-- dessinés autour de (0, 0), puis mis à l'échelle sur place -->
  <g v-for="(sign, index) in signs" :key="sign" :transform="`translate(${signX(index)} ${cy}) scale(${scale})`">
    <circle v-if="sign === '.'" cx="0" cy="0" r="0.3" :fill="INK" />
    <path v-else-if="sign === '!'" d="M -0.42 -0.32 L 0.42 0 L -0.42 0.32" fill="none" :stroke="INK" stroke-width="0.22" />
    <!-- médiator vers le bas : le pont (⊓), sa barre plus épaisse -->
    <path v-else-if="sign === 'd'" d="M -0.42 0.34 L -0.42 -0.3 L 0.42 -0.3 L 0.42 0.34" fill="none" :stroke="INK" stroke-width="0.24" />
    <!-- vers le haut : le V -->
    <path v-else-if="sign === 'u'" d="M -0.36 -0.36 L 0 0.34 L 0.36 -0.36" fill="none" :stroke="INK" stroke-width="0.22" />
    <path v-else d="M -0.38 0.32 L 0 -0.38 L 0.38 0.32" fill="none" :stroke="INK" stroke-width="0.26" />
  </g>
</template>
