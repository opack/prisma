<script setup lang="ts">
/**
 * Un petit clavier, dans la barre de statut, ses touches marquées : la note ou l'accord, et d'une
 * autre couleur la voisine de trille et les petites notes (celles de la coloration du texte).
 */
import { BLACK, WHITE } from "./keys.ts";

const { keys, trill, graces = [], title } = defineProps<{ keys: number[]; trill?: number; graces?: number[]; title?: string }>();

const WHITE_WIDTH = 7;
const WHITE_HEIGHT = 18;
const BLACK_WIDTH = 4.4;
const BLACK_HEIGHT = 11;

/** La note : le jaune de la case en surbrillance ; la trille et les petites notes, les couleurs de la coloration du texte. */
const kind = (note: number) =>
  keys.includes(note) ? "fill-[#ffc53d]" : note === trill ? "fill-[#0f7b6c]" : graces.includes(note) ? "fill-[#7a4fb0]" : undefined;
</script>

<template>
  <svg
    class="inline align-[-5px] mr-1 ml-1.5"
    :viewBox="`0 0 ${WHITE.length * WHITE_WIDTH + 1} ${WHITE_HEIGHT + 1}`"
    :width="WHITE.length * WHITE_WIDTH + 1"
    :height="WHITE_HEIGHT + 1"
    role="img"
    :aria-label="title ?? `touches ${keys.join(', ')}`"
  >
    <title v-if="title">{{ title }}</title>
    <rect
      v-for="(note, index) in WHITE"
      :key="note"
      :x="index * WHITE_WIDTH + 0.5"
      :y="0.5"
      :width="WHITE_WIDTH"
      :height="WHITE_HEIGHT"
      :rx="1"
      :class="['stroke-[#8a8d87] [stroke-width:0.7]', kind(note) ?? 'fill-white']"
    />
    <rect
      v-for="[note, at] in BLACK"
      :key="note"
      :x="at * WHITE_WIDTH + 0.5 - BLACK_WIDTH / 2"
      :y="0.5"
      :width="BLACK_WIDTH"
      :height="BLACK_HEIGHT"
      :rx="0.8"
      :class="['stroke-[#1f2123] [stroke-width:0.7]', kind(note) ?? 'fill-[#3a3d40]']"
    />
  </svg>
</template>
