<script setup lang="ts">
/**
 * Des boutons collés, d'un seul cadre (les commandes de l'écoute, deux vues au choix) : leurs coins
 * arrondis aux deux bouts seulement. Sa place (class) dépend de ce qui l'entoure.
 */
defineProps<{ label?: string }>();
</script>

<template>
  <span class="inline-flex *:rounded-none *:first:rounded-l *:last:rounded-r *:not-first:-ml-px" role="group" :aria-label="label"
    ><slot
  /></span>
</template>
