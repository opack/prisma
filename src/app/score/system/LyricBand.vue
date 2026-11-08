<script setup lang="ts">
/**
 * Les paroles d'une portée : un couplet par ligne, chaque syllabe sous le début de sa note. Un trait
 * d'union relie les syllabes d'un mot ; un trait bas prolonge une syllabe chantée sur plusieurs notes
 * (mélisme), jusqu'à la fin de la dernière.
 */
import { computed } from "vue";
import { METRICS, leadExtra, lyricTextW } from "../engrave.ts";
import type { PlacedSystem } from "../engrave.ts";
import type { Voice } from "../../../core/index.ts";
import { HALO, INK, LYRIC_FONT } from "../drawing.ts";
import { anchorEnd, anchorX, edges } from "./system.ts";

const props = defineProps<{ placed: PlacedSystem; voice: Voice; top: number }>();

const syllableX = (anchor: number) => anchorX(props.placed, anchor) + leadExtra(props.placed.sys, anchor) + 0.5;

const verses = computed(() => {
  const { placed, voice, top } = props;
  const { left, right } = edges(placed);
  return voice.lyrics.map((line, verse) => {
    const baseline = top + 0.4 + verse * METRICS.lyricH + METRICS.lyricH * 0.68;
    const syllables = line.syllables.map((syllable, index) => {
      const end = syllableX(syllable.anchor) + lyricTextW(syllable.text);
      const next = line.syllables[index + 1];
      // trait d'union : au milieu de l'espace jusqu'à la syllabe suivante, ou juste après en fin de système
      const gap = next ? syllableX(next.anchor) - end : 1.8;
      const hyphenWidth = Math.min(0.8, gap * 0.4);
      const hyphenX = end + gap / 2;
      return {
        ...syllable,
        x: syllableX(syllable.anchor),
        hyphen: syllable.hyphen ? [hyphenX - hyphenWidth / 2, hyphenX + hyphenWidth / 2] : undefined,
      };
    });
    const extenders = line.extenders.flatMap((extender) => {
      const syllable = extender.opens ? line.syllables.find((candidate) => candidate.anchor === extender.fromAnchor) : undefined;
      const x1 = syllable ? syllableX(extender.fromAnchor) + lyricTextW(syllable.text) + 0.3 : left;
      const x2 = extender.closes ? anchorEnd(placed, extender.toAnchor) - 0.8 : right;
      return x2 > x1 ? [{ x1, x2 }] : [];
    });
    return { baseline, syllables, extenders };
  });
});
</script>

<template>
  <g>
    <g v-for="(verse, index) in verses" :key="index">
      <g v-for="(syllable, syllableIndex) in verse.syllables" :key="syllableIndex">
        <text :x="syllable.x" :y="verse.baseline" :font-family="LYRIC_FONT" font-size="3.1" :fill="INK" v-bind="HALO">{{
          syllable.text
        }}</text>
        <line
          v-if="syllable.hyphen"
          :x1="syllable.hyphen[0]"
          :x2="syllable.hyphen[1]"
          :y1="verse.baseline - 0.9"
          :y2="verse.baseline - 0.9"
          :stroke="INK"
          stroke-width="0.22"
        />
      </g>
      <line
        v-for="(extender, extenderIndex) in verse.extenders"
        :key="'e' + extenderIndex"
        :x1="extender.x1"
        :x2="extender.x2"
        :y1="verse.baseline + 0.35"
        :y2="verse.baseline + 0.35"
        :stroke="INK"
        stroke-width="0.25"
      />
    </g>
  </g>
</template>
