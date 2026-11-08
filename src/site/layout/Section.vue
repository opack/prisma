<script setup lang="ts">
/** Une section d'une page, espacée ; la première, sous le haut de la page, moins espacée en haut. */
defineProps<{ id?: string; first?: boolean }>();
</script>

<template>
  <section :id="id" :class="first ? 'pt-10 pb-14 narrow:pb-10' : 'py-14 narrow:py-10'"><slot /></section>
</template>
