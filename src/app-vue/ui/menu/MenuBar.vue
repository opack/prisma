<script setup lang="ts">
/**
 * La barre des menus de l'application (Fichier, Partition, Affichage, Aide), comme dans une
 * application de bureau ; quand la place manque, un seul bouton « Menu », qui peut porter en tête le
 * nom du morceau (slot heading). Sur le menu déroulant de Reka UI.
 */
import type { MenuDef } from "../../../app/ui/menu/menu.ts";
import MenuBarCompact from "./MenuBarCompact.vue";
import MenuBarWide from "./MenuBarWide.vue";

defineProps<{ menus: MenuDef[] }>();
defineSlots<{ heading?(): unknown }>();
</script>

<template>
  <MenuBarWide :menus="menus" />
  <MenuBarCompact :menus="menus">
    <template #heading><slot name="heading" /></template>
  </MenuBarCompact>
</template>
