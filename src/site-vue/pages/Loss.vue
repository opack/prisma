<script setup lang="ts">
/** Ce que Prisma perd, une chose : son nom, et pourquoi (le slot). */
defineProps<{ what: string }>();
</script>

<template>
  <div>
    <dt class="font-bold mb-1">{{ what }}</dt>
    <dd class="m-0 text-[#303437]"><slot /></dd>
  </div>
</template>
