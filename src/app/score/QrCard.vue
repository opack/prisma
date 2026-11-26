<script setup lang="ts">
/**
 * Le cartouche du QR code, en fin de partition : dans un cadre fin, le code à gauche, et à droite ce
 * qu'il fait et le site (son seul domaine) ; imprimé avec la page, il ramène au morceau dans Prisma.
 */
import { computed } from "vue";
import { QR_CARD } from "./engrave.ts";
import type { Page } from "./engrave.ts";
import { GREY, INK } from "./drawing.ts";
import type { QrCode } from "../files/qrCode.ts";

const { card, qr } = defineProps<{ card: NonNullable<Page["qrCard"]>; qr: QrCode; site: string }>();

const textX = computed(() => QR_CARD.padding + card.side + QR_CARD.gap);
const middle = computed(() => card.h / 2);
</script>

<template>
  <g :transform="`translate(${card.x} ${card.y})`">
    <rect :width="card.w" :height="card.h" rx="1.5" fill="#fff" :stroke="GREY" stroke-width="0.25" />
    <g
      role="img"
      aria-label="QR code du morceau : scanné, il l'ouvre dans Prisma"
      :transform="`translate(${QR_CARD.padding} ${QR_CARD.padding}) scale(${card.side / qr.size})`"
    >
      <path :d="qr.path" fill="#000" shape-rendering="crispEdges" />
    </g>
    <text :x="textX" :y="middle - 5" font-size="3.2" :fill="INK">Scannez ce code pour ouvrir</text>
    <text :x="textX" :y="middle" font-size="3.2" :fill="INK">ce morceau dans Prisma</text>
    <text :x="textX" :y="middle + 7" font-size="3.6" font-weight="700" :fill="INK">{{ site }}</text>
  </g>
</template>
