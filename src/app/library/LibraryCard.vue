<script setup lang="ts">
/** Un morceau en vignette : le haut de sa première page, son titre, son compositeur, son fichier ; tout se clique. */
import { titleOf } from "./browse.ts";
import type { LibraryEntry } from "./library.ts";
import type { RenderOptions } from "../options/options.ts";
import ThumbView from "./ThumbView.vue";

/** folder : montrer son sous-dossier devant son nom (les morceaux ouverts récemment, tous mêlés). */
defineProps<{ entry: LibraryEntry; options: RenderOptions; folder: boolean }>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <button
    class="flex flex-col gap-0.5 h-full p-2 rounded-md w-full text-left bg-transparent border-0 hover:bg-panel"
    :title="entry.path"
    @click="emit('open')"
  >
    <ThumbView :entry="entry" :options="options" />
    <span class="font-semibold">{{ titleOf(entry) }}</span>
    <span class="text-left text-[13px] text-muted">{{ entry.composer ?? "\u00a0" }}</span>
    <!-- dans une boîte flexible, les espaces entre ces morceaux ne comptent pas -->
    <span class="col-span-full flex items-center gap-2.5 text-muted flex-wrap text-[11px]">
      {{ folder && entry.folder ? `${entry.folder}/` : "" }}{{ entry.name }}
      <span v-if="entry.kind === 'musicxml'" class="px-1.5 rounded-[3px] bg-accent-12 text-accent">à importer</span>
    </span>
  </button>
</template>
