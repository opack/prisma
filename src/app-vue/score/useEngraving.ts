/**
 * Du texte aux pages, en Vue : la partition lue puis gravée selon les options, regravée quand l'un
 * ou l'autre change. Une erreur de lecture laisse la partition vide et dit pourquoi.
 */
import { computed, toValue } from "vue";
import type { MaybeRefOrGetter } from "vue";
import type { RenderOptions } from "../../app/options/options.ts";
import { engraveOptions, engravePages, scoreOf } from "../../app/score/render.ts";

export function useEngraving(source: MaybeRefOrGetter<string>, options: MaybeRefOrGetter<RenderOptions>) {
  const read = computed(() => {
    try {
      return { score: scoreOf(toValue(source), "prisma", "") };
    } catch (error) {
      return { error: error instanceof Error ? error.message : String(error) };
    }
  });
  const pages = computed(() => (read.value.score ? engravePages(read.value.score, engraveOptions(toValue(options))) : []));
  return { score: computed(() => read.value.score), error: computed(() => read.value.error), pages };
}
