<script setup lang="ts">
/** Un lien en bouton : plein (l'appel principal) ou au trait ; petit, dans le haut des pages. */
defineProps<{ href: string; primary?: boolean; small?: boolean }>();
</script>

<template>
  <a
    :class="[
      'inline-block border-2 border-accent rounded-lg font-bold no-underline',
      small ? 'px-3.5 py-1.5 text-[0.95rem] whitespace-nowrap' : 'px-5 py-[11px]',
      primary
        ? 'bg-accent text-white hover:bg-[color-mix(in_srgb,var(--color-accent)_88%,#000)]'
        : 'bg-white text-accent hover:bg-accent-8',
    ]"
    :href="href"
  >
    <slot />
  </a>
</template>
