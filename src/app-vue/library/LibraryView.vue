<script setup lang="ts">
/**
 * La bibliothèque : les morceaux du dossier choisi (un dossier de l'ordinateur, ou le dossier de
 * Prisma sur pCloud), rangés par sous-dossier, à chercher et à trier, en liste ou en vignettes (le
 * haut de leur première page) ; un clic ouvre le morceau. Sans bibliothèque, le choix entre les deux,
 * expliqué ; sur pCloud, où Prisma ne voit que son dossier, comment y mettre ses partitions.
 */
import { useStorage } from "@vueuse/core";
import { computed, ref, useTemplateRef, watch } from "vue";
import { SORTS, countOf, groupEntries } from "../../app/library/browse.ts";
import type { Kinds, LibraryView, Sort } from "../../app/library/browse.ts";
import type { LibraryEntry } from "../../app/library/library.ts";
import { session } from "../../app/library/pcloud.ts";
import type { RenderOptions } from "../../app/options/options.ts";
import BackButton from "../ui/button/BackButton.vue";
import ButtonGroup from "../ui/button/ButtonGroup.vue";
import { Button } from "../ui/button";
import FolderIcon from "../ui/icons/FolderIcon.vue";
import RefreshIcon from "../ui/icons/RefreshIcon.vue";
import LibraryCard from "./LibraryCard.vue";
import LibraryRow from "./LibraryRow.vue";
import LibrarySources from "./LibrarySources.vue";
import PcloudEmpty from "./PcloudEmpty.vue";
import { useLibrarySource } from "./useLibrarySource.ts";

const { options } = defineProps<{ options: RenderOptions }>();
const emit = defineEmits<{ open: [entry: LibraryEntry]; close: [] }>();

/** Une explication de la bibliothèque (le dossier à choisir, à autoriser…). */
const NOTE = "text-muted leading-[1.5]";
/** Afficher, Trier par : leur nom, puis leur liste. */
const TOOL = "flex items-center gap-2 text-muted whitespace-nowrap";
const SELECT = "px-1.5 py-[5px] bg-white border border-line rounded";

const { state, load, change, chooseFolder, choosePcloud, leavePcloud } = useLibrarySource();

const view = useStorage<LibraryView>("prisma:library-view", "thumbs");
const sort = useStorage<Sort>("prisma:library-sort", "title");
const kinds = useStorage<Kinds>("prisma:library-kinds", "all");
// vignettes : chaque partition avec ses propres options, quand elle en a, ou toutes avec les générales
const thumbsOwn = useStorage("prisma:thumbs-own", true);
const query = ref("");
// la recherche prend le clavier dès que les morceaux paraissent (autofocus ne vaut qu'au chargement de la page)
const search = useTemplateRef<HTMLInputElement>("search");
watch(search, (input) => input?.focus());

const entries = computed(() => (state.value.kind === "ready" ? state.value.entries : []));
const groups = computed(() => groupEntries(entries.value, query.value, sort.value, kinds.value));
const count = computed(() => groups.value.reduce((sum, group) => sum + group.entries.length, 0));
const source = computed(() => (state.value.kind === "ready" || state.value.kind === "locked" ? state.value.source : undefined));
const thumbOptions = (entry: LibraryEntry) => (thumbsOwn.value && entry.own ? { ...options, ...entry.own } : options);
const nothingFound = computed(() => {
  if (query.value.trim()) return `Aucun morceau ne correspond à « ${query.value.trim()} ».`;
  return kinds.value === "prisma" ? "Aucune partition Prisma dans ce dossier." : "Aucun MusicXML à importer dans ce dossier.";
});
</script>

