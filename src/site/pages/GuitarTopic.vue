<script setup lang="ts">
/** Une idée de la page Guitare : son titre et son texte (le slot), et son exemple à côté. */
import type { RenderOptions } from "../../app/options/options.ts";
import Example from "../examples/Example.vue";
import Idea from "../layout/Idea.vue";
import IdeaText from "../layout/IdeaText.vue";

defineProps<{ id: string; title: string; text: string; label: string; options?: Partial<RenderOptions> }>();
</script>

<template>
  <Idea :id="id">
    <IdeaText>
      <h2>{{ title }}</h2>
      <slot />
    </IdeaText>
    <Example :text="text" :label="label" :scale="1.3" :options="options" />
  </Idea>
</template>
