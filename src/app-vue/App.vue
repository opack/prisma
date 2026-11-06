<script setup lang="ts">
import { ref } from "vue";
import { Button } from "./ui/button";

const version = __VERSION__;
const greeted = ref(false);
</script>

<template>
  <main class="grid h-full place-content-center justify-items-center gap-3">
    <p class="text-muted">Prisma {{ version }}, bientôt en Vue.</p>
    <Button @click="greeted = true">{{ greeted ? "Bonjour !" : "Saluer" }}</Button>
  </main>
</template>
