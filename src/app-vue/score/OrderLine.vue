<script setup lang="ts">
/**
 * L'ordre de jeu des sections, en tête de page : les mêmes lettres que sur la partition, centrées
 * sur cx. Vivant (live), il sert aussi à l'écoute : la section jouée y est entourée, et un clic sur
 * une lettre y lance la lecture.
 */
import { computed } from "vue";
import { PAGE } from "../../app/score/engrave.ts";
import { player } from "../../app/playback/player.ts";
import OrderPlaying from "./OrderPlaying.vue";
import SectionBox from "./SectionBox.vue";

const { order, cx = PAGE.w / 2, live = false } = defineProps<{ order: string[]; y: number; cx?: number; live?: boolean }>();

const STEP = 3.6 + 1.6;
const start = computed(() => cx - (order.length * STEP - 1.6) / 2);
</script>

<template>
  <g>
    <OrderPlaying v-if="live" :x0="start" :step="STEP" :y="y" />
    <SectionBox v-for="(label, index) in order" :key="index" :x="start + index * STEP" :y="y" :label="label" />
    <g v-if="live" class="seek">
      <rect
        v-for="(label, index) in order"
        :key="index"
        :x="start + index * STEP - 0.8"
        :y="y - 0.8"
        :width="STEP"
        height="4.9"
        fill="transparent"
        class="cursor-pointer"
        @click="player.seekEntry(index)"
      >
        <title>{{ `Écouter à partir de cette section ${label}` }}</title>
      </rect>
    </g>
  </g>
</template>
