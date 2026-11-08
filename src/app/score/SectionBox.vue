<script setup lang="ts">
/** La lettre d'une section, en blanc sur fond noir : sur la partition et dans l'ordre de jeu. */
import { INK } from "./drawing.ts";

defineProps<{ x: number; y: number; label: string }>();
</script>

<template>
  <g>
    <rect :x="x" :y="y" width="3.6" height="3.3" rx="0.4" :fill="INK" />
    <text :x="x + 1.8" :y="y + 2.55" font-size="2.8" font-weight="700" text-anchor="middle" fill="#fff">{{ label }}</text>
  </g>
</template>
