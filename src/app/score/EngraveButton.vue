<script setup lang="ts">
/**
 * Graver : un bouton flottant en bas de l'éditeur, contre les pages. Il refait les pages d'après le
 * texte (Ctrl+Entrée), sa flèche ouvre le choix de graver automatiquement. Il n'est actif que s'il
 * y a quelque chose à graver : un texte modifié depuis la dernière gravure, sans gravure automatique.
 */
import { ChevronUp } from "@lucide/vue";
import { computed } from "vue";
import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/button-group";
import PopoverCheck from "../ui/popover/PopoverCheck.vue";
import PopoverHint from "../ui/popover/PopoverHint.vue";
import PopoverPanel from "../ui/popover/PopoverPanel.vue";

const props = defineProps<{ dirty: boolean }>();
const auto = defineModel<boolean>("auto", { required: true });
const emit = defineEmits<{ engrave: [] }>();

const title = computed(() =>
  auto.value
    ? "Mise en page automatique : les pages suivent le texte"
    : props.dirty
      ? "Mettre en page le texte modifié (Ctrl+Entrée)"
      : "Rien à mettre en page : les pages sont à jour",
);
</script>

<template>
  <!-- sur un fond blanc : éteint, le bouton pâlit sans laisser voir le texte dessous -->
  <ButtonGroup class="absolute right-6 bottom-5 z-2 bg-white rounded shadow-[0_2px_6px_rgba(0,0,0,0.18),0_6px_16px_rgba(0,0,0,0.1)]">
    <Button size="icon" :disabled="auto || !dirty" :title="title" aria-label="Mettre en page" @click="emit('engrave')">
      <svg
        viewBox="0 0 16 16"
        width="16"
        height="16"
        fill="none"
        stroke="currentColor"
        stroke-width="1.6"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <path d="M13.5 6.5A5.6 5.6 0 0 0 3 5M2.5 9.5A5.6 5.6 0 0 0 13 11" />
        <path d="M3 1.8V5h3.2M13 14.2V11H9.8" />
      </svg>
    </Button>
    <PopoverPanel label="Réglages de la mise en page" above class="w-min min-w-[240px]">
      <template #trigger>
        <Button size="icon" title="Réglages de la mise en page" aria-label="Réglages de la mise en page">
          <ChevronUp />
        </Button>
      </template>
      <PopoverCheck v-model="auto">Mettre en page automatiquement</PopoverCheck>
      <PopoverHint>La mise en page suit la saisie, peu après la dernière frappe.</PopoverHint>
    </PopoverPanel>
  </ButtonGroup>
</template>
