<script setup lang="ts">
/**
 * La retouche d'un temps, ouverte par un double-clic sur la règle de la partition : le détailler en
 * 2 ou en 3, l'affiner, ou le refermer d'un niveau. Refermer reste visible quand il perdrait
 * quelque chose, inactif, avec sa raison. Le menu s'ouvre à côté du clic ; Échap ou un clic
 * ailleurs le ferme.
 */
import type { BeatAction } from "../editor/beat.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "../ui/dropdown-menu";

defineProps<{
  /** Où ouvrir le menu, à l'écran. */
  x: number;
  y: number;
  /** Le numéro du temps et de sa mesure, pour le titre. */
  title: string;
  actions: BeatAction[];
}>();
const emit = defineEmits<{ act: [action: BeatAction]; close: [] }>();
</script>

<template>
  <DropdownMenu :open="true" :modal="false" @update:open="(open) => open || emit('close')">
    <!-- le point du clic, auquel le menu s'accroche -->
    <DropdownMenuTrigger as-child>
      <span class="fixed size-0" :style="{ left: `${x}px`, top: `${y}px` }" />
    </DropdownMenuTrigger>
    <DropdownMenuContent class="w-64" side="bottom" align="start" :side-offset="8" :align-offset="8" aria-label="Découpage du temps">
      <DropdownMenuLabel>{{ title }}</DropdownMenuLabel>
      <DropdownMenuItem
        v-for="action in actions"
        :key="action.label"
        class="touch:min-h-11"
        :disabled="action.kind === 'merge' && !!action.blocked"
        @select="emit('act', action)"
      >
        <span class="grid">
          {{ action.label }}
          <span v-if="action.kind === 'merge' && action.blocked" class="text-xs text-dim">Impossible : {{ action.blocked }}</span>
        </span>
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>
