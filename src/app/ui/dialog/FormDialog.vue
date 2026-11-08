<script setup lang="ts">
/**
 * Une fenêtre de dialogue (Nouveau, l'export, la conversion, un morceau reçu) : au centre, son
 * titre, son contenu, puis Annuler (sauf cancel à null : une fenêtre qui ne fait que montrer), d'autres
 * actions s'il y en a (slot actions), et le bouton qui valide. Elle s'ouvre en modale ; Échap ou
 * Annuler la ferme. Ouverte au clavier, le premier champ a le focus (ou le bouton qui valide, pour
 * une fenêtre sans champ : focusSubmit) ; à la souris ou au doigt, la fenêtre seule, sans contour,
 * sauf pour un champ à remplir aussitôt (focusField : un lien à coller). Sur le dialogue de Reka UI.
 */
import { Button } from "../button";
import { fromKeyboard } from "../keyboardModality.ts";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from ".";

const {
  cancel = "Annuler",
  focusSubmit = false,
  focusField = false,
} = defineProps<{ title: string; intro?: string; submit: string; cancel?: string | null; focusSubmit?: boolean; focusField?: boolean }>();
const emit = defineEmits<{ submit: []; close: [] }>();
defineSlots<{ default(): unknown; intro?(): unknown; actions?(): unknown }>();

function placeFocus(event: Event) {
  if (focusField) return;
  event.preventDefault();
  const content = event.target as HTMLElement;
  const target = !fromKeyboard()
    ? null
    : content.querySelector<HTMLElement>(focusSubmit ? "button[type=submit]" : "input, select, textarea");
  (target ?? content).focus();
}
</script>

<template>
  <Dialog :open="true" @update:open="(open) => open || emit('close')">
    <DialogContent
      :show-close-button="false"
      class="block gap-0 inset-0 m-auto h-fit translate-x-0 translate-y-0 max-w-none sm:max-w-none w-[min(460px,calc(100%_-_32px))] p-0 border border-line rounded-lg ring-0 bg-panel text-ink text-[length:inherit] shadow-[0_12px_40px_rgba(0,0,0,0.18)]"
      @open-auto-focus="placeFocus"
    >
      <form class="grid gap-3.5 px-5 pt-4.5 pb-4" @submit.prevent="emit('submit')">
        <DialogTitle class="m-0 text-[1.05rem] leading-[inherit] font-bold">{{ title }}</DialogTitle>
        <DialogDescription v-if="intro || $slots.intro" class="-mt-1.5 mb-0 text-muted text-[length:inherit] leading-[1.4]">
          <slot name="intro">{{ intro }}</slot>
        </DialogDescription>
        <slot />
        <div class="flex flex-wrap justify-end gap-2">
          <Button v-if="cancel !== null" @click="emit('close')">{{ cancel }}</Button>
          <slot name="actions" />
          <Button type="submit" kind="primary">{{ submit }}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
</template>
