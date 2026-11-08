<script setup lang="ts" generic="T">
/** Un choix d'un panneau, parmi quelques-uns : chaque possibilité, et ce qu'elle fait, dessous. */
import PopoverHint from "./PopoverHint.vue";

export type PopoverOption<T> = { value: T; label: string; hint: string };

defineProps<{ name: string; options: PopoverOption<T>[] }>();
const value = defineModel<T>({ required: true });
</script>

<template>
  <label v-for="option in options" :key="String(option.value)" class="flex gap-2 items-start cursor-pointer whitespace-normal">
    <input class="mt-[3px] accent-brand" type="radio" :name="name" :checked="option.value === value" @change="value = option.value" />
    <span>
      {{ option.label }}
      <PopoverHint>{{ option.hint }}</PopoverHint>
    </span>
  </label>
</template>
