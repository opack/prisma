<script setup lang="ts">
/** Le choix d'une note sur un clavier, dans la retouche d'une case : chaque touche porte son numéro et se clique. */
import { BLACK, WHITE } from "./keys.ts";

const { current, title } = defineProps<{ current?: string; title?: (note: number) => string }>();
const emit = defineEmits<{ pick: [name: string] }>();

const UNIT = 100 / WHITE.length;
const keys = [
  ...WHITE.map((note, index) => ({ note, black: false, left: index * UNIT, width: UNIT })),
  ...BLACK.map(([note, at]) => ({ note, black: true, left: (at - 0.32) * UNIT, width: UNIT * 0.64 })),
];

/** Une touche du clavier de choix : blanche, ou noire par-dessus ; celle de la note, à la couleur de l'accent. */
const keyClass = (black: boolean, chosen: boolean) => [
  "absolute top-0 flex items-end justify-center px-0 pt-0 border rounded-[0_0_5px_5px] font-mono font-semibold",
  black ? "z-1 h-[50px] pb-1 text-[11px] text-white" : "h-[84px] pb-1.5 text-[13px]",
  chosen
    ? `bg-accent border-accent text-white ${black ? "" : "shadow-[inset_0_0_0_1px_var(--color-accent)]"}`
    : black
      ? "bg-[#2a2d30] border-[#2a2d30] hover:bg-[#454a4f]"
      : "bg-white border-[#b9bcb6] text-ink hover:bg-accent-10",
];
</script>

<template>
  <div class="relative h-[84px]">
    <button
      v-for="key in keys"
      :key="key.note"
      :class="keyClass(key.black, String(key.note) === current)"
      :style="{ left: `${key.left}%`, width: `${key.width}%` }"
      :title="title?.(key.note)"
      :aria-label="`note ${key.note}`"
      @click="emit('pick', String(key.note))"
    >
      {{ key.note }}
    </button>
  </div>
</template>
