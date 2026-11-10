<script setup lang="ts">
/** Les pages du site, dans un menu, sur un téléphone seulement : celle où l'on est, comme le texte. */
import { Button } from "../../app/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../app/ui/dropdown-menu";
import { PAGES } from "./pages.ts";
import type { SitePage } from "./pages.ts";

defineProps<{ current?: SitePage }>();
</script>

<template>
  <span class="hidden phone:flex">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button variant="outline" size="icon" title="Pages du site" aria-label="Pages du site">
          <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M2.5 4h11M2.5 8h11M2.5 12h11" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent class="w-auto min-w-56" align="end" aria-label="Pages du site">
        <DropdownMenuItem v-for="[page, label] in PAGES" :key="page" as-child :class="page === current && 'font-semibold'">
          <a :href="`${page}.html`" :aria-current="page === current ? 'page' : undefined" class="no-underline">{{ label }}</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </span>
</template>
