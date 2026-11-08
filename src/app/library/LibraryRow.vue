<script setup lang="ts">
/** Un morceau en liste : son titre, son compositeur, son fichier et sa date ; toute la ligne se clique. */
import { titleOf } from "./browse.ts";
import type { LibraryEntry } from "./library.ts";

/** folder : montrer son sous-dossier devant son nom (les morceaux ouverts récemment, tous mêlés). */
defineProps<{ entry: LibraryEntry; folder: boolean }>();
const emit = defineEmits<{ open: [] }>();
</script>

<template>
  <button
    class="grid grid-cols-[1fr_auto] gap-x-4 gap-y-0.5 px-2 py-2.5 rounded-none w-full text-left bg-transparent border-0 hover:bg-panel"
    :title="entry.path"
    @click="emit('open')"
  >
    <span class="font-semibold">{{ titleOf(entry) }}</span>
    <span v-if="entry.composer" class="text-right text-muted">{{ entry.composer }}</span>
    <!-- dans une boîte flexible, les espaces entre ces morceaux ne comptent pas -->
    <span class="col-span-full flex items-center gap-2.5 text-muted text-[12px]">
      {{ folder && entry.folder ? `${entry.folder}/` : "" }}{{ entry.name }}
      <span v-if="entry.kind === 'musicxml'" class="px-1.5 rounded-[3px] bg-accent-12 text-accent">à importer</span>
      <span class="ml-auto">{{ new Date(entry.modified).toLocaleDateString("fr-FR") }}</span>
    </span>
  </button>
</template>
