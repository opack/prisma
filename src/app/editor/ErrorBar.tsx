/**
 * Sous l'éditeur, l'erreur du texte : un clic y mène ; s'il y en a plusieurs, on passe de l'une à
 * l'autre (F8 et Maj+F8 dans l'éditeur aussi).
 */
import type { Problem } from "../files/useDocument.ts";
import { Button } from "../ui/button/Button.tsx";
import { Message } from "./message.tsx";

export function ErrorBar({ problems, shown, onGoTo, onShow }: { problems: Problem[]; shown: number; onGoTo: (line?: number, column?: number) => void; onShow: (k: number) => void }) {
  const problem = problems[shown];
  return (
    <div className="flex items-center gap-2 min-w-0 border-t border-error bg-error-bg text-error">
      <button className="flex-1 min-w-0 text-left px-4 py-2.5 cursor-pointer" onClick={() => onGoTo(problem.line, problem.column)} title="aller à l'erreur">
        <Message text={problem.message} />
      </button>
      {problems.length > 1 && (
        <span className="shrink-0 flex items-center gap-1 pr-2.5 tabular-nums text-[13px] whitespace-nowrap">
          <Button size="small" onClick={() => onShow(shown - 1)} title="erreur précédente (Maj+F8 dans l'éditeur)" aria-label="Erreur précédente">
            ‹
          </Button>
          <span>
            {shown + 1}/{problems.length}
          </span>
          <Button size="small" onClick={() => onShow(shown + 1)} title="erreur suivante (F8 dans l'éditeur)" aria-label="Erreur suivante">
            ›
          </Button>
        </span>
      )}
    </div>
  );
}
