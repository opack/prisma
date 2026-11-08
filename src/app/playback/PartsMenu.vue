<script setup lang="ts">
/**
 * Les portées jouées : un bouton qui coupe ou rend la musique d'un clic (le métronome seul reste),
 * et sa flèche, qui ouvre la liste des parties, chacune avec son instrument et son volume, et de
 * leurs portées, chacune à cocher pour l'entendre ou la rendre muette (pour la jouer soi-même). La
 * musique rendue retrouve les portées choisies avant.
 */
import { computed, watch } from "vue";
import type { Score } from "../../core/index.ts";
import { MAX_VOLUME, MIN_VOLUME } from "../options/piece.ts";
import { INSTRUMENTS, PIANO, instrumentLabel, scoreInstrument } from "./instruments.ts";
import { staffNames } from "./staves.ts";
import { Button } from "../ui/button";
import ButtonGroup from "../ui/button/ButtonGroup.vue";
import PopoverCheck from "../ui/popover/PopoverCheck.vue";
import PopoverHint from "../ui/popover/PopoverHint.vue";
import PopoverPanel from "../ui/popover/PopoverPanel.vue";
import CaretIcon from "./CaretIcon.vue";
import PlayIcon from "./PlayIcon.vue";

const { score, muted, instruments, volumes } = defineProps<{
  score?: Score;
  /** Les portées muettes (leurs numéros) : on les joue soi-même pendant que l'app joue les autres. */
  muted: number[];
  /** L'instrument de chaque partie. */
  instruments: string[];
  /** Le volume de chaque partie, en décibels (0 tel quel). */
  volumes: number[];
}>();
const emit = defineEmits<{
  muted: [staves: number[]];
  instrument: [part: number, instrument: string];
  volume: [part: number, decibels: number];
}>();

/** Une ligne de la liste des parties : la partie (ou sa portée), son instrument, son volume. */
const ROW = "flex items-center justify-between gap-2.5";

const names = computed(() => (score ? staffNames(score.parts) : []));
// les portées de chaque partie, nommées sans le nom de la partie quand il les précède
const groups = computed(() => {
  let staffIndex = 0;
  return (score?.parts ?? []).map((part, index) => ({
    name: part.name,
    // l'instrument de la partition (écrit après le nom de la partie, ou deviné) ; un autre choix se rétablit d'un clic
    fromScore: scoreInstrument(part),
    staves: Array.from({ length: part.staves }, () => {
      const full = names.value[staffIndex];
      const label = part.staves > 1 && full.includes(" — ") ? full.split(" — ")[1] : full;
      return { staff: staffIndex++, label: part.staves > 1 ? label[0].toUpperCase() + label.slice(1) : label };
    }),
    instrument: instruments[index] ?? PIANO,
    decibels: volumes[index] ?? 0,
  }));
});
const all = computed(() => names.value.map((_, staff) => staff));
const silent = computed(() => names.value.length > 0 && muted.length >= names.value.length);
const title = computed(() =>
  !muted.length
    ? "Musique : toutes les portées jouées"
    : silent.value
      ? "Musique : coupée (le métronome seul)"
      : `Musique : ${muted.length} portée${muted.length > 1 ? "s" : ""} muette${muted.length > 1 ? "s" : ""} sur ${names.value.length}`,
);

// le dernier choix où une portée au moins jouait : la musique rendue le retrouve
let before: number[] = [];
watch(
  () => muted,
  (staves) => silent.value || (before = staves),
  { immediate: true },
);
const music = () => emit("muted", silent.value ? before : all.value);
const toggle = (staff: number) =>
  emit(
    "muted",
    muted.includes(staff) ? muted.filter((other) => other !== staff) : [...muted, staff].sort((first, second) => first - second),
  );
const decibelsText = (decibels: number) => `${decibels > 0 ? `+${decibels}` : decibels < 0 ? `−${-decibels}` : "0"} dB`;
const suffix = (name?: string) => (name ? ` : ${name}` : "");
</script>

