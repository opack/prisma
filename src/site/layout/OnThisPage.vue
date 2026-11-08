<script setup lang="ts">
/**
 * Sur cette page : les parties de la page, en liens côte à côte, chacun menant à sa partie. Chaque
 * page tient la liste de ses parties (leur ancre et un nom court) et donne la même ancre à la partie.
 * Dès que la liste sort de l'écran, les parties passent sous un bouton fixé en haut, et un
 * bouton, en bas à droite, y ramène (PartsBar).
 */
import RichLabel from "../../app/ui/RichLabel.ts";
import PartsBar from "./PartsBar.vue";
import type { PagePart } from "./PartsBar.vue";

defineProps<{ parts: PagePart[] }>();

const backToParts = () => document.getElementById("sur-cette-page")?.scrollIntoView({ block: "center" });
</script>

<template>
  <nav id="sur-cette-page" class="mt-8" aria-labelledby="on-this-page">
    <p id="on-this-page" class="mb-2 text-[0.95rem] text-muted">Sur cette page</p>
    <ul class="flex flex-wrap gap-2 m-0 p-0 list-none">
      <li v-for="part in parts" :key="part.id">
        <a
          class="inline-block px-3 py-1 border border-line rounded-full bg-white text-[0.95rem] text-ink no-underline hover:border-accent hover:text-accent"
          :href="`#${part.id}`"
        >
          <RichLabel :label="part.label" />
        </a>
      </li>
    </ul>
  </nav>
  <PartsBar :parts="parts" start="sur-cette-page" back-label="Retour aux parties de la page" @back="backToParts" />
</template>
