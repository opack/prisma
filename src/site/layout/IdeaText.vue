<script setup lang="ts">
/** Le texte d'une idée, et ses listes ; plus large dans une idée large. */
import { inject } from "vue";
import { IDEA_KIND } from "./idea.ts";

const wide = inject(IDEA_KIND, "side") === "wide";
</script>

<template>
  <div :class="[wide ? 'max-w-[44em]' : 'max-w-[34em]', '[&_ul]:mb-[18px] [&_ul]:pl-[1.2em] [&_li]:mb-1.5']"><slot /></div>
</template>
