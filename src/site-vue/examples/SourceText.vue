<script setup lang="ts">
/**
 * Un texte .prisma, ou une tablature de texte (en plus grand), dans son cadre ; avec la place, à
 * droite, du bouton qui le copie.
 */
defineProps<{ tab?: boolean; withButton?: boolean; label?: string }>();
</script>

<template>
  <pre
    :class="[
      'justify-self-start max-w-full m-0 p-4 bg-panel rounded-[10px] font-mono [font-variant-ligatures:none] overflow-x-auto',
      tab ? 'text-[15px] leading-[1.35]' : 'text-[13px] leading-[1.45]',
      { 'pr-12': withButton },
    ]"
    :aria-label="label"
  ><slot /></pre>
</template>
