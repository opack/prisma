<script setup lang="ts">
/** Le bas des pages : une phrase à gauche, toutes les pages et l'application à droite. */
import PageLink from "./PageLink.vue";
import { APP, PAGES } from "./pages.ts";
import type { SitePage } from "./pages.ts";

defineProps<{ current: SitePage }>();
</script>

<template>
  <footer
    class="max-w-[1160px] mx-auto px-6 py-[18px] flex flex-wrap items-center justify-between gap-3 mt-12 border-t border-line text-dim text-[0.95rem]"
  >
    <p class="mb-0">Prisma, une notation chromatique de la musique.</p>
    <nav class="flex flex-wrap items-center gap-5" aria-label="Pages du site">
      <PageLink page="index" :current="current" label="Accueil" />
      <PageLink v-for="[page, label] in PAGES" :key="page" :page="page" :current="current" :label="label" />
      <a :href="APP">L'application</a>
    </nav>
  </footer>
</template>
