<script setup lang="ts">
/**
 * Les options de l'export MusicXML, demandées avant d'exporter : la façon d'écrire l'ordre de jeu
 * et, en reprises, les lettres des sections. Le dernier choix est retenu d'un export à l'autre.
 */
import { ref } from "vue";
import type { ExportOptions } from "../../core/index.ts";
import Check from "../ui/dialog/Check.vue";
import Choices from "../ui/dialog/Choices.vue";
import FormDialog from "../ui/dialog/FormDialog.vue";

const KEY = "prisma:export";

type Repeats = NonNullable<ExportOptions["repeats"]>;

const REPEATS: { value: Repeats; label: string; hint: string }[] = [
  {
    value: "sections",
    label: "Les sections de Prisma, dans l'ordre de jeu",
    hint: "Chaque section s'écrit à la suite, comme Prisma l'affiche : on joue d'un bout à l'autre.",
  },
  {
    value: "traditional",
    label: "Des reprises et des cases, comme une partition classique",
    hint: "Quand l'ordre de jeu s'y prête (une reprise, des cases 1 et 2) ; le reste s'écrit à la suite.",
  },
];

const emit = defineEmits<{ export: [options: ExportOptions]; close: [] }>();

/** Le dernier choix, relu tel qu'il est permis. */
function load(): { repeats: Repeats; letters: boolean } {
  try {
    const stored = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    const repeats = REPEATS.find((choice) => choice.value === stored.repeats)?.value ?? "sections";
    return { repeats, letters: stored.letters !== false };
  } catch {
    return { repeats: "sections", letters: true };
  }
}

const initial = load();
const repeats = ref(initial.repeats);
const letters = ref(initial.letters);

function submit() {
  const options: ExportOptions = { repeats: repeats.value, letters: letters.value };
  try {
    localStorage.setItem(KEY, JSON.stringify(options));
  } catch {
    /* stockage indisponible : le choix vaut pour cet export */
  }
  emit("export", options);
}
</script>

<template>
  <FormDialog title="Exporter en MusicXML" submit="Exporter" @submit="submit" @close="emit('close')">
    <Choices v-model="repeats" legend="L'ordre de jeu" name="repeats" :options="REPEATS">
      <Check v-if="repeats === 'traditional'" v-model="letters">Écrire aussi la lettre de chaque section (A, B…)</Check>
    </Choices>
  </FormDialog>
</template>
