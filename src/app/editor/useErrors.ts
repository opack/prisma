/**
 * Les erreurs à montrer : celles du texte tel qu'il est (relu pendant la frappe), pas celle de la
 * dernière mise en page, qu'on a pu corriger depuis ; une erreur sans place (celle d'un import) reste
 * celle de la mise en page. Sous l'éditeur, on passe de l'une à l'autre ; corrigées, mais pas encore
 * remises en page, on le dit.
 */
import { useState } from "react";
import type { RefObject } from "react";
import type { EditorHandle } from "./SourceEditor.tsx";
import type { Problem } from "../files/useDocument.ts";

export function useErrors(engraved: Problem | undefined, editor: RefObject<EditorHandle | null>) {
  // le texte relu pendant la frappe : ses erreurs, toutes (undefined : pas encore relu)
  const [checked, setChecked] = useState<Problem[] | undefined>(undefined);
  const problems: Problem[] = engraved?.line !== undefined && checked !== undefined ? checked : engraved ? [engraved] : [];
  const [chosen, setChosen] = useState(0);
  const shown = problems.length ? Math.min(chosen, problems.length - 1) : 0;
  /** Place le curseur du texte sur une erreur. */
  const goTo = (line?: number, column = 1) => line && editor.current?.goTo(line, column);
  const show = (k: number) => {
    const n = (k + problems.length) % problems.length;
    setChosen(n);
    goTo(problems[n].line, problems[n].column);
  };
  const fixed = !!engraved && engraved.line !== undefined && checked !== undefined && !checked.length;
  return { problems, shown, problem: problems[shown] as Problem | undefined, show, goTo, fixed, setChecked };
}
