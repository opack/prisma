<script setup lang="ts">
/**
 * Glisser-déposer un fichier sur la fenêtre pour l'ouvrir : tant qu'un fichier la survole, elle le
 * dit. Le compteur suit les entrées et sorties successives au-dessus des éléments de la page. Sa
 * place (class) dépend de ce qui l'entoure.
 */
import { ref } from "vue";
import { droppedFile } from "./files.ts";
import type { StoredFile } from "./stored.ts";

const emit = defineEmits<{ file: [dropped: { file: File; handle: StoredFile | null }] }>();

const over = ref(false);
let depth = 0;
const hasFile = (event: DragEvent) => [...(event.dataTransfer?.types ?? [])].includes("Files");

function enter(event: DragEvent) {
  if (!hasFile(event)) return;
  event.preventDefault();
  depth++;
  over.value = true;
}
function leave(event: DragEvent) {
  if (!hasFile(event)) return;
  if (--depth <= 0) {
    depth = 0;
    over.value = false;
  }
}
function overZone(event: DragEvent) {
  if (!hasFile(event)) return;
  event.preventDefault();
  event.dataTransfer!.dropEffect = "copy";
}
async function drop(event: DragEvent) {
  if (!hasFile(event)) return;
  event.preventDefault();
  depth = 0;
  over.value = false;
  const dropped = await droppedFile(event.dataTransfer!);
  if (dropped) emit("file", dropped);
}
</script>

<template>
  <div @dragenter="enter" @dragleave="leave" @dragover="overZone" @drop="drop">
    <div
      v-if="over"
      class="absolute inset-0 z-20 grid place-content-center text-center gap-1 bg-[rgba(43,93,110,.12)] border-3 border-dashed border-accent pointer-events-none"
      aria-hidden="true"
    >
      <p class="text-[22px] font-bold text-accent">Déposer pour ouvrir</p>
      <span class="text-muted">.prisma ou .musicxml</span>
    </div>
    <slot />
  </div>
</template>
