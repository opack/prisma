<script setup lang="ts">
/** Les notes du morceau, jamais imprimées : sous un bouton, à côté de son nom. */
import { Button } from "./ui/button";
import PopoverPanel from "./ui/popover/PopoverPanel.vue";

defineProps<{ notes: string }>();
</script>

<template>
  <PopoverPanel label="Notes du morceau" title="Notes du morceau" class="max-w-[320px]">
    <template #trigger>
      <Button kind="quiet" size="icon" class="-ml-1" title="Notes du morceau" aria-label="Notes du morceau">
        <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
          <path fill="currentColor" fill-rule="evenodd" d="M3 1.5h7.5L13 4v10.5H3zM4.5 3v10h7V4.6L9.9 3zM6 6.25h4v1.5H6zm0 3h4v1.5H6z" />
        </svg>
      </Button>
    </template>
    <p class="m-0 whitespace-pre-line">{{ notes }}</p>
  </PopoverPanel>
</template>
