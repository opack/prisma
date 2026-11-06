<script setup lang="ts">
/** Le lien d'une page ; celui de la page où l'on est s'écrit comme le texte, sans soulignement. */
import type { SitePage } from "./pages.ts";

defineProps<{ page: SitePage; current: SitePage; label: string }>();
</script>

<template>
  <a
    class="aria-[current=page]:text-ink aria-[current=page]:no-underline"
    :href="`${page}.html`"
    :aria-current="page === current ? 'page' : undefined"
  >
    {{ label }}
  </a>
</template>
