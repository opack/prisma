<script setup lang="ts">
/** Un message de lecture, ses citations du texte en chasse fixe (voir message.ts). */
import { CODE, pieces } from "./message.ts";

defineProps<{ text: string }>();
</script>

<template>
  <template v-for="(piece, index) in pieces(text)" :key="index"
    ><code v-if="piece.code" :class="CODE">{{ piece.text }}</code
    ><template v-else>{{ piece.text }}</template></template
  >
</template>
