<script setup lang="ts">
/**
 * Les actions d'un menu, séparées de traits : chacune montre son raccourci (pas sur un téléphone) ;
 * une action qui se coche (l'éditeur, l'ajustement) se dit cochée.
 */
import type { MenuItem } from "./menu.ts";
import { DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuShortcut } from "../dropdown-menu";

defineProps<{ items: MenuItem[] }>();
</script>

<template>
  <template v-for="(item, index) in items" :key="item === 'separator' ? `trait-${index}` : item.label">
    <DropdownMenuSeparator v-if="item === 'separator'" />
    <DropdownMenuCheckboxItem
      v-else-if="item.checked !== undefined"
      :model-value="item.checked"
      :disabled="item.disabled"
      @select="item.onSelect"
    >
      {{ item.label }}
      <DropdownMenuShortcut v-if="item.shortcut" class="phone:hidden">{{ item.shortcut }}</DropdownMenuShortcut>
    </DropdownMenuCheckboxItem>
    <DropdownMenuItem v-else :disabled="item.disabled" @select="item.onSelect">
      {{ item.label }}
      <DropdownMenuShortcut v-if="item.shortcut" class="phone:hidden">{{ item.shortcut }}</DropdownMenuShortcut>
    </DropdownMenuItem>
  </template>
</template>
