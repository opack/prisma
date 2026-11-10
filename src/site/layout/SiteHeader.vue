<script setup lang="ts">
/** Le haut des pages (la page où l'on est, si c'est l’une du site) : le nom à gauche, les pages et l'application à droite (les pages sous un bouton, sur un téléphone). */
import Logo from "../../app/ui/Logo.vue";
import ButtonLink from "./ButtonLink.vue";
import PageLink from "./PageLink.vue";
import PagesMenu from "./PagesMenu.vue";
import { APP, PAGES } from "./pages.ts";
import type { SitePage } from "./pages.ts";

defineProps<{ current?: SitePage }>();
</script>

<template>
  <header class="max-w-[1160px] mx-auto px-6 py-[18px] flex flex-wrap items-center justify-between gap-3 phone:flex-nowrap">
    <a class="inline-flex items-center gap-2 font-bold text-[1.4rem] text-ink no-underline tracking-[-0.01em]" href="index.html">
      <Logo class="size-7" />Prisma
    </a>
    <nav class="flex flex-wrap items-center gap-5 phone:flex-nowrap phone:gap-2" aria-label="Pages du site">
      <PageLink v-for="[page, label] in PAGES" :key="page" :page="page" :current="current" :label="label" class="phone:hidden" />
      <ButtonLink primary small :href="APP">Ouvrir l'application</ButtonLink>
      <PagesMenu :current="current" />
    </nav>
  </header>
</template>
