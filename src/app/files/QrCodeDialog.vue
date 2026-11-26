<script setup lang="ts">
/**
 * Fichier › Partager par un QR code… : le QR code du morceau, en grand, à scanner d'un téléphone
 * (il ouvre le morceau dans Prisma, comme le lien de partage), et son image à télécharger. Un morceau
 * trop long pour un QR code le dit, et renvoie au fichier.
 */
import { computed } from "vue";
import FormDialog from "../ui/dialog/FormDialog.vue";
import type { QrCode } from "./qrCode.ts";
import { TOO_LONG } from "./useQrCode.ts";

/** code : undefined tant qu'il se prépare, null si le morceau est trop long. */
const { code, name } = defineProps<{ code: QrCode | null | undefined; name?: string }>();
const emit = defineEmits<{ download: []; close: [] }>();

/** La marge blanche autour du code, en modules, qu'il faut pour le lire. */
const MARGIN = 4;
/** Le côté du code, en modules, marge comprise ; et en pixels : un nombre entier de pixels par module, pour des modules nets, au plus près de 300. */
const side = computed(() => (code ? code.size + 2 * MARGIN : 0));
const pixels = computed(() => side.value * Math.max(2, Math.floor(300 / side.value)));
</script>

<template>
  <FormDialog
    title="Partager par un QR code"
    intro="Scannez-le avec un téléphone : il ouvre le morceau dans Prisma. Il contient le morceau lui-même, comme le lien de partage."
    :submit="code === null ? 'Fermer' : 'Télécharger l\'image'"
    :cancel="code === null ? null : 'Fermer'"
    focus-submit
    @submit="code ? emit('download') : emit('close')"
    @close="emit('close')"
  >
    <svg
      v-if="code"
      class="justify-self-center bg-white"
      :width="pixels"
      :height="pixels"
      :viewBox="`${-MARGIN} ${-MARGIN} ${side} ${side}`"
      role="img"
      :aria-label="`QR code de ${name ?? 'ce morceau'}`"
    >
      <path :d="code.path" fill="#000" shape-rendering="crispEdges" />
    </svg>
    <p v-else-if="code === null" class="m-0 text-brand" role="alert">{{ TOO_LONG }}.</p>
    <p v-else class="m-0 text-dim">Préparation du QR code…</p>
  </FormDialog>
</template>
