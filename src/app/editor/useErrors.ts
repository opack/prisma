/**
 * Les erreurs à montrer : celles du texte tel qu'il est (relu pendant la frappe), pas celle de la
 * dernière mise en page, qu'on a pu corriger depuis ; une erreur sans place (celle d'un import) reste
 * celle de la mise en page. Sous l'éditeur, on passe de l'une à l'autre ; corrigées, mais pas encore
 * remises en page, on le dit.
 */
import { computed, ref } from "vue";
import type { Ref } from "vue";
import type { Problem } from "../files/parse.ts";
import type { EditorHandle } from "./codemirror.ts";

export function useErrors(engraved: Ref<Problem | undefined>, editor: Ref<EditorHandle | null | undefined>) {
  // le texte relu pendant la frappe : ses erreurs, toutes (undefined : pas encore relu)
  const checked = ref<Problem[]>();
  const problems = computed<Problem[]>(() =>
    engraved.value?.line !== undefined && checked.value !== undefined ? checked.value : engraved.value ? [engraved.value] : [],
  );
  const chosen = ref(0);
  const shown = computed(() => (problems.value.length ? Math.min(chosen.value, problems.value.length - 1) : 0));
  const problem = computed<Problem | undefined>(() => problems.value[shown.value]);
  /** Place le curseur du texte sur une erreur. */
  const goTo = (line?: number, column = 1) => line && editor.value?.goTo(line, column);
  const show = (index: number) => {
    const wrapped = (index + problems.value.length) % problems.value.length;
    chosen.value = wrapped;
    goTo(problems.value[wrapped].line, problems.value[wrapped].column);
  };
  const fixed = computed(
    () => !!engraved.value && engraved.value.line !== undefined && checked.value !== undefined && !checked.value.length,
  );
  const setChecked = (found: Problem[]) => (checked.value = found);
  return { problems, shown, problem, show, goTo, fixed, setChecked };
}
