<script setup lang="ts">
/**
 * Les actions d'un menu, séparées de traits : chacune montre son raccourci (pas sur un téléphone) ;
 * une action qui se coche (l'éditeur, l'ajustement) se dit cochée.
 */
import type { MenuItem } from "../../../app/ui/menu/menu.ts";
import { DropdownMenuCheckboxItem, DropdownMenuItem, DropdownMenuSeparator } from "../dropdown-menu";
import { ITEM } from "./menu.ts";

defineProps<{ items: MenuItem[] }>();
</script>

<template>
  <template v-for="(item, index) in items" :key="item === 'separator' ? `trait-${index}` : item.label">
    <DropdownMenuSeparator v-if="item === 'separator'" class="mx-1.5 my-1 h-0 bg-transparent border-t border-line" />
    <DropdownMenuCheckboxItem
      v-else-if="item.checked !== undefined"
      :model-value="item.checked"
      :disabled="item.disabled"
      :class="ITEM"
      @select="item.onSelect"
    >
      <span class="text-accent">{{ item.checked ? "✓" : "" }}</span>
      <span>{{ item.label }}</span>
      <kbd v-if="item.shortcut" class="text-muted text-[12px] font-[inherit] phone:hidden">{{ item.shortcut }}</kbd>
    </DropdownMenuCheckboxItem>
    <DropdownMenuItem v-else :disabled="item.disabled" :class="ITEM" @select="item.onSelect">
      <span />
      <span>{{ item.label }}</span>
      <kbd v-if="item.shortcut" class="text-muted text-[12px] font-[inherit] phone:hidden">{{ item.shortcut }}</kbd>
    </DropdownMenuItem>
  </template>
</template>
