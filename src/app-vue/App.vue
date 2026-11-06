<script setup lang="ts">
/**
 * L'application Vue, en construction : pour l'instant, la partition du morceau en cours (celui que
 * garde l'application React dans le navigateur), gravée avec ses options.
 */
import { loadOptions } from "../app/options/options.ts";
import PageView from "./score/PageView.vue";
import { useEngraving } from "./score/useEngraving.ts";

const source = localStorage.getItem("prisma:source") ?? "";
const options = loadOptions();
const { score, error, pages } = useEngraving(source, options);
</script>

<template>
  <main class="flex h-full flex-col items-center gap-6 overflow-auto p-6" aria-label="Partition">
    <p v-if="error" class="text-error">{{ error }}</p>
    <p v-else-if="!pages.length" class="text-muted">Aucune mesure à mettre en page.</p>
    <PageView v-for="page in pages" :key="page.index" :page="page" :total="pages.length" :meta="score!.meta" :options="options" />
  </main>
</template>
