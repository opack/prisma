<script setup lang="ts">
/** Un nombre à saisir dans une fenêtre, sous son nom. */
import { FIELD, FIELD_LABEL } from "./field.ts";

defineProps<{ label: string; min: number; max: number }>();
const value = defineModel<number>({ required: true });
</script>

<template>
  <label :class="FIELD_LABEL">
    {{ label }}
    <input v-model.number="value" :class="FIELD" type="number" :min="min" :max="max" />
  </label>
</template>
