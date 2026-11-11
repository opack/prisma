<script setup lang="ts">
/**
 * Panneau des options : un tiroir à droite, sous le bouton engrenage, par-dessus l'aperçu et sans
 * rien pousser. Les réglages sont rangés par onglets ; chacun tient sur une ligne, avec sous lui
 * une courte explication du choix en cours.
 *
 * Deux portées, comme les réglages d'un éditeur de code : les options générales, pour tous les
 * morceaux, et celles de la partition ouverte, qui priment sur elles. Côté partition, seules
 * paraissent les options du rendu (mise en page, octaves, notes) ; chacune y est définie pour la
 * partition ou suit l'option générale.
 */
import { useStorage } from "@vueuse/core";
import { computed, provide } from "vue";
import {
  CHORDS,
  CHORD_NAMES,
  SCORE_NAMES,
  CLICK_LEVELS,
  COLORS,
  DENSITIES,
  NOTE_NAMES,
  NOTE_POSITIONS,
  OCTAVE_POSITIONS,
  OCTAVE_SYMBOLS,
  RULER_DETAILS,
  SECTIONS,
  SIMILE,
  SOURCE_COLORS,
  TABS,
} from "./choices.ts";
import type { Tab } from "./choices.ts";
import { CLICK_GRIDS } from "./options.ts";
import type { RenderOptions } from "./options.ts";
import { PIECE_KEYS } from "./piece.ts";
import { CLICK_SOUNDS } from "../playback/metronome.ts";
import type { ClickLevel } from "../playback/performance.ts";
import { Button } from "../ui/button";
import LaneFlag from "./LaneFlag.vue";
import OptionCheck from "./OptionCheck.vue";
import OptionChoice from "./OptionChoice.vue";
import OptionRow from "./OptionRow.vue";
import { PORTEE } from "./scope.ts";
import type { Portee } from "./scope.ts";
import { useSettings } from "./settings.ts";

/** name : le nom de la partition ; where : le fichier où ses options s'enregistrent, à côté d'elle (null : gardées le temps qu'elle est ouverte). */
defineProps<{ name: string; where: string | null }>();
const emit = defineEmits<{ close: [] }>();

const LINK = "p-0 text-brand underline bg-transparent border-0 cursor-pointer";
const SLIDER = "flex-1 min-w-0 accent-brand";
/** Générales, Partition : le choix de la portée des options. */
const porteeButton = (on: boolean) => [
  "flex-1 px-2 py-1.5 border-0 rounded-none",
  on ? "bg-brand-12 text-brand font-semibold" : "bg-white text-dim",
];

const settings = useSettings();
const portee = useStorage<Portee>("prisma:options-scope", "general");
const tabChoice = useStorage<Tab>("prisma:options-tab", "score");
provide(PORTEE, portee);

const onPiece = computed(() => portee.value === "piece");
const tabs = computed(() => TABS.filter((item) => !onPiece.value || item.piece));
const tab = computed(() => (tabs.value.some((item) => item.id === tabChoice.value) ? tabChoice.value : "score"));
const own = computed(() => settings.piece.options ?? {});
const ownCount = computed(() => Object.keys(own.value).length);

// les valeurs montrées, celles de la portée choisie (côté partition, une option qu'elle ne définit
// pas montre la générale, qu'elle suit) ; y écrire change cette portée : v-model="values.chords"
const shown = computed<RenderOptions>(() => (onPiece.value ? { ...settings.general, ...own.value } : settings.general));
const values = new Proxy({} as RenderOptions, {
  get: (_, key: keyof RenderOptions) => shown.value[key],
  set: (_, key: keyof RenderOptions, value) => {
    (onPiece.value ? settings.setPieceOptions : settings.setOptions)({ [key]: value });
    return true;
  },
});

const percent = (volume: number) => `${Math.round(volume * 100)} %`;
const soundIndex = (level: ClickLevel) => CLICK_SOUNDS.findIndex((sound) => sound.value === values.clickSounds[level]);
const setSound = (level: ClickLevel, index: number) => (values.clickSounds = { ...values.clickSounds, [level]: CLICK_SOUNDS[index].value });
const defineAll = () => settings.setPieceOptions(Object.fromEntries(PIECE_KEYS.map((key) => [key, settings.general[key]])));
</script>

