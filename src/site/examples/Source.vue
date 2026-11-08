<script setup lang="ts">
/**
 * Un texte Prisma, avec le bouton qui le copie en entier, en-tête compris (une icône seule, qui
 * dit un moment « Copié »).
 */
import { useClipboard } from "@vueuse/core";
import { computed } from "vue";
import { Button } from "../../app/ui/button";
import CheckIcon from "../../app/ui/icons/CheckIcon.vue";
import CopyIcon from "../../app/ui/icons/CopyIcon.vue";
import SourceText from "./SourceText.vue";

const { text, header = true } = defineProps<{ text: string; header?: boolean }>();

const shown = computed(() => (header ? text : text.replace(/^---[\s\S]*?---\n+/, "")).trimEnd());
// sans le presse-papiers moderne (une page hors https), l'ancienne copie du navigateur
const { copy, copied } = useClipboard({ copiedDuring: 1600, legacy: true });
const name = computed(() => (copied.value ? "Copié" : "Copier le texte"));
</script>

<template>
  <div class="relative justify-self-start w-fit max-w-full min-w-0">
    <SourceText with-button>{{ shown }}</SourceText>
    <Button variant="outline" class="absolute top-2 right-2" size="icon" :aria-label="name" :title="name" @click="copy(text)">
      <CheckIcon v-if="copied" />
      <CopyIcon v-else />
    </Button>
  </div>
</template>
