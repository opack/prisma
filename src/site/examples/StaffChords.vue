<script setup lang="ts">
/**
 * Do mi sol et mi sol si sur une portée en clé de sol, dessinés à la main : la même forme, trois
 * notes sur trois lignes voisines, pour un accord majeur et un accord mineur.
 */
const GAP = 10; // l'écart entre deux lignes de la portée
const BOTTOM = 80; // la ligne du bas, celle du mi
/** La hauteur d'une note, en demi-écarts au-dessus du mi de la ligne du bas (do : -2). */
const y = (step: number) => BOTTOM - (step * GAP) / 2;

const CHORDS = [
  { x: 92, steps: [-2, 0, 2], name: "do mi sol", kind: "majeur" },
  { x: 168, steps: [0, 2, 4], name: "mi sol si", kind: "mineur" },
];
</script>

<template>
  <svg
    class="block w-[300px] max-w-full h-auto p-3 border border-line rounded-[10px] bg-white box-content"
    viewBox="0 0 220 132"
    role="img"
    aria-label="Sur une portée en clé de sol, do mi sol et mi sol si : trois notes sur trois lignes voisines, la même forme."
  >
    <line
      v-for="index in [0, 1, 2, 3, 4]"
      :key="index"
      :x1="6"
      :x2="214"
      :y1="BOTTOM - index * GAP"
      :y2="BOTTOM - index * GAP"
      stroke="#1b1d1f"
      :stroke-width="1"
    />
    <text :x="8" :y="BOTTOM + 8" class="font-['Noto_Music','Segoe_UI_Symbol','Apple_Symbols','Bravura',serif] text-[58px]">𝄞</text>
    <g v-for="chord in CHORDS" :key="chord.x">
      <line
        v-if="chord.steps.includes(-2)"
        :x1="chord.x - 11"
        :x2="chord.x + 11"
        :y1="y(-2)"
        :y2="y(-2)"
        stroke="#1b1d1f"
        :stroke-width="1"
      />
      <ellipse
        v-for="step in chord.steps"
        :key="step"
        :cx="chord.x"
        :cy="y(step)"
        :rx="6.4"
        :ry="4.6"
        :transform="`rotate(-20 ${chord.x} ${y(step)})`"
        fill="#1b1d1f"
      />
      <text :x="chord.x" :y="112" text-anchor="middle" class="font-ui text-[11px] fill-ink" font-style="italic">{{ chord.name }}</text>
      <text :x="chord.x" :y="127" text-anchor="middle" class="font-ui text-[10px] fill-dim">{{ chord.kind }}</text>
    </g>
  </svg>
</template>
