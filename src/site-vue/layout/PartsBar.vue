<script setup lang="ts">
/**
 * Pendant la lecture d'une page, une fois passé son haut (l'élément start) : ses parties sous un
 * bouton fixé en haut de l'écran, qui dit celle qu'on lit ; et, en bas à droite, un bouton qui
 * ramène en haut (back). Une partie choisie arrive sous le bouton du haut.
 */
import { useEventListener } from "@vueuse/core";
import { onMounted, onUnmounted, ref } from "vue";
import ContentsMenu from "../../app-vue/ui/ContentsMenu.vue";
import type { ContentsEntry } from "../../app-vue/ui/ContentsMenu.vue";
import ScrollBackButton from "../../app-vue/ui/ScrollBackButton.vue";

export type PagePart = Omit<ContentsEntry, "depth">;

const props = defineProps<{ parts: PagePart[]; start: string; backLabel: string }>();
const emit = defineEmits<{ back: [] }>();

/** La place que prend le bouton du haut, au-dessus d'une partie qu'on y amène (px). */
const BAR = 64;

const away = ref(false);
const current = ref<string>();

let frame = 0;
function spy() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    away.value = (document.getElementById(props.start)?.getBoundingClientRect().bottom ?? 1) < 0;
    // la partie lue : la dernière dont le haut est passé sous le bouton du haut
    current.value = props.parts
      .filter((part) => (document.getElementById(part.id)?.getBoundingClientRect().top ?? Infinity) <= BAR + 16)
      .pop()?.id;
  });
}
onMounted(spy);
onUnmounted(() => cancelAnimationFrame(frame));
useEventListener(window, "scroll", spy, { passive: true });

function go(id: string) {
  const element = document.getElementById(id);
  if (element)
    scrollTo({
      top: element.getBoundingClientRect().top + scrollY - BAR,
      behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
}
</script>

<template>
  <template v-if="away">
    <ContentsMenu class="fixed inset-x-0 top-0 z-20" title="Sur cette page" :entries="parts" :current="current" @go="go" />
    <ScrollBackButton class="fixed right-6 bottom-6 z-10" :label="backLabel" @click="emit('back')" />
  </template>
</template>
