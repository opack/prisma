<script setup lang="ts">
/**
 * La bande des nuances d'une portée : les effets (l'étouffé de la paume, « P.M. » puis un trait
 * pointillé jusqu'à sa fin, fermé d'un crochet ; le vibrato, une ondulation), les soufflets, puis
 * les nuances (p, mf…) et les textes (cresc., dolce…). Un soufflet coupé par un changement de
 * système garde son ouverture au point de coupure.
 */
import { computed } from "vue";
import { METRICS } from "../engrave.ts";
import type { PlacedSystem } from "../engrave.ts";
import { markWidth, trillPath } from "../geometry.ts";
import type { Voice } from "../../../core/index.ts";
import { DYNAMIC_FONT, HALO, INK, WAVE } from "../drawing.ts";
import { anchorEnd, anchorX } from "./system.ts";

const props = defineProps<{ placed: PlacedSystem; voice: Voice; top: number }>();

const middle = computed(() => props.top + METRICS.voiceH / 2);
const baseline = computed(() => props.top + METRICS.voiceH * 0.7);
/** La demi-ouverture la plus grande d'un soufflet. */
const OPENING = 0.95;

const effects = computed(() =>
  props.voice.effects.map((effect) => {
    const x1 = anchorX(props.placed, effect.fromAnchor) + 0.5;
    const x2 = anchorEnd(props.placed, effect.toAnchor) - 0.6;
    if (effect.kind === "vibrato") return { kind: "vibrato" as const, wave: trillPath(x1, x2, middle.value) };
    const label = effect.opens ? "P.M." : "(P.M.)";
    const lineX = x1 + label.length * 1.45 + 0.5;
    return { kind: "palmMute" as const, x1, x2, label, lineX, closes: effect.closes };
  }),
);

const hairpins = computed(() =>
  props.voice.hairpins.map((hairpin) => {
    const x1 = anchorX(props.placed, hairpin.fromAnchor) + (hairpin.from === 0 ? 0.5 : 0);
    const x2 = anchorEnd(props.placed, hairpin.toAnchor) - (hairpin.to === 1 ? 0.6 : 0);
    const opening = (fraction: number) => (hairpin.kind === "<" ? fraction : 1 - fraction) * OPENING;
    const start = opening(hairpin.from),
      end = opening(hairpin.to);
    const cy = middle.value;
    return `M ${x2} ${cy - end} L ${x1} ${cy - start} ${start === 0 ? "" : `M ${x1} ${cy + start}`} L ${x2} ${cy + end}`;
  }),
);

/** Les nuances et les textes ; plusieurs sur une même case (« pp » puis « con sordina ») : à la suite. L'arpège et les articulations se dessinent sur l'accord. */
const marks = computed(() => {
  const written = props.voice.marks.filter((mark) => mark.kind !== "arpeggio" && mark.kind !== "articulation");
  return written.map((mark, index) => {
    const before = written.slice(0, index).filter((other) => other.anchor === mark.anchor);
    const x = anchorX(props.placed, mark.anchor) + before.reduce((total, other) => total + markWidth(other.text, other.kind) + 1, 0);
    return { ...mark, x };
  });
});
</script>

<template>
  <g>
    <template v-for="(effect, index) in effects" :key="'e' + index">
      <path v-if="effect.kind === 'vibrato'" :d="effect.wave" v-bind="WAVE" />
      <g v-else>
        <text :x="effect.x1" :y="baseline" font-size="2.9" font-weight="700" :fill="INK">{{ effect.label }}</text>
        <line
          v-if="effect.lineX < effect.x2"
          :x1="effect.lineX"
          :x2="effect.x2"
          :y1="middle"
          :y2="middle"
          :stroke="INK"
          stroke-width="0.24"
          stroke-dasharray="0.7 0.5"
        />
        <line v-if="effect.closes" :x1="effect.x2" :x2="effect.x2" :y1="middle - 0.9" :y2="middle" :stroke="INK" stroke-width="0.24" />
      </g>
    </template>
    <path
      v-for="(hairpin, index) in hairpins"
      :key="'h' + index"
      :d="hairpin"
      fill="none"
      :stroke="INK"
      stroke-width="0.28"
      stroke-linejoin="round"
    />
    <template v-for="(mark, index) in marks" :key="'m' + index">
      <text
        v-if="mark.kind === 'dynamic'"
        :x="mark.x + 0.9"
        :y="baseline"
        :font-family="DYNAMIC_FONT"
        font-size="3.6"
        font-weight="700"
        font-style="italic"
        :fill="INK"
        v-bind="HALO"
      >
        {{ mark.text }}
      </text>
      <text v-else :x="mark.x + 0.7" :y="baseline" font-size="2.8" font-style="italic" :fill="INK" v-bind="HALO">{{ mark.text }}</text>
    </template>
  </g>
</template>
