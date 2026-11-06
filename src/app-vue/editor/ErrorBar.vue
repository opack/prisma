<script setup lang="ts">
/**
 * Sous l'éditeur, l'erreur du texte : un clic y mène ; s'il y en a plusieurs, on passe de l'une à
 * l'autre (F8 et Maj+F8 dans l'éditeur aussi).
 */
import { computed } from "vue";
import type { Problem } from "../../app/files/parse.ts";
import { Button } from "../ui/button";
import Message from "./Message.vue";

const props = defineProps<{ problems: Problem[]; shown: number }>();
const emit = defineEmits<{ goTo: [line?: number, column?: number]; show: [index: number] }>();
const problem = computed(() => props.problems[props.shown]);
</script>

<template>
  <div class="flex items-center gap-2 min-w-0 border-t border-error bg-error-bg text-error">
    <button
      class="flex-1 min-w-0 text-left px-4 py-2.5 cursor-pointer"
      title="aller à l'erreur"
      @click="emit('goTo', problem.line, problem.column)"
    >
      <Message :text="problem.message" />
    </button>
    <span v-if="problems.length > 1" class="shrink-0 flex items-center gap-1 pr-2.5 tabular-nums text-[13px] whitespace-nowrap">
      <Button size="small" title="erreur précédente (Maj+F8 dans l'éditeur)" aria-label="Erreur précédente" @click="emit('show', shown - 1)"
        >‹</Button
      >
      <span>{{ shown + 1 }}/{{ problems.length }}</span>
      <Button size="small" title="erreur suivante (F8 dans l'éditeur)" aria-label="Erreur suivante" @click="emit('show', shown + 1)"
        >›</Button
      >
    </span>
  </div>
</template>
