<script setup lang="ts">
/**
 * Les menus côte à côte, quand il y a la place : un clic sur un titre ouvre son menu ; un menu
 * ouvert, le survol d'un autre titre, ou les flèches gauche et droite, passent à celui-ci ; les
 * flèches passent aussi d'un titre à l'autre, menus fermés ; Tab ferme le menu et passe au titre
 * suivant ; Échap, ou un clic ailleurs, le ferme.
 */
import { useMediaQuery } from "@vueuse/core";
import { ref, useTemplateRef, watch } from "vue";
import type { MenuDef } from "./menu.ts";
import { Button } from "../button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "../dropdown-menu";
import MenuActions from "./MenuActions.vue";
import { COMPACT, PANEL } from "./menu.ts";

const { menus } = defineProps<{ menus: MenuDef[] }>();

const open = ref<number | null>(null);
const bar = useTemplateRef<HTMLElement>("bar");

// la fenêtre rétrécie, la barre laisse la place au seul « Menu » : le menu ouvert se ferme
const compact = useMediaQuery(COMPACT);
watch(compact, (narrow) => narrow && (open.value = null));

/**
 * Où va le focus quand un menu se ferme : à son titre, d'ordinaire (undefined) ; à un autre titre
 * (Tab) ; nulle part quand un autre menu s'ouvre à sa place, et prend le focus (null).
 */
let focusOnClose: HTMLElement | null | undefined;

function openMenu(index: number) {
  if (open.value !== null && open.value !== index) focusOnClose = null;
  open.value = index;
}

function change(index: number, isOpen: boolean) {
  if (isOpen) openMenu(index);
  else if (open.value === index) open.value = null;
}

function placeFocus(event: Event) {
  if (focusOnClose === undefined) return;
  event.preventDefault();
  focusOnClose?.focus();
  focusOnClose = undefined;
}

const titles = () => [...(bar.value?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
const isArrow = (event: KeyboardEvent) => event.key === "ArrowRight" || event.key === "ArrowLeft";
const neighbour = (index: number, key: string) => (index + (key === "ArrowRight" ? 1 : menus.length - 1)) % menus.length;

// menus fermés, les flèches passent au titre voisin
function onTitleKey(index: number, event: KeyboardEvent) {
  if (!isArrow(event)) return;
  event.preventDefault();
  titles()[neighbour(index, event.key)]?.focus();
}

// dans un menu ouvert, les flèches passent au menu voisin ; Tab le ferme et passe au titre suivant
function onMenuKey(index: number, event: KeyboardEvent) {
  if (isArrow(event)) {
    event.preventDefault();
    event.stopPropagation();
    openMenu(neighbour(index, event.key));
  } else if (event.key === "Tab") {
    event.preventDefault();
    focusOnClose = titles()[event.shiftKey ? index : Math.min(index + 1, menus.length - 1)];
    open.value = null;
  }
}
</script>

<template>
  <div ref="bar" class="flex gap-2 compact:hidden" role="group" aria-label="Menus">
    <DropdownMenu
      v-for="(menu, index) in menus"
      :key="menu.label"
      :open="open === index"
      :modal="false"
      @update:open="(isOpen) => change(index, isOpen)"
    >
      <DropdownMenuTrigger as-child>
        <Button kind="quiet" @pointerenter="open !== null && open !== index && openMenu(index)" @keydown="onTitleKey(index, $event)">
          {{ menu.label }}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        :class="PANEL"
        :aria-label="menu.label"
        align="start"
        :side-offset="4"
        @keydown.capture="onMenuKey(index, $event)"
        @close-auto-focus="placeFocus"
      >
        <MenuActions :items="menu.items" />
      </DropdownMenuContent>
    </DropdownMenu>
  </div>
</template>
