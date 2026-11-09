<script setup lang="ts">
/** Une case à cocher d'une fenêtre, en retrait sous les choix qu'elle complète. */
const checked = defineModel<boolean>({ required: true });
</script>

<template>
  <label class="flex gap-2 items-center mt-0.5 ml-3 cursor-pointer">
    <input v-model="checked" class="m-0 accent-brand" type="checkbox" />
    <slot />
  </label>
</template>
