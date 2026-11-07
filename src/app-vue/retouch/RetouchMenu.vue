<script setup lang="ts">
/**
 * Le choix de la note d'une case, ouvert par un double-clic sur la partition : les douze notes de
 * l'octave (avec leur nom), ou sur une corde ses cases, de 0 à la dernière ; la tenue, ou la case vidée.
 * Sur une corde, le choix d'une autre corde y montre ses cases (celle du même son marquée) : une case
 * choisie y place la note (qui coupe celle qui y sonnait encore). Sur une note, sa durée, qu'on allonge ou
 * raccourcit d'une case sans quitter le choix ; sur une case vide, les notes de son couloir qu'elle
 * peut tenir. Il s'ouvre à côté du clic, dans l'écran (le popover de Reka UI) ; Échap ou un clic
 * ailleurs le ferme. Il prend le clavier sans désigner de bouton : la case actuelle seule est marquée.
 */
import { computed, ref } from "vue";
import { MAX_FRET, midiOf, noteName } from "../../core/index.ts";
import { mainOf } from "../../core/locate.ts";
import type { NameDisplay } from "../../app/options/options.ts";
import { writtenNames } from "../../app/options/options.ts";
import { joinCell, splitCell } from "../../app/retouch/retouch.ts";
import type { CellParts } from "../../app/retouch/retouch.ts";
import { Button } from "../ui/button";
import KeyboardPicker from "../ui/keyboard/KeyboardPicker.vue";
import { Popover, PopoverAnchor, PopoverContent } from "../ui/popover";

const props = defineProps<{
  /** Où ouvrir le choix, à l'écran. */
  x: number;
  y: number;
  /** L'octave de la case (scientifique : celle du do central vaut 4). */
  octave?: number;
  /** Sur une corde : son numéro, ce que font sonner les cordes à vide (MIDI, capo compris, de la 1 à la plus grave), et celles où la note peut passer. */
  strings?: { string: number; open: number[]; free: boolean[] };
  /** Ce que contient la case, et si une tenue peut s'y écrire. */
  content: string;
  canHold: boolean;
  /** La durée de la note de la case (en cases), et ce qu'on peut en faire. */
  duration?: { count: number; longer: boolean; shorter: boolean };
  /** Les notes qu'une case vide peut tenir. */
  holds?: string[];
  names: NameDisplay;
  /** Si la note peut monter ou descendre d'une octave (sur une corde : passer sur la corde du dessus ou du dessous). */
  octaves?: { up: boolean; down: boolean };
}>();
const emit = defineEmits<{
  /** Une note, la tenue (« - ») ou le vide (« ») dans la case. */
  pick: [content: string];
  /** Place la note sur une corde, à une case. */
  string: [string: number, fret: number];
  /** La corde dont on montre les cases a changé. */
  target: [string: number];
  resize: [by: 1 | -1];
  hold: [note: string];
  /** Monte ou descend la note d'une octave (le choix reste ouvert). */
  octave: [direction: 1 | -1];
  /** Réécrit la case (un ajout à sa note) sans fermer le choix. */
  amend: [content: string];
  close: [];
}>();

/** Un numéro de note, ramené entre 1 et 12. */
const wrap = (note: number) => ((((note - 1) % 12) + 12) % 12) + 1;
const NOTE = "mt-2 mb-0 text-muted text-[12px] leading-[1.35]";
const AMEND_BUTTON = "flex-1 font-mono";

const current = computed(() => mainOf(props.content));
// la corde dont on montre les cases : celle de la note, ou une autre où la placer
const target = ref(props.strings?.string ?? 0);
const elsewhere = computed(() => !!props.strings && target.value !== props.strings.string);

const written = computed(() => writtenNames(props.names));
const short = (midi: number) => noteName(midi, written.value).replace(/ \(.*\)$/, "");
function name(number: number, string = props.strings?.string) {
  if (props.strings) return short(props.strings.open[string! - 1] + number);
  return props.octave === undefined ? "" : short(midiOf(props.octave, number));
}
// le son de la note actuelle, pour marquer la case qui le donne sur une autre corde
const sounding = computed(() =>
  props.strings && /^\d+$/.test(current.value) ? props.strings.open[props.strings.string - 1] + Number(current.value) : undefined,
);
const parts = computed(() => splitCell(props.content));
// sur une corde, les cases de 0 à la dernière ; sinon les douze notes, que la trille fait boucler
const choices = computed(() =>
  props.strings ? Array.from({ length: MAX_FRET + 1 }, (_, index) => index) : Array.from({ length: 12 }, (_, index) => index + 1),
);
const near = (number: number) => (props.strings ? (number >= 0 && number <= MAX_FRET ? number : undefined) : wrap(number));
// la voisine d'une trille : la plus proche qui porte ce numéro, au-dessus ou au-dessous
function neighbour(number: number) {
  if (props.strings) return name(number);
  if (props.octave === undefined || !parts.value) return "";
  const main = midiOf(props.octave, Number(parts.value.note));
  const closest = [-1, 0, 1]
    .map((shift) => midiOf(props.octave! + shift, number))
    .filter((midi) => midi !== main)
    .sort((first, second) => Math.abs(first - main) - Math.abs(second - main))[0];
  return noteName(closest, written.value).replace(/ \(.*\)$/, "") || String(number);
}
const amend = (change: Partial<CellParts>) => parts.value && emit("amend", joinCell({ ...parts.value, ...change }));