<template>
  <aside
    id="options"
    data-drawer
    class="print:hidden! absolute top-0 right-0 bottom-0 z-15 flex flex-col w-[min(440px,100%)] bg-panel border-l border-line shadow-[-8px_0_24px_rgba(0,0,0,0.08)]"
    aria-label="Options"
  >
    <header class="flex items-center justify-between px-4 pt-3 pb-1">
      <h2 class="m-0 text-[1rem]">Options</h2>
      <Button variant="ghost" size="icon" aria-label="Fermer les options" title="Fermer (Échap)" @click="emit('close')">×</Button>
    </header>
    <div class="flex mx-3 mt-0 mb-2 overflow-hidden border border-line rounded-md" role="radiogroup" aria-label="Portée des options">
      <button
        role="radio"
        :aria-checked="!onPiece"
        :class="porteeButton(!onPiece)"
        title="Les options de tous les morceaux"
        @click="portee = 'general'"
      >
        Générales
      </button>
      <button
        role="radio"
        :aria-checked="onPiece"
        :class="[porteeButton(onPiece), 'border-l border-line']"
        title="Les options de la partition ouverte : elles priment sur les générales"
        @click="portee = 'piece'"
      >
        Partition{{ ownCount ? ` (${ownCount})` : "" }}
      </button>
    </div>
    <div v-if="onPiece" class="mx-3 mt-0 mb-1.5">
      <p class="mt-0 mb-0.5 text-[0.9em] text-dim leading-[1.4] wrap-anywhere">
        <strong>{{ name }}</strong> :
        {{
          where
            ? `ses options s'enregistrent à côté d'elle, dans ${where}, et la suivent d'un ordinateur à l'autre.`
            : "ses options valent le temps qu'elle est ouverte ; ouverte depuis la bibliothèque, elle les garderait à côté d'elle."
        }}
      </p>
      <p class="flex gap-3 m-0 text-[0.9em]">
        <button
          :class="LINK"
          title="Chaque option du rendu est définie pour la partition, avec la valeur générale actuelle"
          @click="defineAll"
        >
          Tout définir pour la partition
        </button>
        <button
          v-if="ownCount > 0"
          :class="LINK"
          title="La partition suit alors toutes les options générales"
          @click="settings.unsetPieceOptions([...PIECE_KEYS])"
        >
          Tout retirer
        </button>
      </p>
    </div>
    <nav class="flex px-2 border-b border-line" role="tablist">
      <button
        v-for="item in tabs"
        :key="item.id"
        role="tab"
        :aria-selected="tab === item.id"
        :class="[
          'flex-[1_1_auto] -mb-px px-1 py-2 whitespace-nowrap bg-transparent border-0 border-b-2 rounded-none',
          tab === item.id ? 'text-ink border-b-brand font-semibold' : 'text-dim border-b-transparent hover:border-b-dim',
        ]"
        @click="tabChoice = item.id"
      >
        {{ item.label }}
      </button>
    </nav>
    <div class="overflow-auto px-4 pt-2 pb-4" role="tabpanel">
      <template v-if="tab === 'editing'">
        <OptionCheck
          id="auto-engrave"
          v-model="values.autoEngrave"
          label="Mise en page"
          text="Mettre en page automatiquement"
          :hint="
            values.autoEngrave
              ? 'la mise en page suit la saisie, peu après la dernière frappe'
              : 'on met en page d\'un clic sur le bouton en bas de l\'éditeur (Ctrl+Entrée)'
          "
        />
        <OptionCheck
          id="score-to-text"
          v-model="values.scoreToText"
          label="Partition et texte"
          text="Relier la partition et le texte"
          :hint="
            values.scoreToText
              ? 'un clic sur la partition place le curseur du texte sur le signe cliqué ; le signe sous le curseur du texte est encadré sur la partition'
              : 'le clic sur la partition ne place que l\'écoute ; rien n\'est encadré'
          "
        />
        <OptionChoice id="source-colors" v-model="values.sourceColors" label="Coloration" :options="SOURCE_COLORS" />
        <OptionChoice id="note-names" v-model="values.noteNames" label="Noms des notes" :options="NOTE_NAMES" />
      </template>

      <template v-else-if="tab === 'score'">
        <OptionChoice id="chords" v-model="values.chords" label="Accompagnement" :options="CHORDS" piece-key="chords" />
        <OptionChoice
          v-if="values.chords !== 'notes'"
          id="chord-names"
          v-model="values.chordNames"
          label="Nom des accords"
          :options="CHORD_NAMES"
          piece-key="chordNames"
        />
        <OptionChoice id="score-names" v-model="values.scoreNames" label="Noms des notes" :options="SCORE_NAMES" piece-key="scoreNames" />
        <OptionCheck
          id="chord-chart"
          v-model="values.chordChart"
          label="Grilles"
          text="Récapituler les grilles en tête de partition"
          :hint="
            values.chordChart
              ? 'la grille de guitare de chaque accord du morceau, une fois, sous le titre'
              : 'les grilles seulement sur la partition, avec l\'accompagnement « Nom et grille »'
          "
          piece-key="chordChart"
        />
        <OptionCheck
          id="names-every-system"
          v-model="values.namesEverySystem"
          label="Parties"
          text="Répéter les noms à chaque système"
          :hint="
            values.namesEverySystem
              ? 'le nom de chaque partie en tête de chaque système'
              : 'les noms au premier système seulement, comme sur une partition'
          "
          piece-key="namesEverySystem"
        />
        <OptionChoice id="ruler-detail" v-model="values.rulerDetail" label="Règle" :options="RULER_DETAILS" piece-key="rulerDetail" />
        <OptionChoice id="sections" v-model="values.sections" label="Sections" :options="SECTIONS" piece-key="sections" />
        <OptionChoice id="simile" v-model="values.simile" label="Ped. simile" :options="SIMILE" piece-key="simile" />
      </template>

      <template v-else-if="tab === 'lanes'">
        <OptionChoice
          id="octave-position"
          v-model="values.octavePosition"
          label="Position"
          :options="OCTAVE_POSITIONS"
          piece-key="octavePosition"
        />
        <OptionChoice id="octave-symbol" v-model="values.octaveStyle" label="Symbole" :options="OCTAVE_SYMBOLS" piece-key="octaveStyle" />
        <OptionChoice id="lane-colors" v-model="values.laneColors" label="Couleurs" :options="COLORS" piece-key="laneColors">
          <template #icon="{ value }"><LaneFlag :colors="value" /></template>
        </OptionChoice>
      </template>

      <template v-else-if="tab === 'notes'">
        <OptionChoice id="density" v-model="values.density" label="Espacement" :options="DENSITIES" piece-key="density" />
        <OptionChoice
          id="note-position"
          v-model="values.notePosition"
          label="Position"
          :options="NOTE_POSITIONS"
          piece-key="notePosition"
        />
        <OptionCheck
          id="hold-reminders"
          v-model="values.holdReminders"
          label="Tenues"
          text="Rappeler la note tenue en début de ligne"
          :hint="values.holdReminders ? '« — 8 » : le trait de tenue, puis la note tenue en gris' : 'le seul trait de tenue'"
          piece-key="holdReminders"
        />
        <OptionCheck
          id="fingerings"
          v-model="values.fingerings"
          label="Doigtés"
          text="Afficher les doigtés"
          :hint="
            values.fingerings
              ? 'en chiffre blanc sur une pastille, en bas à droite de la note'
              : 'masqués : la page s\'allège, le fichier les garde'
          "
          piece-key="fingerings"
        />
      </template>

      <template v-else-if="tab === 'playback'">
        <OptionCheck
          id="look-ahead"
          v-model="values.lookAhead"
          label="Système suivant"
          text="Le montrer d'avance"
          :hint="
            values.lookAhead
              ? 'à l\'écoute, dans la dernière mesure d\'un système, la page glisse peu à peu pour le montrer'
              : 'à l\'écoute, la page ne bouge qu\'en arrivant au système suivant'
          "
        />
      </template>

      <template v-else-if="tab === 'metronome'">
        <OptionRow label="Volume" for="click-volume" hint="par rapport aux instruments">
          <input
            id="click-volume"
            v-model.number="values.clickVolume"
            type="range"
            :class="SLIDER"
            min="0"
            max="2"
            step="0.1"
            :aria-valuetext="percent(values.clickVolume)"
          />
          <span class="min-w-[4.5em] text-ink">{{ percent(values.clickVolume) }}</span>
        </OptionRow>
        <OptionCheck
          id="count-in"
          v-model="values.countIn"
          label="Décompte"
          text="Une mesure avant de jouer"
          hint="au départ et à la reprise, même métronome coupé"
        />
        <OptionChoice id="click-grid" v-model="values.clickGrid" label="Battre" :options="CLICK_GRIDS" />
        <!-- du silence au plus aigu : un curseur, plus parlant qu'une liste pour cinq crans -->
        <OptionRow v-for="level in CLICK_LEVELS" :key="level.value" :label="level.label" :for="`click-${level.value}`" :hint="level.hint">
          <input
            :id="`click-${level.value}`"
            type="range"
            :class="SLIDER"
            min="0"
            :max="CLICK_SOUNDS.length - 1"
            step="1"
            :value="soundIndex(level.value)"
            :aria-valuetext="CLICK_SOUNDS[soundIndex(level.value)]?.label"
            @input="setSound(level.value, Number(($event.target as HTMLInputElement).value))"
          />
          <span class="min-w-[4.5em] text-ink">{{ CLICK_SOUNDS[soundIndex(level.value)]?.label }}</span>
        </OptionRow>
      </template>
    </div>
  </aside>
</template>