<template>
  <ButtonGroup class="ml-[5px]">
    <Button size="icon" :pressed="!silent" :disabled="!names.length" :title="title" aria-label="Musique" @click="music">
      <PlayIcon path="M6 2.5 13 1v9.2a2.3 2.3 0 1 1-1.5-2.15V4.1L7.5 5v6.7A2.3 2.3 0 1 1 6 9.55z" />
    </Button>
    <PopoverPanel label="Parties et instruments" title="Parties et instruments" class="w-min min-w-[300px]">
      <template #trigger>
        <Button
          size="caret"
          :disabled="!names.length"
          title="Portées jouées et instruments des parties"
          aria-label="Parties et instruments"
        >
          <CaretIcon />
        </Button>
      </template>
      <div v-for="(group, index) in groups" :key="index" :class="group.staves.length === 1 ? ROW : 'grid gap-1'">
        <div :class="group.staves.length === 1 ? 'contents' : ROW">
          <!-- une partie d'une portée : une seule ligne ; sinon son nom et son instrument, puis ses portées -->
          <PopoverCheck
            v-if="group.staves.length === 1"
            :model-value="!muted.includes(group.staves[0].staff)"
            @update:model-value="toggle(group.staves[0].staff)"
          >
            {{ group.staves[0].label }}
          </PopoverCheck>
          <span v-else class="font-semibold">{{ group.name || "Partie" }}</span>
          <span class="inline-flex items-center gap-1">
            <select
              class="max-w-[11em] px-1 py-0.5 bg-white border border-line rounded"
              :value="group.instrument"
              :aria-label="`Instrument${suffix(group.name)}`"
              :title="
                group.instrument !== group.fromScore
                  ? `Choisi pour ce morceau ; la partition donne : ${instrumentLabel(group.fromScore)}`
                  : 'L\'instrument de la partie, à l\'écoute, tel que la partition le donne'
              "
              @change="emit('instrument', index, ($event.target as HTMLSelectElement).value)"
            >
              <option v-for="choice in INSTRUMENTS" :key="choice.id" :value="choice.id">{{ choice.label }}</option>
            </select>
            <Button
              v-if="group.instrument !== group.fromScore"
              size="small"
              :title="`Reprendre l'instrument de la partition (${instrumentLabel(group.fromScore)})`"
              aria-label="Reprendre l'instrument de la partition"
              @click="emit('instrument', index, group.fromScore)"
            >
              ↺
            </Button>
          </span>
          <!-- le volume de la partie : un réglage fin, pour équilibrer les parties (un double-clic le remet à 0) -->
          <label
            class="inline-flex items-center gap-1 text-muted text-[12px] cursor-pointer whitespace-nowrap"
            title="Le volume de la partie à l'écoute, pour ce morceau (double-clic : tel quel)"
          >
            <input
              class="w-[72px] accent-accent"
              type="range"
              :min="MIN_VOLUME"
              :max="MAX_VOLUME"
              step="1"
              :value="group.decibels"
              :aria-label="`Volume${suffix(group.name)}`"
              @input="emit('volume', index, Number(($event.target as HTMLInputElement).value))"
              @dblclick="emit('volume', index, 0)"
            />
            <output class="min-w-[3.6em] text-right tabular-nums">{{ decibelsText(group.decibels) }}</output>
          </label>
        </div>
        <template v-if="group.staves.length > 1">
          <PopoverCheck
            v-for="staff in group.staves"
            :key="staff.staff"
            class="pl-3.5"
            :model-value="!muted.includes(staff.staff)"
            @update:model-value="toggle(staff.staff)"
          >
            {{ staff.label }}
          </PopoverCheck>
        </template>
      </div>
      <ButtonGroup class="mt-1 justify-self-start">
        <Button size="small" :disabled="!muted.length" @click="emit('muted', [])">Toutes</Button>
        <Button size="small" :disabled="silent" @click="emit('muted', all)">Aucune</Button>
      </ButtonGroup>
      <PopoverHint>
        Une portée muette n'est pas jouée : à vous de la jouer, avec le métronome au besoin. L'instrument d'une partie est celui que la
        partition écrit après son nom, ou que son nom fait deviner ; un autre choix, comme le volume, vaut pour ce morceau.
      </PopoverHint>
    </PopoverPanel>
  </ButtonGroup>
</template>
