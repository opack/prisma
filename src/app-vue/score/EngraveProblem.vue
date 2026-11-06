<script setup lang="ts">
/**
 * À la place de la partition, pourquoi elle ne se met pas en page, et où corriger ; ou, l'erreur
 * corrigée, qu'il reste à remettre en page.
 */
import { computed } from "vue";
import type { Problem } from "../../app/files/parse.ts";
import Message from "../editor/Message.vue";
import { Button } from "../ui/button";

const props = defineProps<{ problems: Problem[]; fixed: boolean; autoEngrave: boolean }>();
const emit = defineEmits<{ engrave: []; show: [index: number] }>();

const CARD =
  "max-w-[460px] mx-auto my-12 px-5 py-4 bg-white border border-line border-l-4 rounded-md shadow-[0_2px_10px_rgba(0,0,0,0.06)] [&_p]:mb-2";
const first = computed(() => props.problems[0]);
const several = computed(() => props.problems.length > 1);
const corrected = computed(() => (several.value ? "les erreurs corrigées" : "l'erreur corrigée"));
</script>

<template>
  <div v-if="fixed" :class="[CARD, 'border-l-accent']" role="status">
    <p class="font-semibold">L'erreur est corrigée.</p>
    <p class="text-muted">Mettez le texte en page (Ctrl+Entrée) pour voir la partition.</p>
    <Button @click="emit('engrave')">Mettre en page</Button>
  </div>
  <div v-else-if="problems.length" :class="[CARD, 'border-l-[#d22c2c]']" role="alert">
    <p class="font-semibold">
      {{
        first.line
          ? `La partition ne peut pas être mise en page : le texte contient ${several ? `${problems.length} erreurs` : "une erreur"}.`
          : "La partition ne peut pas être affichée."
      }}
    </p>
    <p><Message :text="first.message" /></p>
    <template v-if="first.line !== undefined">
      <p class="text-muted">
        {{
          autoEngrave
            ? `Une fois ${corrected}, la mise en page reprend d'elle-même.`
            : `Une fois ${corrected}, remettez en page (Ctrl+Entrée).`
        }}
      </p>
      <Button @click="emit('show', 0)">{{ several ? "Aller à la première" : "Aller à l'erreur" }}</Button>
    </template>
  </div>
</template>
