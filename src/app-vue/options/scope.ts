/**
 * La portée des options montrées dans le panneau : les générales, pour tous les morceaux, ou celles
 * de la partition ouverte, qui priment sur elles. Le panneau la fournit (provide) à ses lignes ;
 * chaque ligne d'une option du rendu en tire sa marque : définie pour la partition (own), suivant
 * la générale (follows), ou, côté général, remplacée par la partition (overridden).
 */
import { computed, inject } from "vue";
import type { InjectionKey, Ref } from "vue";
import type { RenderOptions } from "../../app/options/options.ts";
import type { PieceKey } from "../../app/options/piece.ts";
import { useSettings } from "./settings.ts";

export type Portee = "general" | "piece";
export const PORTEE: InjectionKey<Readonly<Ref<Portee>>> = Symbol("portée des options");

export type ScopeMark = "own" | "follows" | "overridden" | "same" | "none";

/** Ce qu'une ligne sait de sa portée : de quel côté on est, sa marque, et de quoi passer d'une portée à l'autre. */
export function usePieceScope(key: Readonly<Ref<PieceKey | undefined>>) {
  const settings = useSettings();
  const portee = inject(PORTEE)!;
  const onPiece = computed(() => portee.value === "piece");
  const own = computed<Partial<RenderOptions>>(() => settings.piece.options ?? {});
  const isOwn = computed(() => key.value !== undefined && own.value[key.value] !== undefined);
  const same = computed(() => key.value !== undefined && own.value[key.value] === settings.general[key.value]);
  const mark = computed<ScopeMark>(() => {
    if (key.value === undefined) return "none";
    if (onPiece.value) return isOwn.value ? "own" : "follows";
    if (!isOwn.value) return "none";
    return same.value ? "same" : "overridden";
  });
  const pick = (from: Partial<RenderOptions>) => ({ [key.value!]: from[key.value!] }) as Partial<RenderOptions>;
  return {
    onPiece,
    mark,
    same,
    /** La partition prend la valeur générale. */
    toPiece: () => settings.setPieceOptions(pick(settings.general)),
    /** La générale prend la valeur de la partition. */
    toGeneral: () => settings.setOptions(pick(own.value)),
    /** La partition ne définit plus l'option : elle suit la générale. */
    unset: () => settings.unsetPieceOptions([key.value!]),
  };
}
