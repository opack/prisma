<script setup lang="ts">
/**
 * Le métronome : un bouton qui l'allume ou le coupe, et sa flèche, qui ouvre le choix de ce qu'il
 * bat (l'option « Battre », la même que dans les options).
 */
import { CLICK_GRIDS } from "../options/options.ts";
import type { ClickGrid } from "./performance.ts";
import { Button } from "../ui/button";
import { ButtonGroup } from "../ui/button-group";
import PopoverChoices from "../ui/popover/PopoverChoices.vue";
import PopoverPanel from "../ui/popover/PopoverPanel.vue";
import CaretIcon from "./CaretIcon.vue";
import PlayIcon from "./PlayIcon.vue";

const metronome = defineModel<boolean>("metronome", { required: true });
const clickGrid = defineModel<ClickGrid>("clickGrid", { required: true });
</script>

<template>
  <ButtonGroup>
    <Button
      variant="outline"
      size="icon"
      :pressed="metronome"
      :title="metronome ? 'Métronome : marque les temps' : 'Métronome : coupé'"
      aria-label="Métronome"
      @click="metronome = !metronome"
    >
      <PlayIcon path="M6.2 1.5h3.6L13 14.5H3zM7 4.5l-.9 8h3.8l-.9-8zM8 11.8 12.6 3.6l.9.5-4.4 8z" />
    </Button>
    <PopoverPanel label="Battre" title="Battre" class="w-[280px]">
      <template #trigger>
        <Button variant="outline" size="icon-sm" title="Ce que bat le métronome" aria-label="Battre"><CaretIcon /></Button>
      </template>
      <PopoverChoices v-model="clickGrid" name="click-grid-bar" :options="CLICK_GRIDS" />
    </PopoverPanel>
  </ButtonGroup>
</template>
