<script setup lang="ts">
/**
 * Une idée : son texte, et son exemple à côté (l'un sous l'autre sur un écran étroit) ; large, tout
 * l'un sous l'autre ; une étape d'Apprendre, son texte et son exemple calés en haut.
 */
import { provide } from "vue";
import { IDEA_KIND } from "./idea.ts";
import type { IdeaKind } from "./idea.ts";
import Section from "./Section.vue";

const { kind = "side" } = defineProps<{ kind?: IdeaKind; id?: string }>();
provide(IDEA_KIND, kind);
</script>

<template>
  <Section
    :id="id"
    :class="
      kind === 'wide'
        ? 'grid grid-cols-[minmax(0,1fr)] gap-6 items-center'
        : `grid grid-cols-[minmax(0,5fr)_minmax(0,7fr)] gap-10 narrow:grid-cols-[minmax(0,1fr)] narrow:gap-6 ${kind === 'step' ? 'items-start' : 'items-center'}`
    "
  >
    <slot />
  </Section>
</template>
