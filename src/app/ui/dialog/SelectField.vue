<script setup lang="ts">
/** Une liste déroulante d'une fenêtre, sous son nom ; ses possibilités, des <option>, dans le slot. */
import { FIELD, FIELD_LABEL } from "./field.ts";

defineProps<{ label: string }>();
const value = defineModel<string | number>({ required: true });
</script>

<template>
  <label :class="FIELD_LABEL">
    {{ label }}
    <select v-model="value" :class="FIELD">
      <slot />
    </select>
  </label>
</template>
