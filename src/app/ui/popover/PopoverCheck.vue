<script setup lang="ts">
/** Une case à cocher d'un panneau, et son texte ; sa place (class) dépend de ce qui l'entoure. */
const checked = defineModel<boolean>({ required: true });
</script>

<template>
  <label class="flex gap-2 items-center cursor-pointer whitespace-nowrap">
    <input v-model="checked" type="checkbox" />
    <slot />
  </label>
</template>
