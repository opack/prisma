<script setup lang="ts">
/**
 * Vignette d'un morceau : le haut de sa première page (titre, premiers systèmes), calculé quand
 * la vignette paraît à l'écran.
 */
import { useIntersectionObserver } from "@vueuse/core";
import { computed, ref, shallowRef, useTemplateRef, watch } from "vue";
import type { LibraryEntry } from "./library.ts";
import { thumbOf } from "./thumbs.ts";
import type { Thumb } from "./thumbs.ts";
import type { RenderOptions } from "../options/options.ts";
import { engraveOptions } from "../score/render.ts";
import PageView from "../score/PageView.vue";

const { entry, options } = defineProps<{ entry: LibraryEntry; options: RenderOptions }>();

const NOTE = "absolute inset-0 grid place-items-center p-3 text-center text-muted text-[12px]";

const frame = useTemplateRef<HTMLSpanElement>("frame");
const visible = ref(false);
const { stop } = useIntersectionObserver(
  frame,
  ([observed]) => {
    if (!observed?.isIntersecting) return;
    visible.value = true;
    stop();
  },
  { root: computed(() => frame.value?.closest<HTMLElement>("[data-library]")), rootMargin: "300px" },
);

const result = shallowRef<{ thumb?: Thumb; error?: string }>();
const engraving = computed(() => JSON.stringify(engraveOptions(options)));
watch(
  [visible, () => entry, engraving],
  (_, __, onCleanup) => {
    if (!visible.value) return;
    let live = true;
    onCleanup(() => (live = false));
    result.value = undefined;
    thumbOf(entry, JSON.parse(engraving.value)).then((cached) => live && (result.value = cached));
  },
  { immediate: true },
);
</script>

<template>
  <span
    ref="frame"
    class="relative block aspect-[210/150] overflow-hidden mb-1.5 bg-white border border-line rounded-[3px] shadow-[0_1px_3px_rgba(0,0,0,0.08)] [&_.page]:w-full [&_.page]:h-auto [&_.page]:shadow-none [&_.page]:pointer-events-none"
    aria-hidden="true"
  >
    <PageView
      v-if="result?.thumb"
      :page="result.thumb.page"
      :total="result.thumb.total"
      :meta="result.thumb.meta"
      :options="options"
      still
    />
    <span v-if="result?.error" :class="NOTE">Aperçu impossible : le fichier ne se lit pas</span>
    <span v-if="result && !result.thumb && !result.error" :class="NOTE">Aucune mesure</span>
  </span>
</template>
