/**
 * À la place de la partition, pourquoi elle ne se met pas en page, et où corriger ; ou, l'erreur
 * corrigée, qu'il reste à remettre en page.
 */
import type { Problem } from "../files/useDocument.ts";
import { Message } from "../editor/message.tsx";
import { Button } from "../ui/button/Button.tsx";

const CARD = "max-w-[460px] mx-auto my-12 px-5 py-4 bg-white border border-line border-l-4 rounded-md shadow-[0_2px_10px_rgba(0,0,0,0.06)] [&_p]:mb-2";

export function EngraveProblem({ problems, fixed, autoEngrave, onEngrave, onShow }: { problems: Problem[]; fixed: boolean; autoEngrave: boolean; onEngrave: () => void; onShow: (k: number) => void }) {
  if (fixed)
    return (
      <div className={`${CARD} border-l-accent`} role="status">
        <p className="font-semibold">L'erreur est corrigée.</p>
        <p className="text-muted">Mettez le texte en page (Ctrl+Entrée) pour voir la partition.</p>
        <Button onClick={onEngrave}>Mettre en page</Button>
      </div>
    );
  if (!problems.length) return null;
  const first = problems[0];
  const several = problems.length > 1;
  const corrected = several ? "les erreurs corrigées" : "l'erreur corrigée";
  return (
    <div className={`${CARD} border-l-[#d22c2c]`} role="alert">
      <p className="font-semibold">{first.line ? `La partition ne peut pas être mise en page : le texte contient ${several ? `${problems.length} erreurs` : "une erreur"}.` : "La partition ne peut pas être affichée."}</p>
      <p>
        <Message text={first.message} />
      </p>
      {first.line !== undefined && (
        <>
          <p className="text-muted">{autoEngrave ? `Une fois ${corrected}, la mise en page reprend d'elle-même.` : `Une fois ${corrected}, remettez en page (Ctrl+Entrée).`}</p>
          <Button onClick={() => onShow(0)}>{several ? "Aller à la première" : "Aller à l'erreur"}</Button>
        </>
      )}
    </div>
  );
}
