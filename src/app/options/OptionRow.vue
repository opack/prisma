<script setup lang="ts">
/**
 * Une ligne du panneau des options : son nom, la commande (slot), puis l'explication du choix en
 * cours ; pour une option du rendu (pieceKey), sa portée : son nom à l'accent quand la partition la
 * définit, la commande estompée quand elle suit l'option générale.
 */
import { toRef } from "vue";
import type { PieceKey } from "./piece.ts";
import { usePieceScope } from "./scope.ts";
import ScopeLine from "./ScopeLine.vue";

const props = defineProps<{ label: string; for?: string; hint?: string; pieceKey?: PieceKey }>();
defineSlots<{ default(): unknown }>();

const { mark } = usePieceScope(toRef(props, "pieceKey"));
</script>

<template>
  <div class="group grid grid-cols-[8.5em_1fr] items-center gap-x-3 gap-y-0.5 py-2.5 border-b border-[#ecece8] last:border-b-0">
    <label :class="['font-semibold', mark === 'own' || mark === 'overridden' ? 'text-accent' : '']" :for="props.for">{{ label }}</label>
    <div :class="['flex items-center gap-2 min-w-0', mark === 'follows' ? 'opacity-75' : '']">
      <slot />
    </div>
    <p v-if="hint" class="col-start-2 m-0 text-muted text-[0.9em] leading-[1.35]">{{ hint }}</p>
    <ScopeLine v-if="pieceKey" :piece-key="pieceKey" />
  </div>
</template>
