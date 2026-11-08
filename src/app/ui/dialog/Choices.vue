<script setup lang="ts" generic="T">
/**
 * Un choix d'une fenêtre, parmi quelques-uns, sous son nom : chaque possibilité en carte, son nom et
 * ce qu'elle fait ; celle qui est prise, à la couleur de l'accent. Ce qui la complète (une case à
 * cocher) suit les cartes, dans le slot.
 */
export type ChoiceOption<T> = { value: T; label: string; hint: string };

defineProps<{ legend: string; name: string; options: ChoiceOption<T>[] }>();
const value = defineModel<T>({ required: true });
</script>

<template>
  <fieldset class="grid gap-2 m-0 p-0 border-0">
    <legend class="mb-1.5 p-0 font-semibold">{{ legend }}</legend>
    <label
      v-for="option in options"
      :key="String(option.value)"
      :class="[
        'flex gap-2.5 items-start px-3 py-2.5 border rounded-md cursor-pointer',
        option.value === value ? 'border-brand bg-brand-7' : 'border-line bg-white',
      ]"
    >
      <input
        class="mt-[3px] mb-0 mx-0 accent-brand"
        type="radio"
        :name="name"
        :checked="option.value === value"
        @change="value = option.value"
      />
      <span>
        <span class="block font-semibold">{{ option.label }}</span>
        <span class="block mt-0.5 text-dim text-[0.92em] leading-[1.35]">{{ option.hint }}</span>
      </span>
    </label>
    <slot />
  </fieldset>
</template>
