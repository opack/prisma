<script setup lang="ts">
/** La case jouée, surlignée sur toute la hauteur de son système. */
import { computed } from "vue";
import type { PlacedSystem } from "./engrave.ts";
import { systemBand } from "./geometry.ts";

const { system } = defineProps<{ system: PlacedSystem; column: number }>();
const band = computed(() => systemBand(system));
</script>

<template>
  <rect
    :x="system.xs[column]"
    :y="band.top"
    :width="system.ws[column]"
    :height="band.bottom - band.top"
    rx="0.6"
    fill="rgba(255, 190, 40, 0.3)"
    style="pointer-events: none"
  />
</template>
