<script setup lang="ts" generic="T extends string">
/** Une option à liste : la liste déroulante, et l'explication du choix en cours ; devant, une icône du choix (slot icon). */
import { computed } from "vue";
import type { Option } from "./choices.ts";
import type { PieceKey } from "./piece.ts";
import OptionRow from "./OptionRow.vue";

const { options } = defineProps<{ id: string; label: string; options: Option<T>[]; pieceKey?: PieceKey }>();
const value = defineModel<T>({ required: true });
defineSlots<{ icon?(props: { value: T }): unknown }>();

const current = computed(() => options.find((option) => option.value === value.value) ?? options[0]);
</script>

<template>
  <OptionRow :label="label" :for="id" :hint="current.hint" :piece-key="pieceKey">
    <slot name="icon" :value="current.value" />
    <select
      :id="id"
      class="flex-1 min-w-0 px-1.5 py-1 bg-white border border-line rounded"
      :value="current.value"
      @change="value = ($event.target as HTMLSelectElement).value as T"
    >
      <option v-for="choice in options" :key="choice.value" :value="choice.value">{{ choice.label }}</option>
    </select>
  </OptionRow>
</template>
