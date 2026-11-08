<script setup lang="ts">
/** Un exemple de la référence, dans l'application : son texte, puis sa gravure (ou l'erreur qui l'empêche). */
import { computed } from "vue";
import type { RenderOptions } from "../options/options.ts";
import Excerpt from "../score/Excerpt.vue";
import { engraveExample } from "../score/engraveExample.ts";

const props = defineProps<{ text: string; options: RenderOptions }>();
const engraved = computed(() => engraveExample(props.text, props.options));
</script>

<template>
  <pre
    class="m-0 px-3.5 py-2.5 bg-panel rounded font-mono text-[13px] leading-[1.45] [font-variant-ligatures:none] overflow-x-auto max-w-full"
    >{{ text }}</pre>
  <Excerpt v-if="engraved.pages" :pages="engraved.pages" :options="options" :scale="1.4" />
  <p v-else class="flex items-center gap-2 min-w-0 px-3 py-2 bg-error-bg text-error">{{ engraved.error }}</p>
</template>
