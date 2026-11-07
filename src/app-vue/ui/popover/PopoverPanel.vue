<script setup lang="ts">
/**
 * Un petit panneau ouvert depuis un bouton (le métronome, les parties, la mise en page) : le bouton
 * (slot trigger), puis le panneau, sous lui ou au-dessus, avec son titre s'il en a un et son
 * contenu. Il reste dans l'écran, et se ferme avec Échap ou par un clic ailleurs, en rendant le
 * focus au bouton. Ouvert, le focus va au panneau lui-même (pas à son premier champ) : Tab y entre.
 * Sur le popover de Reka UI.
 */
import { Popover, PopoverContent, PopoverTrigger } from ".";

/** Le focus au panneau, comme une fenêtre de React Aria, plutôt qu'à son premier champ. */
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
      :class="[
        'grid gap-1.5 w-auto px-3 py-2.5 bg-white border border-line rounded-md ring-0 shadow-[0_6px_20px_rgba(0,0,0,0.12)] text-ink text-[length:inherit]',
        $props.class,
      ]"
      role="dialog"
      tabindex="-1"
      :aria-label="label"
      :side="above ? 'top' : 'bottom'"
      align="end"
      :side-offset="above ? 8 : 6"
      @open-auto-focus="focusPanel"
    >
      <p v-if="title" class="mt-0 mb-0.5 font-semibold">{{ title }}</p>
      <slot />
    </PopoverContent>
  </Popover>
</template>