const label = computed(() => {
  if (props.strings) return `corde ${target.value}${written.value === "none" ? "" : ` (${name(0, target.value)})`}`;
  if (props.octave === undefined) return "";
  return props.octave === 4 ? "octave 0" : `octave ${props.octave > 4 ? "+" : "−"}${Math.abs(props.octave - 4)}`;
});

const fingers = computed(() => (props.strings ? [1, 2, 3, 4] : [1, 2, 3, 4, 5]));
const trills = computed(() =>
  [1, 2, -1, -2].map((step) => near(Number(parts.value!.note) + step)).flatMap((number) => (number === undefined ? [] : [String(number)])),
);
const graces = computed(() =>
  [-2, -1, 1, 2]
    .map((step) => Number(parts.value!.note) + step)
    .filter((grace) => (props.strings ? grace >= 0 && grace <= MAX_FRET : grace >= 1 && grace <= 12))
    .map(String),
);

function chooseString(string: number) {
  target.value = string;
  emit("target", string);
}
function stringTitle(string: number) {
  if (!props.strings!.free[string - 1]) return `la corde ${string} attaque déjà une note à cet instant`;
  return string === props.strings!.string ? "la corde de la note" : `montrer les cases de la corde ${string}, pour y placer la note`;
}
/** Sur une autre corde, la case qui donne le même son que la note. */
const sameSound = (number: number) => elsewhere.value && props.strings!.open[target.value - 1] + number === sounding.value;
function choose(number: number) {
  if (props.strings) emit("string", target.value, number);
  else emit("pick", String(number));
}
function toggleGrace(grace: string) {
  const on = parts.value!.graces.includes(grace);
  amend({ graces: on ? parts.value!.graces.filter((other) => other !== grace) : [...parts.value!.graces, grace] });
}

/** Le focus au choix lui-même, comme une fenêtre de React Aria : aucun bouton désigné. */
function focusPanel(event: Event) {
  event.preventDefault();
  // l'évènement vient de l'enveloppe qui place le choix
  (event.target as HTMLElement).querySelector<HTMLElement>('[role="dialog"]')?.focus();
}
</script>

