<script setup lang="ts">
/** L'ordre de jeu des sections, en tête de page : les mêmes lettres que sur la partition, centrées sur cx. */
import { computed } from "vue";
import { PAGE } from "../../app/score/engrave.ts";
import SectionBox from "./SectionBox.vue";

const { order, cx = PAGE.w / 2 } = defineProps<{ order: string[]; y: number; cx?: number }>();

const STEP = 3.6 + 1.6;
const start = computed(() => cx - (order.length * STEP - 1.6) / 2);
</script>

<template>
  <g>
    <SectionBox v-for="(label, index) in order" :key="index" :x="start + index * STEP" :y="y" :label="label" />
  </g>
</template>
