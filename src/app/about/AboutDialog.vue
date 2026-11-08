<script setup lang="ts">
/**
 * À propos de Prisma : son nom, sa version (et le commit construit, pour signaler un problème), puis
 * les nouveautés de chaque version (CHANGELOG.md), la plus récente en haut, qui défilent.
 */
import changelog from "../../../CHANGELOG.md?raw";
import { releases } from "./changelog.ts";
import FormDialog from "../ui/dialog/FormDialog.vue";

const emit = defineEmits<{ close: [] }>();

const list = releases(changelog);
const version = __VERSION__;
const commit = __COMMIT__;
</script>

<template>
  <FormDialog
    title="À propos de Prisma"
    intro="Lire, écrire et jouer la musique en Prisma, une notation chromatique."
    submit="Fermer"
    :cancel="null"
    focus-submit
    @submit="emit('close')"
    @close="emit('close')"
  >
    <p class="m-0 flex items-baseline gap-2">
      <span class="font-semibold">Version {{ version }}</span>
      <span v-if="commit" class="font-mono text-[12px] text-dim" title="Le commit construit, à donner pour signaler un problème">{{
        commit
      }}</span>
    </p>
    <section
      class="grid gap-3 max-h-[min(50vh,420px)] overflow-auto px-3 py-2.5 bg-white border border-line rounded"
      aria-label="Nouveautés"
    >
      <article v-for="release in list" :key="release.version" class="text-[14px] leading-[1.4]">
        <h3 class="m-0 text-[14px]">
          {{ release.version }}&#32;<span class="font-normal text-dim">· {{ release.date }}</span>
        </h3>
        <!-- eslint-disable-next-line vue/no-v-html -- le CHANGELOG du dépôt, rendu par marked -->
        <div v-html="release.html" />
      </article>
    </section>
  </FormDialog>
</template>
