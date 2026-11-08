<script setup lang="ts">
/**
 * Où en est la lecture : la mesure jouée sur le nombre de mesures du morceau, comptées dans l'ordre
 * où elles se jouent (reprises et ordre de jeu compris), sa section, et la piste de lecture : une
 * barre, remplie jusqu'à la mesure jouée, coupée au début de chaque section ; puis le temps écoulé
 * sur la durée de l'écoute, au tempo choisi, points d'orgue compris (sans le décompte). Au survol,
 * une bulle dit où l'on tombera, et à quel temps ; près d'un début de section, le pointeur s'y
 * colle. Un clic ou un glissé y place la lecture (au clavier : les flèches, une mesure ; Page
 * précédente et suivante, une section ; Début et Fin).
 */
import { computed, ref, useTemplateRef } from "vue";
import { follow } from "../score/follow.ts";
import { barAt, stretched } from "./performance.ts";
import { player, secondsPerTick } from "./player.ts";
import SectionMark from "./SectionMark.vue";
import { usePlayer } from "./state.ts";

const { bpm } = defineProps<{ bpm: number }>();

/** À cette distance d'un début de section (en pixels), le pointeur s'y colle. */
const MAGNET = 6;

/** Une durée en minutes et secondes : « 1:05 ». */
const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

const playerState = usePlayer();
const track = useTemplateRef<HTMLDivElement>("track");
// la mesure sous le pointeur (la bulle), et pendant le glissé, celle où la lecture se placera au lâcher
const hovered = ref<number | null>(null);
const dragged = ref<number | null>(null);

const bars = computed(() => playerState.value.bars);
const sections = computed(() => playerState.value.sections);
const played = computed(() => playerState.value.played);
const barCount = computed(() => bars.value.length);
const current = computed(() => (played.value === null ? null : barAt(bars.value, played.value)));
const shown = computed(() => dragged.value ?? current.value);
// la place du curseur, en mesures : la mesure jouée, et ce qui en est passé
const position = computed(() => {
  if (dragged.value !== null) return dragged.value;
  if (current.value === null) return 0;
  const bar = bars.value[current.value];
  return current.value + Math.min(1, (played.value! - bar.at) / (bar.end - bar.at));
});
const sectionOf = (bar: number) => sections.value.find((section) => bar >= section.first && bar < section.first + section.count);
const label = (bar: number) => {
  const section = sectionOf(bar);
  return `mesure ${bar + 1} sur ${barCount.value}${section?.label ? `, section ${section.label}` : ""}`;
};
const percent = (bar: number) => `${(bar / barCount.value) * 100}%`;
// le temps, d'un instant joué : au tempo de l'écoute, les points d'orgue tenus
const time = (at: number) => clock(stretched(playerState.value.holds, at) * secondsPerTick(bpm));
const total = computed(() => time(bars.value[barCount.value - 1].end));
const elapsed = computed(() =>
  dragged.value !== null ? time(bars.value[dragged.value].at) : played.value === null ? null : time(played.value),
);
const shownSection = computed(() => (shown.value === null ? undefined : sectionOf(shown.value)));

function seek(bar: number) {
  follow.release();
  player.seekPlayed(bars.value[Math.max(0, Math.min(barCount.value - 1, bar))].at);
}

/** La mesure sous le pointeur ; près d'un début de section, ce début. */
function barFromX(x: number) {
  const bounds = track.value!.getBoundingClientRect();
  const near = sections.value.find((section) => Math.abs(bounds.left + (section.first / barCount.value) * bounds.width - x) <= MAGNET);
  return near ? near.first : Math.max(0, Math.min(barCount.value - 1, Math.floor(((x - bounds.left) / bounds.width) * barCount.value)));
}

function onKey(event: KeyboardEvent) {
  const bar = current.value ?? 0;
  const section = sectionOf(bar);
  const at = section ? sections.value.indexOf(section) : 0;
  const to = {
    ArrowRight: bar + 1,
    ArrowUp: bar + 1,
    ArrowLeft: bar - 1,
    ArrowDown: bar - 1,
    Home: 0,
    End: barCount.value - 1,
    PageDown: sections.value[at + 1]?.first ?? barCount.value - 1,
    PageUp: section && bar > section.first ? section.first : (sections.value[at - 1]?.first ?? 0),
  }[event.key];
  if (to === undefined) return;
  event.preventDefault();
  seek(to);
}

function press(event: PointerEvent) {
  (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  dragged.value = barFromX(event.clientX);
}
function move(event: PointerEvent) {
  const bar = barFromX(event.clientX);
  hovered.value = bar;
  if (dragged.value !== null) dragged.value = bar;
}
function release() {
  if (dragged.value !== null) seek(dragged.value);
  dragged.value = null;
}
</script>

<template>
  <span v-if="barCount" class="flex items-center gap-4 w-full">
    <!-- la mesure jouée sur le nombre de mesures, et la lettre de sa section -->
    <span
      class="flex items-center gap-1.5 text-dim text-[13px] tabular-nums whitespace-nowrap"
      title="La mesure jouée, sur les mesures du morceau dans l'ordre où elles se jouent, et sa section"
    >
      {{ shown === null ? "–" : shown + 1 }} / {{ barCount }}
      <SectionMark v-if="shownSection?.label" :label="shownSection.label" />
    </span>
    <div
      ref="track"
      class="relative flex-1 h-5 cursor-pointer touch-none rounded focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2"
      role="slider"
      tabindex="0"
      aria-label="Position dans le morceau"
      aria-valuemin="1"
      :aria-valuemax="barCount"
      :aria-valuenow="(shown ?? 0) + 1"
      :aria-valuetext="label(shown ?? 0)"
      @keydown="onKey"
      @pointerdown="press"
      @pointermove="move"
      @pointerup="release"
      @pointercancel="dragged = null"
      @pointerleave="hovered = null"
    >
      <!-- la barre, et la partie jouée, à la couleur de l'accent -->
      <span class="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-line">
        <span class="absolute inset-y-0 left-0 rounded-full bg-brand" :style="{ width: percent(position) }" />
      </span>
      <!-- le début de chaque section, sauf la première : une coupure de la barre, à la couleur du fond -->
      <span
        v-for="section in sections.slice(1)"
        :key="section.first"
        class="absolute top-1/2 h-1.5 w-0.5 -translate-x-1/2 -translate-y-1/2 bg-panel"
        :style="{ left: percent(section.first) }"
      />
      <span
        v-if="played !== null || dragged !== null"
        class="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-brand bg-white pointer-events-none"
        :style="{ left: percent(position) }"
      />
      <!-- sous le pointeur : la mesure où l'on tombera, à quel temps, et sa section -->
      <span
        v-if="hovered !== null"
        class="absolute top-full mt-2 z-30 flex items-center gap-1.5 px-2 py-1 -translate-x-1/2 bg-white border border-line rounded-md shadow-[0_4px_14px_rgba(0,0,0,0.12)] text-[13px] tabular-nums whitespace-nowrap pointer-events-none"
        :style="{ left: percent(hovered + 0.5) }"
        >mesure {{ hovered + 1 }}
        <span class="text-dim">{{ time(bars[hovered].at) }}</span>
        <SectionMark v-if="sectionOf(hovered)?.label" :label="sectionOf(hovered)!.label!" />
      </span>
    </div>
    <span class="text-dim text-[13px] tabular-nums whitespace-nowrap" title="Le temps écoulé, sur la durée de l'écoute au tempo choisi">
      {{ elapsed ?? "–" }} / {{ total }}
    </span>
  </span>
</template>
