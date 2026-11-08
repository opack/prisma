<script setup lang="ts">
/**
 * La conversion d'une partie pour la guitare ou la basse, demandée avant de convertir : la partie,
 * l'instrument, son accordage et son capo, l'octave. Le texte converti remplace le morceau, et
 * Ctrl+Z le rend.
 */
import { ref, watch } from "vue";
import { MAX_CAPO, pitchClass, stringsOf, tuningsOf } from "../../core/index.ts";
import type { ConversionOptions, NoteNames, Part } from "../../core/index.ts";
import Choices from "../ui/dialog/Choices.vue";
import Fields from "../ui/dialog/Fields.vue";
import FormDialog from "../ui/dialog/FormDialog.vue";
import NumberField from "../ui/dialog/NumberField.vue";
import SelectField from "../ui/dialog/SelectField.vue";

type Instrument = "guitar" | "electric-bass";

const INSTRUMENTS: { value: Instrument; label: string }[] = [
  { value: "guitar", label: "Guitare" },
  { value: "electric-bass", label: "Basse" },
];

const OCTAVES: { value: ConversionOptions["octave"]; label: string; hint: string }[] = [
  { value: undefined, label: "Au mieux", hint: "Prisma essaie les deux octaves et garde la plus facile à jouer." },
  { value: 0, label: "Telle qu'elle sonne", hint: "Les notes sonnent à la hauteur de l'original." },
  {
    value: -1,
    label: "Une octave plus bas",
    hint: "Comme la plupart des arrangements pour guitare : les notes écrites de l'original, qui sonnent une octave plus bas.",
  },
];

const { parts, noteNames } = defineProps<{ parts: Part[]; noteNames: NoteNames }>();
const emit = defineEmits<{ convert: [part: number, options: ConversionOptions]; close: [] }>();

/** Les cordes à vide d'un accordage, de la plus grave à l'aiguë : « mi la ré sol si mi ». */
const openNames = (instrument: Instrument, tuning: string) =>
  [...stringsOf(instrument, tuning, 0)!.open]
    .reverse()
    .map((midi) => pitchClass((midi % 12) + 1, noteNames))
    .join(" ");

const partName = (part: Part, index: number) => part.name ?? `Partie ${index + 1}`;

// de préférence la première partie qui n'est pas déjà sur des cordes
const part = ref(
  Math.max(
    0,
    parts.findIndex((candidate) => !candidate.strings),
  ),
);
const instrument = ref<Instrument>("guitar");
const tuning = ref("standard");
const capo = ref(0);
const octave = ref<ConversionOptions["octave"]>(undefined);

// un autre instrument : son accordage ordinaire ; le capo, ramené entre 0 et MAX_CAPO
watch(instrument, () => (tuning.value = "standard"));
watch(capo, (value) => (capo.value = Math.min(MAX_CAPO, Math.max(0, Math.round(Number(value) || 0)))));

function submit() {
  emit("convert", Number(part.value), { instrument: instrument.value, tuning: tuning.value, capo: capo.value, octave: octave.value });
}
</script>

<template>
  <FormDialog
    title="Convertir pour la guitare ou la basse"
    intro="Les notes de la partie passent sur les cordes, par le doigté le plus simple. C'est une proposition : vous la retouchez ensuite dans le texte."
    submit="Convertir"
    @submit="submit"
    @close="emit('close')"
  >
    <Fields>
      <SelectField v-if="parts.length > 1" v-model="part" label="Partie">
        <option v-for="(candidate, index) in parts" :key="index" :value="index">{{ partName(candidate, index) }}</option>
      </SelectField>
      <SelectField v-model="instrument" label="Instrument">
        <option v-for="choice in INSTRUMENTS" :key="choice.value" :value="choice.value">{{ choice.label }}</option>
      </SelectField>
      <SelectField v-model="tuning" label="Accordage">
        <option v-for="text in tuningsOf(instrument)" :key="text" :value="text">{{ text }} ({{ openNames(instrument, text) }})</option>
      </SelectField>
      <NumberField v-model="capo" label="Capo" :min="0" :max="MAX_CAPO" />
    </Fields>
    <Choices v-model="octave" legend="L'octave" name="octave" :options="OCTAVES" />
  </FormDialog>
</template>
