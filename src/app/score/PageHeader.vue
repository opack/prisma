<script setup lang="ts">
/**
 * L'en-tête de la première page : le titre, le sous-titre, le compositeur à droite, et à gauche, l'un
 * sous l'autre, le tempo et la tonalité (chacun son signe, puis sa valeur ; le dernier sur la ligne
 * du compositeur). Les signes sont dessinés en millimètres sur la ligne du texte : ils ont la hauteur
 * d'un chiffre, centrés comme lui.
 */
import { computed } from "vue";
import { METRICS, PAGE } from "./engrave.ts";
import type { ScoreNames } from "../options/options.ts";
import { engravedNames } from "../options/options.ts";
import { keyName, parseKey, prismaKey } from "../../core/key.ts";
import type { Meta } from "../../core/index.ts";
import { INK } from "./drawing.ts";

const props = defineProps<{ meta: Meta; names: ScoreNames }>();

const LINE = 4.6;
/** La ligne du compositeur, sous le sous-titre s'il y en a un. */
const composerY = computed(() => PAGE.marginTop + 12 + (props.meta.subtitle ? METRICS.subtitleH : 0));

const marks = computed(() => {
  const { meta } = props;
  const key = meta.key ? parseKey(meta.key) : undefined;
  const marks = [
    ...(meta.bpm ? [{ icon: "metronome", text: String(meta.bpm), title: `tempo : ${meta.bpm} temps par minute` }] : []),
    // la tonalité, comme dans un titre : sa forme Prisma (« 10:m »), ou son nom (« la mineur », « Am »), selon l'option
    ...(key ? [{ icon: "key", text: keyName(key, engravedNames(props.names)) || prismaKey(key), title: "tonalité" }] : []),
  ];
  return marks.map((mark, index) => ({ ...mark, y: composerY.value - (marks.length - 1 - index) * LINE }));
});
</script>

<template>
  <g>
    <text v-if="meta.title" :x="PAGE.w / 2" :y="PAGE.marginTop + 6" font-size="6.4" font-weight="700" text-anchor="middle" :fill="INK">{{
      meta.title
    }}</text>
    <text v-if="meta.subtitle" :x="PAGE.w / 2" :y="PAGE.marginTop + 12" font-size="3.8" text-anchor="middle" :fill="INK">{{
      meta.subtitle
    }}</text>
    <text v-if="meta.composer" :x="PAGE.w - PAGE.marginX" :y="composerY" font-size="3.4" text-anchor="end" :fill="INK">{{
      meta.composer
    }}</text>
    <g v-for="mark in marks" :key="mark.title">
      <title>{{ mark.title }}</title>
      <g :transform="`translate(${PAGE.marginX} ${mark.y})`">
        <!-- un métronome : le tempo -->
        <g v-if="mark.icon === 'metronome'" fill="none" :stroke="INK" stroke-width="0.28" stroke-linejoin="round" stroke-linecap="round">
          <path d="M0 0 L0.65 -2 L1.65 -2 L2.3 0 Z" />
          <path d="M1.15 -0.45 L1.95 -2.2" />
        </g>
        <!-- une clé : la tonalité -->
        <g v-else fill="none" :stroke="INK" stroke-width="0.28" stroke-linecap="round">
          <circle cx="0.7" cy="-1.1" r="0.65" />
          <path d="M1.35 -1.1 H3 M2.35 -1.1 V-0.45 M2.85 -1.1 V-0.6" />
        </g>
      </g>
      <text :x="PAGE.marginX + 4.4" :y="mark.y" font-size="3.2" :fill="INK">{{ mark.text }}</text>
    </g>
  </g>
</template>
