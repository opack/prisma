<script setup lang="ts">
/**
 * La barre du haut : le logo et le nom, les menus, le fichier ouvert (un point à la couleur de l'accent tant
 * qu'il y a des modifications non enregistrées) et ses notes (`notes:`, sous un bouton), l'avis du
 * moment, une nouvelle version à prendre, l'écoute (slot listen) et le bouton des options. Toujours sur une
 * ligne : quand la place manque, le logo seul, puis un seul menu (trois traits), puis les réglages de
 * l'écoute sous un bouton ⋯, et sur un téléphone les options et les notes avec eux, le nom du
 * morceau en tête du menu. Les boutons de lecture restent toujours dans la barre.
 */
import { computed } from "vue";
import type { MenuDef } from "../app/ui/menu/menu.ts";
import FileName from "./FileName.ts";
import NotesButton from "./NotesButton.vue";
import OptionsButton from "./OptionsButton.vue";
import { Button } from "./ui/button";
import Logo from "./ui/Logo.vue";
import MenuBar from "./ui/menu/MenuBar.vue";
import PopoverPanel from "./ui/popover/PopoverPanel.vue";

const { saved, rewritable } = defineProps<{
  menus: MenuDef[];
  fileName: string;
  saved: boolean;
  rewritable: boolean;
  notes?: string;
  notice: string | null;
  /** Une nouvelle version à prendre. */
  update: boolean;
  optionsOpen: boolean;
}>();
const emit = defineEmits<{ update: []; options: [] }>();
/** L'écoute, dans la barre (bar) ou sous le bouton ⋯ (more), où elle ne montre que ses réglages. */
defineSlots<{ listen?(props: { place: "bar" | "more" }): unknown }>();

const tip = computed(
  () =>
    [saved ? "" : "Modifications non enregistrées", rewritable ? "Enregistrer réécrit ce fichier" : ""].filter(Boolean).join(" ; ") ||
    undefined,
);
</script>

<template>
  <header class="flex gap-2 items-center px-4 py-2 bg-panel border-b border-line print:hidden! phone:gap-1 phone:px-2">
    <span class="flex items-center gap-1.5 font-bold tracking-[.06em] mr-3 bare:mr-1" title="Prisma">
      <Logo class="size-5" />
      <span class="bare:hidden">Prisma</span>
    </span>
    <!-- sur un téléphone, le nom du morceau passe en tête du menu -->
    <MenuBar :menus="menus">
      <template #heading>
        <p class="hidden phone:block max-w-[260px] mt-0 mb-1 px-2.5 pt-1 pb-1.5 border-b border-line text-muted truncate" :title="tip">
          <FileName :name="fileName" :saved="saved" />
        </p>
      </template>
    </MenuBar>
    <span class="text-muted ml-2 truncate min-w-[6em] phone:hidden" :title="tip">
      <FileName :name="fileName" :saved="saved" />
    </span>
    <span v-if="notes" class="contents phone:hidden"><NotesButton :notes="notes" /></span>
    <span v-if="notice" class="text-accent ml-3 whitespace-nowrap" role="status">{{ notice }}</span>
    <Button
      v-if="update"
      kind="primary"
      size="small"
      class="ml-2 whitespace-nowrap"
      title="Une nouvelle version de Prisma est prête : recharger l'application pour la prendre"
      @click="emit('update')"
    >
      Mettre à jour
    </Button>
    <slot name="listen" place="bar" />
    <!-- ce qui n'a pas trouvé place : les réglages de l'écoute, et sur un téléphone les options et les notes -->
    <span class="hidden crowded:contents">
      <PopoverPanel label="Réglages de l'écoute">
        <template #trigger>
          <Button size="icon" title="Réglages de l'écoute" aria-label="Plus">
            <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
              <path fill="currentColor" d="M2.5 6.5h3v3h-3zM6.5 6.5h3v3h-3zM10.5 6.5h3v3h-3z" />
            </svg>
          </Button>
        </template>
        <div class="flex flex-wrap items-center gap-2 max-w-[300px]">
          <slot name="listen" place="more" />
          <span class="hidden phone:contents">
            <NotesButton v-if="notes" :notes="notes" />
            <OptionsButton :open="optionsOpen" @click="emit('options')" />
          </span>
        </div>
      </PopoverPanel>
    </span>
    <span class="contents phone:hidden"><OptionsButton :open="optionsOpen" @click="emit('options')" /></span>
  </header>
</template>
