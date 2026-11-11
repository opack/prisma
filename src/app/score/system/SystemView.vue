<script setup lang="ts">
/**
 * Un système gravé : la règle et les accords, les noms des parties et leurs accolades, les couloirs
 * (onglets d'octave, fonds, notes), le sens du médiator, les séparations des portées, les arpèges,
 * les barres, puis sous chaque portée ses liaisons, ses paroles, ses nuances et sa pédale, et
 * au-dessus de tout les textes et les marques de structure.
 */
import { computed } from "vue";
import { METRICS, PAGE, graceExtra, isPickSign, leadExtra } from "../engrave.ts";
import type { PlacedSystem } from "../engrave.ts";
import type { RenderOptions } from "../../options/options.ts";
import { engravedNames } from "../../options/options.ts";
import { laneTint } from "../colors.ts";
import { arpeggioPath } from "../geometry.ts";
import { numberOf, octaveOffset, pitchClass, stringsOfStaff } from "../../../core/index.ts";
import type { SystemRow } from "../../../core/index.ts";
import { BAND, INK, TAB, WAVE } from "../drawing.ts";
import Brace from "./Brace.vue";
import ChordSymbols from "./ChordSymbols.vue";
import LyricBand from "./LyricBand.vue";
import NoteRow from "./NoteRow.vue";
import OctaveTabs from "./OctaveTabs.vue";
import PartBars from "./PartBars.vue";
import PedalBand from "./PedalBand.vue";
import Ruler from "./Ruler.vue";
import SlurBand from "./SlurBand.vue";
import SystemMarks from "./SystemMarks.vue";
import VoiceBand from "./VoiceBand.vue";
import { alternating, articulationsOf, attacks, edges, laneSpans, onPage, rowTop } from "./system.ts";

const props = defineProps<{
  system: PlacedSystem;
  options: RenderOptions;
  /** Écrire le nom des parties : au premier système du morceau, comme sur une partition, ou à chaque système (option). */
  names: boolean;
}>();

const placed = computed(() => onPage(props.system));
const lanes = computed(() => {
  const { left, right } = edges(placed.value);
  return laneSpans(placed.value, left, right);
});

// une couleur par octave (option), ou par corde, chacune la sienne ; sans palette, une bande grise un couloir sur deux
const tint = (row: SystemRow) => laneTint(props.options.laneColors, row.string !== undefined ? 4 - row.string : octaveOffset(row.octave));
const tabFill = (row: SystemRow) => tint(row)?.tab ?? TAB;
// le nom d'une corde, celui de sa note à vide dans l'accordage (le capo n'y change rien, comme pour
// le guitariste), selon l'option des noms de notes de la partition ; en Prisma, aucun : un numéro à côté
// de celui de la corde se lirait comme une case
const stringName = (staff: number) => (string: number) => {
  const strings = stringsOfStaff(placed.value.sys.parts, staff);
  const names = engravedNames(props.options.scoreNames);
  return strings && names !== "none" ? pitchClass(numberOf(strings.open[string - 1]), names) : "";
};

/** Les fonds des couloirs, d'abord : les notes, dessinées ensuite, ne sont jamais recouvertes. */
const bands = computed(() =>
  placed.value.sys.staves.flatMap((systemStaff, staff) => {
    const alternate = alternating(systemStaff.rows);
    return systemStaff.rows.flatMap((row, index) => {
      const fill = tint(row)?.band ?? (alternate[index] ? BAND : undefined);
      return fill
        ? lanes.value.map(([from, to], span) => ({
            key: `${staff}-${index}-${span}`,
            x: from,
            y: rowTop(placed.value, staff, index),
            width: to - from,
            fill,
          }))
        : [];
    });
  }),
);

const parts = computed(() =>
  placed.value.parts.map((part) => ({
    ...part,
    braced: part.last > part.first,
    rowsTop: placed.value.staves[part.first].rowsTop,
    bottom: placed.value.staves[part.last].voiceTop + placed.value.staves[part.last].voiceBand,
  })),
);

/** Au-dessus des cordes, le sens du médiator, en grand : ⊓ vers le bas, V vers le haut. */
const pickSigns = computed(() => {
  const { sys, staves } = placed.value;
  return sys.staves.flatMap((systemStaff, staff) =>
    systemStaff.voice.marks
      .filter((mark) => mark.kind === "articulation" && isPickSign(mark.text))
      .map((mark, index) => {
        const cx = placed.value.xs[sys.anchors[mark.anchor]] + leadExtra(sys, mark.anchor) + 0.5 + METRICS.noteDigit / 2;
        const cy = staves[staff].techTop + METRICS.techH * 0.55;
        const down = mark.text === "d";
        return {
          key: `${staff}-${index}`,
          down,
          path: down
            ? `M ${cx - 0.9} ${cy + 1} L ${cx - 0.9} ${cy - 0.9} L ${cx + 0.9} ${cy - 0.9} L ${cx + 0.9} ${cy + 1}`
            : `M ${cx - 0.85} ${cy - 1} L ${cx} ${cy + 1} L ${cx + 0.85} ${cy - 1}`,
        };
      }),
  );
});

