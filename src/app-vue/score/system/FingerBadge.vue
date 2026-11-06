<script setup lang="ts">
/** Le doigt d'une note, en négatif, en bas à droite de ses chiffres : x, le centre ; baseline, la ligne des chiffres. */
import { FINGER } from "../../../app/score/engrave.ts";
import { TAB_TEXT } from "../drawing.ts";

defineProps<{ x: number; baseline: number; finger: string | number }>();
</script>

<template>
  <g>
    <rect :x="x - FINGER.r" :y="baseline - 1.95" :width="2 * FINGER.r" height="2.9" rx="0.6" :fill="TAB_TEXT" />
    <text :x="x" :y="baseline + 0.3" font-size="2.2" font-weight="700" text-anchor="middle" fill="#fff">{{ finger }}</text>
  </g>
</template>
