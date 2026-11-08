<script setup lang="ts">
/**
 * Le tempo de l'écoute, à portée du doigt : − et + de 1 (un appui long : de 5 en 5), et entre eux
 * le champ, pour un tempo précis, avec son ↺ qui revient au tempo de la partition. Quand la place
 * manque dans la barre, il passe sous le bouton ⋯, entier. Sa place (class) dépend de ce qui l'entoure.
 */
import { ref } from "vue";
import { MAX_TEMPO, MIN_TEMPO } from "../options/piece.ts";
import { TEMPO_STEP, stepTempo } from "./tempo.ts";
import { Button } from "../ui/button";
import ButtonGroup from "../ui/button/ButtonGroup.vue";
import PlayIcon from "./PlayIcon.vue";
import { useStep } from "./useStep.ts";

const { bpm, written } = defineProps<{ bpm: number; written: number; chosen: boolean }>();
const emit = defineEmits<{ tempo: [bpm: number] }>();

/** La saisie en cours, pas encore un tempo valable. */
const draft = ref<string | null>(null);
const slower = useStep((step) => emit("tempo", stepTempo(bpm, -step)), 1, TEMPO_STEP);
const faster = useStep((step) => emit("tempo", stepTempo(bpm, step)), 1, TEMPO_STEP);
const hold = `appui long : de ${TEMPO_STEP} en ${TEMPO_STEP}`;

function edit(text: string) {
  draft.value = text;
  const typed = Number(text);
  if (Number.isInteger(typed) && typed >= MIN_TEMPO && typed <= MAX_TEMPO) emit("tempo", typed);
}

function restore() {
  emit("tempo", written);
  draft.value = null;
}
</script>

<template>
  <ButtonGroup label="Tempo">
    <Button size="icon" :disabled="bpm <= MIN_TEMPO" :title="`Plus lent, de 1 bpm (${hold})`" aria-label="Plus lent" v-on="slower">
      <PlayIcon path="M3 7.25h10v1.5H3z" />
    </Button>
    <span
      class="flex items-center h-[2.1em] touch:h-11 pr-1.5 bg-white border border-line focus-within:relative focus-within:z-1 focus-within:border-muted"
      :title="`Tempo de l'écoute, en temps par minute (${MIN_TEMPO} à ${MAX_TEMPO})`"
    >
      <input
        type="number"
        :min="MIN_TEMPO"
        :max="MAX_TEMPO"
        :value="draft ?? bpm"
        class="w-[2.6em] px-1 py-0 leading-none text-center text-[1.2em] font-semibold tabular-nums bg-transparent border-0 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
        aria-label="Tempo de l'écoute"
        @input="edit(($event.target as HTMLInputElement).value)"
        @blur="draft = null"
      />
      <button
        v-if="chosen"
        class="m-0 px-1 py-0 text-[1em] leading-none text-muted bg-none border-0 cursor-pointer hover:text-ink"
        :title="`Revenir au tempo de la partition (${written} bpm)`"
        aria-label="Revenir au tempo de la partition"
        @click="restore"
      >
        ↺
      </button>
      <span class="ml-0.5 text-muted text-[0.9em] compact:hidden">bpm</span>
    </span>
    <Button size="icon" :disabled="bpm >= MAX_TEMPO" :title="`Plus rapide, de 1 bpm (${hold})`" aria-label="Plus rapide" v-on="faster">
      <PlayIcon path="M7.25 3h1.5v4.25H13v1.5H8.75V13h-1.5V8.75H3v-1.5h4.25z" />
    </Button>
  </ButtonGroup>
</template>
