<script setup lang="ts">
/**
 * Le cartouche du QR code, en fin de partition : dans un cadre fin, le code à gauche, et à droite ce
 * qu'il fait et le site (son seul domaine) ; imprimé avec la page, il ramène au morceau dans Prisma.
 */
import { QR_CARD, qrCardSize } from "./engrave.ts";
import { GREY, INK } from "./drawing.ts";
import type { QrCode } from "../files/qrCode.ts";

const { x, y, qr } = defineProps<{ x: number; y: number; qr: QrCode; site: string }>();

const textX = QR_CARD.padding + QR_CARD.qr + QR_CARD.gap;
const middle = qrCardSize.h / 2;
</script>

<template>
  <g :transform="`translate(${x} ${y})`">
    <rect :width="qrCardSize.w" :height="qrCardSize.h" rx="1.5" fill="#fff" :stroke="GREY" stroke-width="0.25" />
    <g
      role="img"
      aria-label="QR code du morceau : scanné, il l'ouvre dans Prisma"
      :transform="`translate(${QR_CARD.padding} ${QR_CARD.padding}) scale(${QR_CARD.qr / qr.size})`"
    >
      <path :d="qr.path" fill="#000" shape-rendering="crispEdges" />
    </g>
    <text :x="textX" :y="middle - 5" font-size="3.2" :fill="INK">Scannez ce code pour ouvrir</text>
    <text :x="textX" :y="middle" font-size="3.2" :fill="INK">ce morceau dans Prisma</text>
    <text :x="textX" :y="middle + 7" font-size="3.6" font-weight="700" :fill="INK">{{ site }}</text>
  </g>
</template>
