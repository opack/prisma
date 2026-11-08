<script setup lang="ts">
/** Une étape d'Apprendre : son titre numéroté et son texte (le slot), puis l'exemple à copier et sa gravure. */
import { slug } from "../../app/reference/slug.ts";
import Engraving from "../examples/Engraving.vue";
import Source from "../examples/Source.vue";
import Idea from "../layout/Idea.vue";
import IdeaText from "../layout/IdeaText.vue";

export type Step = { title: string; text: string; label: string };

defineProps<{ number: number; step: Step }>();
</script>

<template>
  <Idea :id="slug(step.title)" kind="step">
    <IdeaText>
      <h2>{{ number }}. {{ step.title }}</h2>
      <slot />
    </IdeaText>
    <div class="grid grid-cols-[minmax(0,1fr)] justify-items-start gap-3 min-w-0">
      <Source :text="step.text" />
      <Engraving :text="step.text" :label="step.label" />
    </div>
  </Idea>
</template>
