<script setup lang="ts">
/**
 * Une page gravée, en SVG, en millimètres : l'en-tête sur la première, le récapitulatif des grilles
 * d'accord sous le titre, l'ordre de jeu des sections, les systèmes, et le numéro de la page. Le même
 * dessin sert à l'écran, à l'impression (une page tient exactement sur une feuille) et aux aperçus.
 * À l'écran, elle est vivante : le curseur de lecture, un clic pour écouter d'un endroit, le signe du
 * texte sous le curseur de l'éditeur ; immobile (still), elle n'est que dessin (l'impression).
 */
import { headerHeight, METRICS, PAGE } from "./engrave.ts";
import type { Page } from "./engrave.ts";
import type { RenderOptions } from "../options/options.ts";
import type { Meta } from "../../core/index.ts";
import "./page.css";
import { FONT, GREY, INK } from "./drawing.ts";
import OrderLine from "./OrderLine.vue";
import PageHeader from "./PageHeader.vue";
import PlayCursor from "./PlayCursor.vue";
import SeekAreas from "./SeekAreas.vue";
import ChordGrid from "./system/ChordGrid.vue";
import SystemView from "./system/SystemView.vue";
import TextMarks from "./TextMarks.vue";

const { still = false } = defineProps<{ page: Page; total: number; meta: Meta; options: RenderOptions; still?: boolean }>();
</script>

<template>
  <svg
    class="page"
    :viewBox="`0 0 ${PAGE.w} ${PAGE.h}`"
    :width="`${PAGE.w}mm`"
    :height="`${PAGE.h}mm`"
    :font-family="FONT"
    style="font-variant-numeric: tabular-nums"
  >
    <rect :width="PAGE.w" :height="PAGE.h" fill="#fff" />
    <PageHeader v-if="page.header" :meta="meta" :names="options.scoreNames" />
    <!-- le récapitulatif des grilles, sous le titre : chaque accord du morceau, une fois -->
    <g v-for="(item, index) in page.chart" :key="'cc' + index">
      <text :x="item.x" :y="item.y + 3.4" font-size="3.4" font-weight="700" :fill="INK">{{ item.name }}</text>
      <ChordGrid :shape="item.shape" :x="item.x + 0.3" :y="item.y + METRICS.chordNameH" />
    </g>
    <OrderLine
      v-if="page.order.length > 0"
      :order="page.order"
      :y="page.header ? PAGE.marginTop + headerHeight(meta) - 1 : PAGE.marginTop - 2"
      :live="!still"
    />
    <!-- les noms des parties : au premier système du morceau, comme sur une partition, ou à chaque système (option) -->
    <SystemView
      v-for="(system, index) in page.systems"
      :key="index"
      :system="system"
      :options="options"
      :names="(page.index === 0 && index === 0) || options.namesEverySystem"
    />
    <text :x="PAGE.w / 2" :y="PAGE.h - 8" font-size="2.6" text-anchor="middle" :fill="GREY">{{ page.index + 1 }} / {{ total }}</text>
    <template v-if="!still">
      <TextMarks :systems="page.systems" />
      <SeekAreas :systems="page.systems" />
      <PlayCursor :page="page" :look-ahead="options.lookAhead" />
    </template>
  </svg>
</template>
