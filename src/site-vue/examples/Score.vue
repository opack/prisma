<script setup lang="ts">
/** La gravure seule d'un exemple, aux réglages par défaut sauf ceux donnés ; ou l'erreur qui l'empêche. */
import { computed } from "vue";
import { DEFAULT_OPTIONS } from "../../app/options/options.ts";
import type { RenderOptions } from "../../app/options/options.ts";
import Excerpt from "../../app-vue/score/Excerpt.vue";
import { engraveExample } from "../../app-vue/score/engraveExample.ts";
import Caption from "../layout/Caption.vue";

const { text, options = {}, scale = 1.5 } = defineProps<{ text: string; options?: Partial<RenderOptions>; scale?: number }>();

const merged = computed(() => ({ ...DEFAULT_OPTIONS, ...options }));
const engraved = computed(() => engraveExample(text, merged.value));
</script>

<template>
  <Excerpt v-if="engraved.pages" :pages="engraved.pages" :options="merged" :scale="scale" />
  <Caption v-else>{{ engraved.error }}</Caption>
</template>
