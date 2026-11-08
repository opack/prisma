<script setup lang="ts">
/**
 * Un extrait gravé, pour illustrer la référence et le site : les systèmes seuls, sans page ni
 * en-tête, recadrés au plus près, précédés de l'ordre de jeu s'il y en a un. Un extrait tient sur
 * une page ; s'il en déborde, les pages suivantes sont décalées à la suite.
 */
import { computed } from "vue";
import { METRICS, PAGE } from "./engrave.ts";
import type { Page } from "./engrave.ts";
import type { RenderOptions } from "../options/options.ts";
import { FONT } from "./drawing.ts";
import OrderLine from "./OrderLine.vue";
import SystemView from "./system/SystemView.vue";

const props = withDefaults(defineProps<{ pages: Page[]; options: RenderOptions; scale?: number }>(), { scale: 1 });

const PAD = 1.5;

const frame = computed(() => {
  const { pages } = props;
  const systems = pages.flatMap((page) => page.systems);
  if (!systems.length) return undefined;
  // à gauche, la place de l'accolade et des noms de parties
  const first = systems[0];
  const named = first.parts.filter((part) => part.name).map((part) => [...part.name!].length * 1.45 + 2.6);
  const braced = first.parts.some((part) => part.last > part.first) ? 1.8 : 0;
  const left = PAGE.marginX - PAD - Math.max(braced, ...named);
  const right = Math.max(...systems.map((system) => system.xs[system.xs.length - 1] + system.ws[system.ws.length - 1])) + PAD;
  let offset = 0;
  const placed = pages.flatMap((page, index) => {
    if (index)
      offset +=
        Math.max(...pages[index - 1].systems.map((system) => system.y + system.height)) -
        Math.min(...page.systems.map((system) => system.y)) +
        METRICS.systemGap;
    return page.systems.map((system) => ({ ...system, y: system.y + offset }));
  });
  const order = pages[0].order;
  const top = Math.min(...placed.map((system) => system.y));
  const orderY = top - METRICS.orderH; // l'ordre de jeu, comme en tête de page
  const y0 = (order.length ? orderY : top) - PAD;
  const y1 = Math.max(...placed.map((system) => system.y + system.height)) + PAD;
  return { left, right, top: y0, width: right - left, height: y1 - y0, placed, order, orderY };
});
</script>

<template>
  <svg
    v-if="frame"
    class="excerpt block max-w-full h-auto"
    :viewBox="`${frame.left} ${frame.top} ${frame.width} ${frame.height}`"
    :width="`${frame.width * scale}mm`"
    :height="`${frame.height * scale}mm`"
    :font-family="FONT"
    style="font-variant-numeric: tabular-nums"
  >
    <rect :x="frame.left" :y="frame.top" :width="frame.width" :height="frame.height" fill="#fff" />
    <OrderLine v-if="frame.order.length > 0" :order="frame.order" :y="frame.orderY" :cx="(frame.left + frame.right) / 2" />
    <SystemView
      v-for="(system, index) in frame.placed"
      :key="index"
      :system="system"
      :options="options"
      :names="index === 0 || options.namesEverySystem"
    />
  </svg>
</template>
