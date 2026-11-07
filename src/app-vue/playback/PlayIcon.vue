<script setup lang="ts">
/** L'icône d'un bouton de l'écoute, dessinée dans un carré de 16. */
defineProps<{ path: string }>();
</script>

<template>
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path :d="path" fill="currentColor" fill-rule="evenodd" />
  </svg>
</template>