/** Les arpèges : une vaguelette devant l'accord, de sa note la plus grave à la plus aiguë. */
const arpeggios = computed(() => {
  const { sys, xs, rowH } = placed.value;
  return sys.arpeggios.flatMap((arpeggio) => {
    const tops = sys.staves.flatMap((systemStaff, staff) =>
      arpeggio.staff === undefined || arpeggio.staff === staff
        ? systemStaff.rows.flatMap((row, index) => (attacks(row, arpeggio.anchor) ? [rowTop(placed.value, staff, index)] : []))
        : [],
    );
    if (!tops.length) return [];
    const x = xs[sys.anchors[arpeggio.anchor]] + graceExtra(sys, arpeggio.anchor) + METRICS.arpeggioW / 2 + 0.2;
    return [arpeggioPath(x, Math.min(...tops) + 0.5, Math.max(...tops) + rowH - 0.5, arpeggio.down)];
  });
});
</script>

<template>
  <g>
    <Ruler :placed="placed" />
    <ChordSymbols :placed="placed" :options="options" />
    <g v-for="(part, index) in parts" :key="'in' + index">
      <Brace v-if="part.braced && part.bottom > part.rowsTop" :x="PAGE.marginX - 0.3" :top="part.rowsTop" :bottom="part.bottom" />
      <text
        v-if="names && part.name"
        :x="PAGE.marginX - (part.braced ? 2.2 : 0.8)"
        :y="(part.rowsTop + part.bottom) / 2 + 1"
        font-size="2.8"
        font-style="italic"
        text-anchor="end"
        :fill="INK"
      >
        {{ part.name }}
      </text>
    </g>
    <OctaveTabs
      v-for="(systemStaff, staff) in placed.sys.staves"
      :key="'ot' + staff"
      :rows="systemStaff.rows"
      :top="placed.staves[staff].rowsTop"
      :mark-style="options.octaveStyle"
      :position="options.octavePosition"
      :row-height="placed.rowH"
      :tab-fill="tabFill"
      :string-name="stringName(staff)"
    />
    <rect v-for="band in bands" :key="band.key" :x="band.x" :y="band.y" :width="band.width" :height="placed.rowH" :fill="band.fill" />
    <template v-for="(systemStaff, staff) in placed.sys.staves" :key="'r' + staff">
      <NoteRow
        v-for="(row, index) in systemStaff.rows"
        :key="index"
        :placed="placed"
        :row="row"
        :y="rowTop(placed, staff, index)"
        :centered="options.notePosition === 'center'"
        :articulations="articulationsOf(placed, staff, index)"
        :reminders="options.holdReminders"
        :tech-top="placed.staves[staff].techTop"
      />
    </template>
    <path
      v-for="sign in pickSigns"
      :key="sign.key"
      :d="sign.path"
      fill="none"
      :stroke="INK"
      :stroke-width="sign.down ? 0.42 : 0.36"
      stroke-linejoin="miter"
    />
    <!-- un trait épais entre deux parties d'un même instrument -->
    <template v-for="(staffPlace, staff) in placed.staves" :key="'sep' + staff">
      <template v-if="staffPlace.separator !== undefined">
        <line
          v-for="([from, to], span) in lanes"
          :key="span"
          :x1="from"
          :x2="to"
          :y1="staffPlace.separator"
          :y2="staffPlace.separator"
          :stroke="INK"
          stroke-width="0.5"
        />
      </template>
    </template>
    <path v-for="(arpeggio, index) in arpeggios" :key="'arp' + index" :d="arpeggio" v-bind="WAVE" />
    <PartBars v-for="(part, index) in placed.parts" :key="'bars' + index" :placed="placed" :part="part" />
    <g v-for="(systemStaff, staff) in placed.sys.staves" :key="'bands' + staff">
      <SlurBand
        v-if="placed.staves[staff].slurBand > 0"
        :placed="placed"
        :voice="systemStaff.voice"
        :rows="systemStaff.rows"
        :top="placed.staves[staff].slurTop"
      />
      <LyricBand
        v-if="placed.staves[staff].lyricBand > 0"
        :placed="placed"
        :voice="systemStaff.voice"
        :top="placed.staves[staff].lyricTop"
      />
      <VoiceBand
        v-if="placed.staves[staff].voiceBand > 0"
        :placed="placed"
        :voice="systemStaff.voice"
        :top="placed.staves[staff].voiceTop"
      />
      <PedalBand
        v-if="placed.staves[staff].pedalBand > 0"
        :placed="placed"
        :pedal="systemStaff.pedal"
        :top="placed.staves[staff].pedalTop"
      />
    </g>
    <SystemMarks :placed="placed" />
  </g>
</template>
