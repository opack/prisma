<script setup lang="ts">
/**
 * Fichier › Nouveau : le modèle du morceau à commencer, vide, pour le piano ou pour la guitare.
 * Le morceau en cours est remplacé après confirmation, s'il a des modifications non enregistrées.
 */
import { ref } from "vue";
import { TEMPLATES } from "../../app/editor/templates.ts";
import type { Template } from "../../app/editor/templates.ts";
import Choices from "../ui/dialog/Choices.vue";
import FormDialog from "../ui/dialog/FormDialog.vue";

const emit = defineEmits<{ create: [template: Template]; close: [] }>();

const OPTIONS = TEMPLATES.map((template) => ({ value: template.id, label: template.label, hint: template.hint }));
const chosen = ref(TEMPLATES[1].id);
</script>

<template>
  <FormDialog
    title="Nouveau morceau"
    submit="Créer"
    @submit="
      emit(
        'create',
        TEMPLATES.find((template) => template.id === chosen)!,
      )
    "
    @close="emit('close')"
  >
    <Choices v-model="chosen" legend="Pour commencer" name="template" :options="OPTIONS" />
  </FormDialog>
</template>
