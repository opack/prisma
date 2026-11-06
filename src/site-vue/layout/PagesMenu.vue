<script setup lang="ts">
/** Les pages du site, dans un menu, sur un téléphone seulement : celle où l'on est, comme le texte. */
import { Button } from "../../app-vue/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "../../app-vue/ui/dropdown-menu";
import { PAGES } from "./pages.ts";
import type { SitePage } from "./pages.ts";

defineProps<{ current: SitePage }>();
</script>

<template>
  <span class="hidden phone:flex">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button size="icon" title="Pages du site" aria-label="Pages du site">
          <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true">
            <path fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" d="M2.5 4h11M2.5 8h11M2.5 12h11" />
          </svg>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        class="grid w-auto min-w-[260px] p-1.5 bg-white border border-line rounded-md ring-0 shadow-[0_6px_18px_rgba(0,0,0,0.12)] text-[length:inherit]"
        align="end"
        :side-offset="6"
        aria-label="Pages du site"
      >
        <DropdownMenuItem
          v-for="[page, label] in PAGES"
          :key="page"
          as-child
          :class="[
            'px-2.5 py-2 rounded text-[length:inherit] no-underline cursor-pointer',
            page === current ? 'text-ink' : 'text-accent focus:text-accent',
          ]"
        >
          <a :href="`${page}.html`">{{ label }}</a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  </span>
</template>
