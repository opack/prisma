<script setup lang="ts">
/**
 * La référence (REFERENCE.md), affichée dans l'application et sur le site : chaque exemple
 * ` ```prisma ` y est gravé par le vrai moteur de gravure, sous son texte (le site les montre à sa
 * façon, par le slot example). La référence suit donc toujours la gravure, sans images à régénérer.
 * À sa gauche, le sommaire : ses parties et sous-parties, un clic pour y aller ; celle qu'on lit est
 * mise en évidence pendant qu'on fait défiler. Sur un écran étroit, le sommaire passe sous un bouton.
 */
import { useEventListener } from "@vueuse/core";
import { computed, nextTick, onMounted, ref, shallowRef } from "vue";
import reference from "../../../REFERENCE.md?raw";
import type { RenderOptions } from "../../app/options/options.ts";
import { render } from "../../app/reference/markdown.ts";
import ContentsMenu from "../ui/ContentsMenu.vue";
import ScrollBackButton from "../ui/ScrollBackButton.vue";
import ReferenceExample from "./ReferenceExample.vue";

const { options, site = "../.." } = defineProps<{ options: RenderOptions; site?: string }>();
defineSlots<{ example?(props: { text: string }): unknown }>();

const rendered = computed(() => render(reference, site));
const headings = computed(() => rendered.value.headings);
const root = ref<HTMLElement>();
/** Les places des exemples, une fois la référence écrite dans la page. */
const slots = shallowRef<HTMLElement[]>([]);
const current = ref(headings.value[0]?.id);
/** Plus d'un écran passé : le bouton qui ramène en haut de la référence. */
const away = ref(false);
/** La zone qui défile : le panneau de l'application, ou la page elle-même sur le site. */
const pane = shallowRef<Element>();

const scrollIntoView = (id: string, behavior: ScrollBehavior) => document.getElementById(id)?.scrollIntoView({ behavior, block: "start" });

let frame = 0;
/** La partie lue : le dernier titre passé sous le haut de la zone qui défile ; tout en bas, la dernière, même courte. */
function spy() {
  cancelAnimationFrame(frame);
  frame = requestAnimationFrame(() => {
    const scroller = pane.value;
    if (!scroller) return;
    const top = (scroller === document.scrollingElement ? 0 : scroller.getBoundingClientRect().top) + 90;
    let id = headings.value[0]?.id;
    for (const heading of headings.value) {
      const element = document.getElementById(heading.id);
      if (element && element.getBoundingClientRect().top <= top) id = heading.id;
    }
    if (scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 2) id = headings.value[headings.value.length - 1]?.id;
    current.value = id;
    away.value = scroller.scrollTop > scroller.clientHeight;
  });
}

onMounted(async () => {
  slots.value = [...(root.value?.querySelectorAll<HTMLElement>(".example") ?? [])];
  pane.value = root.value?.closest(".guide-pane") ?? document.scrollingElement ?? undefined;
  useEventListener(pane.value === document.scrollingElement ? window : pane.value, "scroll", spy, { passive: true });
  spy();
  // une partie demandée par l'adresse (reference.html#… sur le site) : la référence et ses exemples
  // s'écrivent après le chargement, le navigateur n'a pas pu y aller seul
  await nextTick();
  const id = decodeURIComponent(location.hash.slice(1));
  if (id) scrollIntoView(id, "instant");
});

const backToTop = () =>
  pane.value?.scrollTo({ top: 0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
</script>

<template>
  <div class="grid grid-cols-[240px_minmax(0,860px)] justify-center gap-2 [@media(max-width:980px)]:grid-cols-[minmax(0,1fr)]">
    <nav
      class="sticky top-[60px] self-start max-h-[calc(100vh-140px)] overflow-auto py-6 pl-4 text-[13.5px] leading-[1.35] [@media(max-width:980px)]:hidden"
      aria-label="Sommaire de la référence"
    >
      <p class="mb-2 text-[12px] font-semibold tracking-[0.04em] uppercase text-muted">Sommaire</p>
      <ul class="m-0 p-0 list-none border-l border-line">
        <li v-for="heading in headings" :key="heading.id">
          <!-- une partie en gras, une sous-partie en retrait ; celle qu'on lit, à l'accent -->
          <a
            :class="[
              'block py-1 px-2.5 -ml-px border-l-2 no-underline hover:bg-panel',
              heading.depth === 2 ? 'mt-1.5 font-semibold' : '',
              heading.depth === 3 ? 'pl-[22px]' : '',
              heading.id === current
                ? 'text-accent border-l-accent'
                : `border-l-transparent ${heading.depth === 2 ? 'text-ink' : 'text-muted hover:text-ink'}`,
            ]"
            :href="`#${heading.id}`"
            :aria-current="heading.id === current ? 'location' : undefined"
            @click.prevent="scrollIntoView(heading.id, 'smooth')"
          >
            {{ heading.text }}
          </a>
        </li>
      </ul>
    </nav>
    <!-- sur un écran étroit, sans la place du sommaire : un bouton, collé en haut, qui dit la partie lue et l'ouvre -->
    <ContentsMenu
      class="sticky top-0 z-10 hidden [@media(max-width:980px)]:block"
      title="Sommaire"
      :entries="headings.map((heading) => ({ id: heading.id, label: heading.text, depth: heading.depth === 3 ? 3 : 2 }))"
      :current="current"
      @go="(id) => scrollIntoView(id, 'smooth')"
    />
    <article class="guide max-w-[860px] m-0 pt-6 px-8 pb-16 text-[15px] leading-[1.55]">
      <!-- eslint-disable-next-line vue/no-v-html -- la référence, écrite par nous, rendue par marked -->
      <div ref="root" v-html="rendered.html" />
      <Teleport v-for="slot in slots" :key="slot.dataset.example" :to="slot">
        <slot name="example" :text="rendered.examples[Number(slot.dataset.example)]">
          <ReferenceExample :text="rendered.examples[Number(slot.dataset.example)]" :options="options" />
        </slot>
      </Teleport>
    </article>
    <ScrollBackButton v-if="away" class="fixed right-6 bottom-6 z-10" label="Retour en haut de la référence" @click="backToTop" />
  </div>
</template>