<template>
  <Popover :open="true" @update:open="(open) => open || emit('close')">
    <!-- le point du clic, auquel le choix s'accroche -->
    <PopoverAnchor as-child>
      <span class="fixed size-0" :style="{ left: `${x}px`, top: `${y}px` }" />
    </PopoverAnchor>
    <PopoverContent
      class="block gap-0 w-[300px] p-2.5 bg-white border border-line rounded-lg ring-0 shadow-[0_8px_24px_rgba(0,0,0,0.16)] text-ink text-[length:inherit]"
      role="dialog"
      tabindex="-1"
      aria-label="Note de la case"
      side="bottom"
      align="start"
      :side-offset="8"
      :align-offset="8"
      @open-auto-focus="focusPanel"
    >
      <div class="flex items-center justify-between mt-0 mb-2 text-[12.5px] font-semibold">
        <p class="m-0">
          {{ strings ? "Case" : "Note de la case" }} <span class="ml-1 font-normal text-muted">{{ label }}</span>
        </p>
        <span v-if="octaves" class="flex gap-1">
          <Button
            size="small"
            :disabled="!octaves.up"
            :title="octaves.up ? 'monter la note d\'une octave, avec ses tenues' : 'plus haut que le clavier'"
            aria-label="Une octave au-dessus"
            @click="emit('octave', 1)"
          >
            ▲
          </Button>
          <Button
            size="small"
            :disabled="!octaves.down"
            :title="octaves.down ? 'descendre la note d\'une octave, avec ses tenues' : 'plus bas que le clavier'"
            aria-label="Une octave au-dessous"
            @click="emit('octave', -1)"
          >
            ▼
          </Button>
        </span>
      </div>

      <div v-if="strings" class="grid grid-flow-col auto-cols-fr gap-1 mb-1.5 pb-1.5 border-b border-line" role="group" aria-label="Corde">
        <Button
          v-for="(_, index) in strings.open"
          :key="index"
          size="small"
          :pressed="index + 1 === target"
          :disabled="!strings.free[index]"
          :title="stringTitle(index + 1)"
          @click="chooseString(index + 1)"
        >
          <span class="grid justify-items-center gap-px">
            <b :class="['font-mono text-[13px]', index + 1 === strings.string ? 'underline underline-offset-2' : '']">{{ index + 1 }}</b>
            <small v-if="written !== 'none'" class="text-[10px] text-muted">{{ name(0, index + 1) }}</small>
          </span>
        </Button>
      </div>

      <KeyboardPicker v-if="names === 'keyboard' && !strings" :current="current" @pick="emit('pick', $event)" />
      <div v-else class="grid grid-cols-6 gap-1">
        <Button
          v-for="number in choices"
          :key="number"
          size="small"
          :pressed="!elsewhere && String(number) === current"
          :title="sameSound(number) ? `${name(number, target)}, le même son` : name(number, target) || undefined"
          @click="choose(number)"
        >
          <!-- sur une autre corde, la case du même son : son numéro souligné de tirets -->
          <span :class="['grid justify-items-center gap-px', written === 'none' ? 'py-1' : '']">
            <b
              :class="[
                'font-mono text-[15px]',
                sameSound(number) ? 'underline decoration-dashed decoration-accent underline-offset-3' : '',
              ]"
              >{{ number }}</b
            >
            <small v-if="written !== 'none'" class="text-[10.5px] text-muted">{{ name(number, target) }}</small>
          </span>
        </Button>
      </div>

      <p v-if="!content && !elsewhere" :class="NOTE">La note choisie, le choix reste ouvert : son doigté, sa trille, sa durée.</p>
      <p v-if="elsewhere" :class="NOTE">
        Choisissez une case : la note passe sur la corde {{ target }}, avec ses tenues, et coupe ce qui y sonnait encore.
      </p>

      <div
        v-if="parts && !elsewhere"
        class="grid grid-cols-[auto_1fr] items-center gap-x-2 gap-y-1 mt-2 pt-2 text-[13px] border-t border-line"
      >
        <span class="text-muted">Doigt</span>
        <div class="flex gap-1">
          <Button
            v-for="finger in fingers"
            :key="finger"
            :class="AMEND_BUTTON"
            size="small"
            :pressed="parts.finger === String(finger)"
            :title="parts.finger === String(finger) ? 'retirer le doigté' : `jouer avec le doigt ${finger}`"
            @click="amend({ finger: parts.finger === String(finger) ? undefined : String(finger) })"
          >
            {{ finger }}
          </Button>
        </div>
        <span class="text-muted">Trille</span>
        <div class="flex gap-1">
          <Button
            v-for="trill in trills"
            :key="trill"
            :class="AMEND_BUTTON"
            size="small"
            :pressed="parts.trill === trill"
            :title="parts.trill === trill ? 'retirer la trille' : `alterner avec ${neighbour(Number(trill))}`"
            @click="amend({ trill: parts.trill === trill ? undefined : trill })"
          >
            ~{{ trill }}
          </Button>
        </div>
        <span class="text-muted">Petite note</span>
        <div class="flex gap-1">
          <Button
            v-for="grace in graces"
            :key="grace"
            :class="AMEND_BUTTON"
            size="small"
            :pressed="parts.graces.includes(grace)"
            :title="
              parts.graces.includes(grace) ? 'retirer cette petite note' : `${name(Number(grace)) || grace} joué très vite juste avant`
            "
            @click="toggleGrace(grace)"
          >
            {{ grace }}&#8217;
          </Button>
        </div>
      </div>

      <div v-if="duration && !elsewhere" class="flex items-center gap-1.5 mt-2 pt-2 text-[13px] border-t border-line">
        <span class="flex-1 text-muted">Durée</span>
        <Button
          size="small"
          :disabled="!duration.shorter"
          :title="duration.shorter ? 'raccourcir d\'une case : la dernière tenue s\'efface' : 'la note ne dure qu\'une case'"
          aria-label="Raccourcir d'une case"
          @click="emit('resize', -1)"
        >
          −
        </Button>
        <b class="min-w-[5.5em] text-center font-semibold">{{ duration.count }} case{{ duration.count > 1 ? "s" : "" }}</b>
        <Button
          size="small"
          :disabled="!duration.longer"
          :title="
            duration.longer
              ? 'allonger d\'une case : une tenue de plus (sur une autre ligne de l\'octave si la case d\'après est prise)'
              : 'la note va jusqu\'au bout du morceau'
          "
          aria-label="Allonger d'une case"
          @click="emit('resize', 1)"
        >
          +
        </Button>
      </div>

      <div v-if="holds?.length && !elsewhere" class="grid gap-1 mt-2 pt-2 border-t border-line">
        <Button
          v-for="hold in holds"
          :key="hold"
          :title="`le ${hold} de la case d'avant continue dans celle-ci`"
          @click="emit('hold', hold)"
        >
          <span class="flex-1 text-left"
            >Tenir le {{ hold }} <small class="ml-1 text-muted">{{ name(Number(hold)) }}</small></span
          >
        </Button>
      </div>

      <div v-if="!elsewhere" class="flex gap-1 mt-1.5">
        <Button
          class="flex-1"
          :pressed="current === '-'"
          :disabled="!canHold"
          :title="canHold ? 'la note de la case d\'avant continue' : 'aucune note à prolonger dans la case d\'avant'"
          @click="emit('pick', '-')"
        >
          – Tenue
        </Button>
        <Button class="flex-1" :disabled="!content" title="rien ne sonne dans cette case sur cette ligne" @click="emit('pick', '')"
          >Vider</Button
        >
      </div>
    </PopoverContent>
  </Popover>
</template>
