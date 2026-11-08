<script setup lang="ts">
/** Une option à cocher : la case et son texte, puis l'explication. */
import type { PieceKey } from "./piece.ts";
import OptionRow from "./OptionRow.vue";

defineProps<{ id: string; label: string; text: string; hint?: string; pieceKey?: PieceKey }>();
const checked = defineModel<boolean>({ required: true });
</script>

<template>
  <OptionRow :label="label" :hint="hint" :piece-key="pieceKey">
    <label class="inline-flex items-center gap-1.5 cursor-pointer">
      <input :id="id" v-model="checked" type="checkbox" />
      {{ text }}
    </label>
  </OptionRow>
</template>
