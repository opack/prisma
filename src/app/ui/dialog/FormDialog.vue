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
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from ".";

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
    <DialogContent :show-close-button="false" @open-auto-focus="placeFocus">
      <form class="grid gap-4" @submit.prevent="emit('submit')">
        <DialogHeader>
          <DialogTitle>{{ title }}</DialogTitle>
          <DialogDescription v-if="intro || $slots.intro">
            <slot name="intro">{{ intro }}</slot>
          </DialogDescription>
        </DialogHeader>
        <slot />
        <DialogFooter>
          <Button v-if="cancel !== null" variant="outline" @click="emit('close')">{{ cancel }}</Button>
          <slot name="actions" />
          <Button type="submit">{{ submit }}</Button>
        </DialogFooter>
      </form>
    </DialogContent>
  </Dialog>
</template>
