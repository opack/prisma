<script setup lang="ts">
/** La gravure d'un exemple dans son cadre, sans son texte. */
import type { RenderOptions } from "../../app/options/options.ts";
import { frame } from "./frame.ts";
import Score from "./Score.vue";

defineProps<{ text: string; options?: Partial<RenderOptions>; scale?: number; label: string; guide?: boolean }>();
</script>

<template>
  <figure :class="frame(guide)" :aria-label="label">
    <Score :text="text" :options="options" :scale="scale" />
  </figure>
</template>
