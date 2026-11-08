<script setup lang="ts">
/**
 * Un exemple du site : un texte .prisma gravé par le vrai moteur de gravure, comme dans la
 * référence. Il montre sa partition, ou à la demande son texte, à copier pour le coller dans
 * l'application : les deux disent la même chose.
 */
import { ref } from "vue";
import type { RenderOptions } from "../../app/options/options.ts";
import { frame } from "./frame.ts";
import Score from "./Score.vue";
import Source from "./Source.vue";

defineProps<{ text: string; options?: Partial<RenderOptions>; scale?: number; label: string; guide?: boolean }>();

const VIEWS = [
  ["score", "Partition"],
  ["text", "Texte"],
] as const;
const view = ref<(typeof VIEWS)[number][0]>("score");
</script>

<template>
  <figure :class="frame(guide)" :aria-label="label">
    <div class="flex justify-end justify-self-stretch gap-0.5 -mt-1.5 -mr-1.5 mb-2" role="tablist" aria-label="Afficher">
      <button
        v-for="[target, name] in VIEWS"
        :key="target"
        type="button"
        role="tab"
        :aria-selected="view === target"
        :class="[
          'text-[0.85rem] px-2.5 py-[3px] border-0 rounded-[5px] cursor-pointer',
          view === target ? 'bg-panel text-ink font-bold' : 'bg-transparent text-dim',
        ]"
        @click="view = target"
      >
        {{ name }}
      </button>
    </div>
    <Score v-if="view === 'score'" :text="text" :options="options" :scale="scale" />
    <Source v-else :text="text" />
  </figure>
</template>
