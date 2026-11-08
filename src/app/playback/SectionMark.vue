<script setup lang="ts">
/** La lettre d'une section, blanc sur noir, le signe des sections sur la partition. */
defineProps<{ label: string }>();
</script>

<template>
  <span
    class="inline-grid place-items-center min-w-[1.5em] h-[1.5em] px-1 rounded-[2px] bg-ink text-white text-[11px] font-bold leading-none"
    >{{ label }}</span
  >
</template>
