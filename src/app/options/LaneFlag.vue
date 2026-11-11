<script setup lang="ts">
/** Le drapeau d'une palette : les couloirs empilés, de l'aigu (en haut) au grave. */
import { computed } from "vue";
import { laneTint } from "../score/colors.ts";
import type { LaneColors } from "../score/colors.ts";

const { colors } = defineProps<{ colors: LaneColors }>();

const stripes = computed(() =>
  Array.from({ length: 9 }, (_, index) => laneTint(colors, 4 - index)?.tab ?? (index % 2 ? "#ffffff" : "#e6e8e3")),
);
</script>

<template>
  <svg class="flex-none w-[38px] h-7" viewBox="0 0 24 18" preserveAspectRatio="none" aria-hidden="true">
    <rect v-for="(tint, index) in stripes" :key="index" :x="0" :y="index * 2" :width="24" :height="2" :fill="tint" />
    <rect :x="0.25" :y="0.25" :width="23.5" :height="17.5" fill="none" stroke="#c9cdd1" :stroke-width="0.5" :rx="1.5" />
  </svg>
</template>
