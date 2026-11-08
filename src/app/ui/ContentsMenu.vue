<script setup lang="ts">
/**
 * Les parties d'une page, sous un bouton qui dit celle qu'on lit (« Sommaire · 3. Le temps ») et
 * ouvre leur liste, de sa largeur : une partie en gras, une sous-partie en retrait, celle qu'on lit à
 * l'accent. Le bouton est sur une bande blanche, de toute la largeur ; sa place (collée en haut,
 * fixée en haut de l'écran, sur un écran étroit seulement…), class, dépend de la page.
 */
import { computed } from "vue";
import { Button } from "./button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./dropdown-menu";
import RichLabel from "./RichLabel.ts";
import type { Label } from "./RichLabel.ts";

export type ContentsEntry = { id: string; label: Label; depth?: 2 | 3 };

const props = defineProps<{ title: string; entries: ContentsEntry[]; current?: string }>();
const emit = defineEmits<{ go: [id: string] }>();

/** La partie lue, ou, dans une sous-partie, la partie qui la contient. */
const part = computed(() => {
  const at = props.entries.findIndex((entry) => entry.id === props.current);
  return props.entries
    .slice(0, at + 1)
    .filter((entry) => (entry.depth ?? 2) === 2)
    .pop();
});
</script>

<template>
  <div class="px-4 py-2 bg-white border-b border-line">
    <!-- à la largeur des pages du site, calé sur leur texte -->
    <div class="max-w-[1112px] mx-auto">
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button class="w-full max-w-[560px] min-w-0">
            <span class="flex flex-1 items-center gap-2 min-w-0 py-0.5 text-left">
              <span class="flex-none font-semibold">{{ title }}</span>
              <span v-if="part" class="truncate text-muted"><RichLabel :label="part.label" /></span>
              <svg class="ml-auto flex-none" width="10" height="16" viewBox="0 0 8 16" aria-hidden="true">
                <path d="M1 6.5h6L4 10z" fill="currentColor" />
              </svg>
            </span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          class="p-1 bg-white rounded-md ring-0 border border-line shadow-[0_6px_18px_rgba(0,0,0,0.12)] text-[14px] leading-[1.35] text-ink"
          :aria-label="title"
          align="start"
        >
          <DropdownMenuItem
            v-for="entry in entries"
            :key="entry.id"
            :class="[
              'py-1.5 px-2.5 rounded text-[14px] cursor-pointer',
              entry.depth === 3 ? 'pl-[22px]' : 'font-semibold',
              entry.id === current ? 'text-accent focus:text-accent' : entry.depth === 3 ? 'text-muted' : 'text-ink',
            ]"
            @select="emit('go', entry.id)"
          >
            <RichLabel :label="entry.label" />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>
