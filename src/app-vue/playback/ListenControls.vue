<script setup lang="ts">
/**
 * Les commandes d'écoute de la barre : début, section précédente, lecture et pause, section
 * suivante, arrêt ; le tempo, celui de la partition par défaut, qu'on peut changer (même en cours de
 * lecture) puis rétablir ; le suivi de la lecture, le métronome et les parties jouées. Sa place :
 * dans la barre (bar), tout, ses réglages en moins quand la place manque (crowded:) ; sous le bouton
 * ⋯ (more), ses réglages seuls.
 */
import { computed, watchEffect } from "vue";
import type { Score } from "../../core/index.ts";
import { DEFAULT_BPM, player } from "../../app/playback/player.ts";
import { follow } from "../../app/score/follow.ts";
import { useSettings } from "../options/settings.ts";
import { Button } from "../ui/button";
import ButtonGroup from "../ui/button/ButtonGroup.vue";
import MetronomeMenu from "./MetronomeMenu.vue";
import PartsMenu from "./PartsMenu.vue";
import PlayIcon from "./PlayIcon.vue";
import { useFollowing, usePlayer } from "./state.ts";
import TempoControl from "./TempoControl.vue";
import type { usePieceSound } from "./usePieceSound.ts";

const { score, place, sound } = defineProps<{
  score?: Score;
  disabled: boolean;
  place: "bar" | "more";
  /** L'écoute du morceau : ses portées muettes, ses instruments, ses volumes. */
  sound: ReturnType<typeof usePieceSound>;
}>();

const LABELS = { idle: "Écouter", loading: "Chargement du piano… (cliquer pour annuler)", playing: "Pause", paused: "Reprendre" };

const settings = useSettings();
const playerState = usePlayer();
const following = useFollowing();

const entry = computed(() => playerState.value.entry ?? 0);
const written = computed(() => score?.meta.bpm ?? DEFAULT_BPM);
const bpm = computed(() => settings.piece.tempo ?? written.value);
watchEffect(() => player.setTempo(bpm.value));

const metronome = computed({ get: () => settings.general.metronome, set: (on) => settings.setOptions({ metronome: on }) });
const clickGrid = computed({ get: () => settings.general.clickGrid, set: (grid) => settings.setOptions({ clickGrid: grid }) });
const setTempo = (picked: number) => settings.updatePiece({ tempo: picked === written.value ? undefined : picked });

function toggle() {
  const { state } = playerState.value;
  if (state === "playing") player.pause();
  else if (state === "loading") player.stop();
  else if (score) {
    follow.release();
    player.play(score, bpm.value);
  }
}

/** Revenir au début, à une section : la partition y retourne sans attendre. */
function go(move: () => void) {
  follow.release();
  move();
}

const bar = computed(() => place === "bar");
// un réglage, dans la barre : il passe sous le bouton ⋯ quand la place manque
const setting = computed(() => (bar.value ? "crowded:hidden" : ""));
</script>

<template>
  <span v-if="bar && playerState.error" class="ml-3 text-accent whitespace-nowrap" role="status">{{ playerState.error }}</span>
  <span v-if="bar" class="flex-1" />
  <TempoControl :class="setting" :bpm="bpm" :written="written" :chosen="settings.piece.tempo !== undefined" @tempo="setTempo" />
  <ButtonGroup v-if="bar" label="Lecture">
    <Button
      size="icon"
      :disabled="disabled"
      title="Revenir au début du morceau"
      aria-label="Revenir au début"
      @click="go(() => player.rewind())"
    >
      <PlayIcon path="M2 3h2v10H2zM9 3v10L4 8zM14 3v10L9 8z" />
    </Button>
    <Button
      size="icon"
      :disabled="disabled"
      title="Début de la section (deux clics : section précédente)"
      aria-label="Section précédente"
      @click="go(() => player.previous())"
    >
      <PlayIcon path="M3 3h2v10H3zM13 3v10L5 8z" />
    </Button>
    <Button size="icon" :disabled="disabled" :title="LABELS[playerState.state]" :aria-label="LABELS[playerState.state]" @click="toggle">
      <span v-if="playerState.state === 'loading'" class="leading-[14px]">…</span>
      <PlayIcon v-else :path="playerState.state === 'playing' ? 'M4 3h3v10H4zM9 3h3v10H9z' : 'M4 2.5v11L13 8z'" />
    </Button>
    <Button
      size="icon"
      :disabled="disabled || entry + 1 >= playerState.entries"
      title="Section suivante"
      aria-label="Section suivante"
      @click="go(() => player.next())"
    >
      <PlayIcon path="M11 3h2v10h-2zM3 3v10l8-5z" />
    </Button>
    <Button
      size="icon"
      :disabled="playerState.state === 'idle'"
      title="Arrêter et revenir au début"
      aria-label="Arrêter"
      @click="player.stop()"
    >
      <PlayIcon path="M3.5 3.5h9v9h-9z" />
    </Button>
  </ButtonGroup>
  <Button
    size="icon"
    :class="setting"
    :pressed="following"
    :title="
      following
        ? 'Suivre la lecture : la partition suit le curseur, et y revient une seconde après qu\'on l\'a fait défiler à la main'
        : 'Suivre la lecture : arrêté'
    "
    aria-label="Suivre la lecture"
    @click="follow.set(!following)"
  >
    <PlayIcon
      path="M8 2.5a5.5 5.5 0 1 0 0 11a5.5 5.5 0 1 0 0-11zM8 4a4 4 0 1 1 0 8a4 4 0 1 1 0-8zM8 6.3a1.7 1.7 0 1 1 0 3.4a1.7 1.7 0 1 1 0-3.4zM7.25 .5h1.5v2h-1.5zM7.25 13.5h1.5v2h-1.5zM.5 7.25h2v1.5h-2zM13.5 7.25h2v1.5h-2z"
    />
  </Button>
  <span :class="[setting, 'flex']">
    <MetronomeMenu v-model:metronome="metronome" v-model:click-grid="clickGrid" />
    <PartsMenu
      :score="score"
      :muted="sound.muted.value"
      :instruments="sound.instruments.value"
      :volumes="sound.volumes.value"
      @muted="sound.setMuted"
      @instrument="sound.setInstrument"
      @volume="sound.setVolume"
    />
  </span>
</template>
