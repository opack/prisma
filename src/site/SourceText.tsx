import { forwardRef } from "react";
import type { ReactNode } from "react";

/**
 * Un texte .prisma, ou une tablature de texte (en plus grand), dans son cadre ; avec la place, à
 * droite, du bouton qui le copie.
 */
export const SourceText = forwardRef<HTMLPreElement, { tab?: boolean; withButton?: boolean; label?: string; children: ReactNode }>(function SourceText({ tab = false, withButton = false, label, children }, ref) {
  return (
    <pre ref={ref} className={`justify-self-start max-w-full m-0 p-4 bg-panel rounded-[10px] font-mono [font-variant-ligatures:none] overflow-x-auto ${tab ? "text-[15px] leading-[1.35]" : "text-[13px] leading-[1.45]"} ${withButton ? "pr-12" : ""}`} aria-label={label}>
      {children}
    </pre>
  );
});
