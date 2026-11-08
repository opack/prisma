<script setup lang="ts">
/**
 * Un petit panneau ouvert depuis un bouton (le métronome, les parties, la mise en page) : le bouton
 * (slot trigger), puis le panneau, sous lui ou au-dessus, avec son titre s'il en a un et son
 * contenu. Il reste dans l'écran, et se ferme avec Échap ou par un clic ailleurs, en rendant le
 * focus au bouton. Ouvert, le focus va au panneau lui-même (pas à son premier champ) : Tab y entre.
 * Sur le popover de Reka UI.
 */
import { Popover, PopoverContent, PopoverHeader, PopoverTitle, PopoverTrigger } from ".";

/** Le focus au panneau lui-même, comme à une fenêtre, plutôt qu'à son premier champ. */
function focusPanel(event: Event) {
  event.preventDefault();
  // l'évènement vient de l'enveloppe qui place le panneau
  (event.target as HTMLElement).querySelector<HTMLElement>('[role="dialog"]')?.focus();
}

const { above = false } = defineProps<{ label: string; title?: string; above?: boolean; class?: string }>();
defineSlots<{ trigger(): unknown; default(): unknown }>();
</script>

<template>
  <Popover>
    <PopoverTrigger as-child><slot name="trigger" /></PopoverTrigger>
    <PopoverContent
      :class="['w-auto', $props.class]"
      role="dialog"
      tabindex="-1"
      :aria-label="label"
      :side="above ? 'top' : 'bottom'"
      align="end"
      :side-offset="above ? 8 : 6"
      @open-auto-focus="focusPanel"
    >
      <PopoverHeader v-if="title"
        ><PopoverTitle>{{ title }}</PopoverTitle></PopoverHeader
      >
      <slot />
    </PopoverContent>
  </Popover>
</template>
