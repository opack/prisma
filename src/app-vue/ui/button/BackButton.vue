<script setup lang="ts">
/** Le retour à la partition, en haut à gauche d'un panneau (la bibliothèque, la référence) : il reste en vue. */
import BackIcon from "../icons/BackIcon.vue";
import { Button } from ".";

const { shortcut } = defineProps<{ shortcut?: string }>();
const label = "Retour à la partition";
</script>

<template>
  <Button class="sticky top-3 z-1 mt-3 ml-4" size="icon" :title="`${label}${shortcut ? ` (${shortcut})` : ''}`" :aria-label="label">
    <BackIcon />
  </Button>
</template>