<template>
  <main data-library class="flex-1 overflow-auto bg-white">
    <BackButton shortcut="Ctrl+B" @click="emit('close')" />
    <div class="max-w-[860px] mx-auto px-8 pt-2 pb-16">
      <header>
        <h1 class="mx-0 mt-2 mb-1 text-[26px]">Bibliothèque</h1>
        <p v-if="source" class="flex flex-wrap items-center gap-2 mt-0 mb-4 text-muted">
          {{ source.label }}
          <Button
            size="icon"
            title="Changer de bibliothèque : un autre dossier, ou pCloud"
            aria-label="Changer de bibliothèque"
            @click="change"
          >
            <FolderIcon />
          </Button>
          <Button
            v-if="state.kind === 'ready'"
            size="icon"
            title="Actualiser : relire le dossier"
            aria-label="Actualiser"
            @click="load(source)"
          >
            <RefreshIcon />
          </Button>
          <Button
            v-if="source.kind === 'pcloud' && session()"
            size="small"
            title="Se déconnecter de pCloud, dans ce navigateur"
            @click="leavePcloud"
          >
            Se déconnecter
          </Button>
        </p>
        <p
          v-if="state.kind === 'ready' && state.source.kind === 'pcloud' && state.entries.length > 0"
          :class="[NOTE, '-mt-2 mb-4 text-[13px]']"
        >
          Prisma ne voit que ce dossier de votre pCloud : vos partitions doivent y être.
        </p>
      </header>

      <p v-if="state.kind === 'unsupported'" :class="NOTE">
        La bibliothèque a besoin de garder l'accès à un dossier de votre disque, ce que seuls Chrome et Edge savent faire. Ici, ouvrez vos
        morceaux par Fichier › Ouvrir, ou en les glissant dans la fenêtre.
      </p>
      <p v-else-if="state.kind === 'loading'" :class="NOTE">Lecture du dossier…</p>
      <LibrarySources v-else-if="state.kind === 'none'" @folder="chooseFolder" @pcloud="choosePcloud" />
      <div v-else-if="state.kind === 'locked'" :class="NOTE">
        <p class="mt-0 mb-3">{{ state.source.locked.hint }}</p>
        <p v-if="state.reason" class="-mt-1 mb-3 text-[13px] text-error">{{ state.reason }}</p>
        <Button kind="primary" @click="load(state.source, true)">{{ state.source.locked.action }}</Button>
      </div>
      <div v-else-if="state.kind === 'error'" :class="NOTE">
        <p class="mt-0 mb-3">Lecture du dossier impossible : {{ state.message }}</p>
        <Button kind="primary" @click="change">Choisir une bibliothèque</Button>
      </div>

      <template v-else-if="state.kind === 'ready'">
        <div class="flex flex-wrap items-center gap-x-4 gap-y-2.5 mt-0 mb-5">
          <input
            ref="search"
            v-model="query"
            class="flex-[1_1_100%] min-w-0 px-2.5 py-[7px] border border-line rounded"
            type="search"
            placeholder="Chercher un titre, un compositeur…"
            aria-label="Chercher"
          />
          <label :class="TOOL">
            Afficher
            <select v-model="kinds" :class="SELECT">
              <option value="all">Tout ({{ countOf(state.entries, "all") }})</option>
              <option value="prisma">Partitions Prisma ({{ countOf(state.entries, "prisma") }})</option>
              <option value="musicxml">MusicXML à importer ({{ countOf(state.entries, "musicxml") }})</option>
            </select>
          </label>
          <label :class="TOOL">
            Trier par
            <select v-model="sort" :class="SELECT">
              <option v-for="choice in SORTS" :key="choice.value" :value="choice.value">{{ choice.label }}</option>
            </select>
          </label>
          <label
            v-if="view === 'thumbs'"
            class="inline-flex items-center gap-1.5 text-muted whitespace-nowrap cursor-pointer"
            title="Les vignettes montrent chaque partition avec ses propres options, si elle en a ; sinon avec les options générales"
          >
            <input v-model="thumbsOwn" type="checkbox" />
            Options de chaque partition
          </label>
          <ButtonGroup class="ml-auto" label="Présentation">
            <Button size="icon" :pressed="view === 'list'" title="En liste" aria-label="En liste" @click="view = 'list'">
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M1.5 3h2v2h-2zM5.5 3.25h9v1.5h-9zM1.5 7h2v2h-2zM5.5 7.25h9v1.5h-9zM1.5 11h2v2h-2zM5.5 11.25h9v1.5h-9z"
                />
              </svg>
            </Button>
            <Button
              size="icon"
              :pressed="view === 'thumbs'"
              title="En vignettes : le haut de la première page"
              aria-label="En vignettes"
              @click="view = 'thumbs'"
            >
              <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path fill="currentColor" d="M1.5 1.5h5.5v5.5h-5.5zM9 1.5h5.5v5.5H9zM1.5 9h5.5v5.5h-5.5zM9 9h5.5v5.5H9z" />
              </svg>
            </Button>
          </ButtonGroup>
        </div>
        <template v-if="!state.entries.length">
          <PcloudEmpty v-if="state.source.kind === 'pcloud'" />
          <p v-else :class="NOTE">Aucune partition (.prisma ou MusicXML) dans ce dossier.</p>
        </template>
        <p v-else-if="!count" :class="NOTE">{{ nothingFound }}</p>
        <section v-for="group in groups" :key="group.folder">
          <h2 v-if="group.folder" class="mx-0 mt-6 mb-1.5 text-[13px] uppercase tracking-[.06em] text-muted">{{ group.folder }}</h2>
          <ul v-if="view === 'thumbs'" class="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-[18px] m-0 px-0 pt-1 pb-0 list-none">
            <li v-for="entry in group.entries" :key="entry.path">
              <LibraryCard :entry="entry" :options="thumbOptions(entry)" :folder="sort === 'recent'" @open="emit('open', entry)" />
            </li>
          </ul>
          <ul v-else class="m-0 p-0 list-none border-t border-line">
            <li v-for="entry in group.entries" :key="entry.path" class="border-b border-line">
              <LibraryRow :entry="entry" :folder="sort === 'recent'" @open="emit('open', entry)" />
            </li>
          </ul>
        </section>
      </template>
    </div>
  </main>
</template>
