<script setup lang="ts">
/**
 * La ligne de portée d'une option du rendu, sous son explication : ce qu'en dit l'autre portée, et
 * de quoi passer de l'une à l'autre. Côté général, sans rien de propre à la partition, l'action ne
 * paraît qu'au survol de la ligne, pour ne pas encombrer.
 */
import { computed, toRef } from "vue";
import { DESCRIBE } from "../../app/options/choices.ts";
import type { PieceKey } from "../../app/options/piece.ts";
import { usePieceScope } from "./scope.ts";
import { useSettings } from "./settings.ts";

const props = defineProps<{ pieceKey: PieceKey }>();

const LINE = "col-start-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5 mt-1 mb-0 text-[0.9em] text-muted";
const BADGE = "inline-block px-1.5 rounded-[8px] bg-accent-14 text-accent text-[0.85em] font-semibold whitespace-nowrap";
const LINK = "p-0 text-accent underline bg-transparent border-0 cursor-pointer";

const settings = useSettings();
const { onPiece, mark, same, toPiece, toGeneral, unset } = usePieceScope(toRef(props, "pieceKey"));
const generalValue = computed(() => DESCRIBE[props.pieceKey](settings.general));
const pieceValue = computed(() => DESCRIBE[props.pieceKey]({ ...settings.general, ...settings.piece.options }));
</script>

<template>
  <template v-if="onPiece">
    <p v-if="mark === 'follows'" :class="LINE">
      <span class="text-muted">option générale</span>
      <button :class="LINK" title="La partition garde cette valeur, quelles que soient les options générales" @click="toPiece">
        Définir pour la partition
      </button>
    </p>
    <p v-else :class="LINE">
      <span :class="BADGE">partition</span>
      <span v-if="same" class="text-muted">comme l'option générale</span>
      <template v-else>
        <span class="text-muted">générale : {{ generalValue }}</span>
        <button :class="LINK" title="Cette valeur devient l'option générale, pour tous les morceaux" @click="toGeneral">
          Appliquer aux générales
        </button>
        <button :class="LINK" title="La partition prend la valeur de l'option générale, et la garde" @click="toPiece">
          Reprendre la générale
        </button>
      </template>
      <button :class="LINK" title="Retirer de la partition : elle suit alors l'option générale" @click="unset">Retirer</button>
    </p>
  </template>
  <p v-else-if="mark === 'overridden'" :class="LINE">
    <span :class="BADGE">partition : {{ pieceValue }}</span>
    <span class="text-muted">elle prime sur cette option</span>
    <button :class="LINK" title="La partition prend cette valeur" @click="toPiece">Appliquer à la partition</button>
    <button :class="LINK" title="L'option générale prend la valeur de la partition" @click="toGeneral">Reprendre la sienne</button>
  </p>
  <p v-else-if="mark === 'same'" :class="LINE">
    <span :class="BADGE">partition : idem</span>
  </p>
  <p
    v-else
    class="invisible col-start-1 row-start-2 self-start m-0 text-muted text-[0.8em] leading-[1.3] group-hover:visible group-focus-within:visible"
  >
    <button :class="LINK" title="La partition garde cette valeur, quelles que soient les options générales" @click="toPiece">
      Appliquer à la partition
    </button>
  </p>
</template>
