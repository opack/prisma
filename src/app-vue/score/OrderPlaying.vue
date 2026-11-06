<script setup lang="ts">
/**
 * Sur la page, l'ordre de jeu sert aussi à l'écoute : la section jouée y est entourée (on sait
 * ainsi quel passage d'une section répétée on écoute).
 */
import { usePlayer } from "../playback/state.ts";

defineProps<{ x0: number; step: number; y: number }>();
const playerState = usePlayer();
</script>

<template>
  <rect
    v-if="playerState.entry !== null"
    :x="x0 + playerState.entry * step - 0.8"
    :y="y - 0.8"
    width="5.2"
    height="4.9"
    rx="0.9"
    fill="rgb(255, 200, 70)"
  />
</template>
