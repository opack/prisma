<script setup lang="ts">
/**
 * Le clavier de l'accueil : deux octaves, chaque touche porte son numéro Prisma, et chaque octave
 * la couleur de son couloir sur la partition. Survoler une touche montre la même touche dans
 * l'autre octave : même numéro, même place sous la main. Sur un écran étroit, les deux octaves
 * s'empilent, l'aiguë au-dessus, comme leurs lignes sur la partition.
 */
import { useMediaQuery } from "@vueuse/core";
import { computed, ref } from "vue";
import { octaveTint } from "../../app/score/colors.ts";

const WHITE = [1, 3, 5, 6, 8, 10, 12];
/** Les touches noires : leur note, et la touche blanche à la droite de laquelle elles commencent. */
const BLACK: [note: number, at: number][] = [
  [2, 1],
  [4, 2],
  [7, 4],
  [9, 5],
  [11, 6],
];
const OCTAVES = [0, 1];
const WHITE_WIDTH = 46;
const WHITE_HEIGHT = 168;
const BLACK_WIDTH = 28;
const BLACK_HEIGHT = 104;
/** La hauteur du couloir d'une octave, au-dessus de ses touches, et l'écart entre deux octaves empilées. */
const LANE = 30;
const GAP = 14;

const hover = ref<number | null>(null);
const stacked = useMediaQuery("(max-width: 600px)");

const width = computed(() => (stacked.value ? WHITE_WIDTH * 7 : WHITE_WIDTH * 7 * OCTAVES.length));
const height = computed(() => (stacked.value ? OCTAVES.length * (WHITE_HEIGHT + LANE) + (OCTAVES.length - 1) * GAP : WHITE_HEIGHT + LANE));
const octaves = computed(() =>
  OCTAVES.map((octave, index) => ({
    octave,
    name: octave > 0 ? `+${octave}` : String(octave),
    tint: octaveTint("rainbow", octave)!,
    left: stacked.value ? 1 : 1 + index * WHITE_WIDTH * 7,
    top: stacked.value ? (OCTAVES.length - 1 - index) * (WHITE_HEIGHT + LANE + GAP) : 0,
  })),
);
</script>

<template>
  <svg
    class="block w-full max-w-[360px] min-[601px]:max-w-none h-auto touch-manipulation"
    :viewBox="`0 0 ${width + 2} ${height + 2}`"
    role="img"
    aria-label="Deux octaves du clavier : chaque touche porte son numéro, de 1 (do) à 12 (si), dans chaque octave."
  >
    <g v-for="{ octave, name, tint, left, top } in octaves" :key="octave" :transform="`translate(0 ${top})`">
      <!-- le couloir de l'octave, comme sur la partition, et son numéro -->
      <rect :x="left" :y="1" :width="WHITE_WIDTH * 7" :height="LANE - 4" :rx="4" :fill="tint.band" />
      <rect :x="left" :y="1" :width="40" :height="LANE - 4" :rx="4" :fill="tint.tab" />
      <text :x="left + 20" :y="LANE / 2 + 3" class="font-ui font-bold text-[14px] fill-ink" text-anchor="middle">{{ name }}</text>
      <text :x="left + 52" :y="LANE / 2 + 3" class="font-ui text-[13px] fill-dim">octave {{ name }}</text>
      <g v-for="(note, index) in WHITE" :key="note" @pointerenter="hover = note" @pointerleave="hover = null">
        <rect
          :x="left + index * WHITE_WIDTH"
          :y="LANE"
          :width="WHITE_WIDTH"
          :height="WHITE_HEIGHT"
          :rx="5"
          :class="['stroke-[#8f938d] stroke-1', { 'fill-[#ffc53d]': hover === note }]"
          :style="{ fill: hover === note ? undefined : tint.band }"
        />
        <text
          :x="left + index * WHITE_WIDTH + WHITE_WIDTH / 2"
          :y="LANE + WHITE_HEIGHT - 16"
          text-anchor="middle"
          class="font-ui font-bold pointer-events-none text-[17px] fill-ink"
        >
          {{ note }}
        </text>
      </g>
      <g v-for="[note, at] in BLACK" :key="note" @pointerenter="hover = note" @pointerleave="hover = null">
        <rect
          :x="left + at * WHITE_WIDTH - BLACK_WIDTH / 2"
          :y="LANE"
          :width="BLACK_WIDTH"
          :height="BLACK_HEIGHT"
          :rx="4"
          :class="['stroke-[#1c1e20] stroke-1', hover === note ? 'fill-[#ffc53d]' : 'fill-[#2a2d30]']"
        />
        <text
          :x="left + at * WHITE_WIDTH"
          :y="LANE + BLACK_HEIGHT - 12"
          text-anchor="middle"
          :class="['font-ui font-bold pointer-events-none text-[13px]', hover === note ? 'fill-ink' : 'fill-white']"
        >
          {{ note }}
        </text>
      </g>
    </g>
  </svg>
</template>
