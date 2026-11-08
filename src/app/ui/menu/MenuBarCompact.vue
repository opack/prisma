<script setup lang="ts">
/**
 * Quand la place manque : un seul bouton « Menu » (trois traits). Un titre choisi (un clic, Entrée,
 * la flèche droite) montre ses actions à la place des titres, « ‹ Menu » (ou la flèche gauche) y
 * revient : pas de sous-menu à rejoindre à la souris, ni de place à trouver à côté sur un
 * téléphone. En tête des titres, ce qu'on lui donne (le nom du morceau, sur un téléphone).
 */
import { useMediaQuery } from "@vueuse/core";
import { computed, nextTick, ref, useId, watch } from "vue";
import type { MenuDef } from "./menu.ts";
import { Button } from "../button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "../dropdown-menu";
import MenuActions from "./MenuActions.vue";
import { COMPACT, ITEM, PANEL } from "./menu.ts";

const { menus } = defineProps<{ menus: MenuDef[] }>();
defineSlots<{ heading?(): unknown }>();

const id = useId();
const open = ref(false);
// la fenêtre élargie, la barre revient : le menu ouvert se ferme avec son bouton
const compact = useMediaQuery(COMPACT);
watch(compact, (narrow) => narrow || (open.value = false));

// le titre choisi : ses actions remplacent les titres, sous « ‹ Menu », qui y revient
const section = ref<number | null>(null);
const menu = computed(() => (section.value === null ? null : menus[section.value]));

function change(isOpen: boolean) {
  open.value = isOpen;
  if (!isOpen) section.value = null;
}

/** Passe aux titres (null) ou aux actions d'un titre, le focus sur la première ligne. */
async function show(index: number | null) {
  section.value = index;
  await nextTick();
  document.getElementById(id)?.querySelector<HTMLElement>('[role^="menuitem"]')?.focus();
}

// la flèche droite ouvre le titre, comme Entrée ; la flèche gauche revient aux titres, comme « ‹ Menu »
function onKey(event: KeyboardEvent) {
  if (event.key === "ArrowLeft" && menu.value) {
    event.preventDefault();
    show(null);
  } else if (event.key === "ArrowRight" && !menu.value) {
    const title = (event.target as HTMLElement).closest<HTMLElement>("[data-title]")?.dataset.title;
    if (title === undefined) return;
    event.preventDefault();
    show(Number(title));
  }
}

/** Une ligne qui change ce que montre le menu, sans le fermer. */
function stay(event: Event, index: number | null) {
  event.preventDefault();
  show(index);
}
</script>

<template>
  <span class="hidden compact:block">
    <DropdownMenu :open="open && compact" @update:open="change">
      <DropdownMenuTrigger as-child>
        <Button kind="quiet" size="icon" title="Menu" aria-label="Menu">
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path fill="currentColor" d="M2 3.25h12v1.5H2zM2 7.25h12v1.5H2zM2 11.25h12v1.5H2z" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        :id="id"
        :class="PANEL"
        :aria-label="menu ? menu.label : 'Menu'"
        align="start"
        :side-offset="4"
        @keydown.capture="onKey"
      >
        <template v-if="menu">
          <DropdownMenuItem text-value="Menu" :class="[ITEM, 'text-muted']" @select="stay($event, null)">
            <span aria-hidden="true">‹</span>
            <span>Menu</span>
          </DropdownMenuItem>
          <DropdownMenuLabel class="mt-1 mb-0.5 px-2.5 py-0 text-muted text-[12px] font-semibold">{{ menu.label }}</DropdownMenuLabel>
          <MenuActions :items="menu.items" />
        </template>
        <template v-else>
          <slot name="heading" />
          <DropdownMenuItem
            v-for="(title, index) in menus"
            :key="title.label"
            :data-title="index"
            :class="ITEM"
            @select="stay($event, index)"
          >
            <span />
            <span>{{ title.label }}</span>
            <span class="text-muted" aria-hidden="true">›</span>
          </DropdownMenuItem>
        </template>
      </DropdownMenuContent>
    </DropdownMenu>
  </span>
</template>
