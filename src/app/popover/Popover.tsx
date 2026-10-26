/**
 * Un petit panneau ouvert depuis un bouton (le métronome, les parties, la mise en page), sous lui
 * ou au-dessus ; son titre, s'il en a un, puis son contenu. Son ouverture : usePopover.
 */
import type { ReactNode } from "react";

export function Popover({ label, title, above = false, className = "", children }: { label: string; title?: string; above?: boolean; className?: string; children: ReactNode }) {
  return (
    <div className={`absolute right-0 z-20 px-3 py-2.5 bg-white border border-line rounded-md shadow-[0_6px_20px_rgba(0,0,0,0.12)] grid gap-1.5 ${above ? "bottom-[calc(100%+8px)]" : "top-[calc(100%+6px)]"} ${className}`} role="dialog" aria-label={label}>
      {title && <p className="mt-0 mb-0.5 font-semibold">{title}</p>}
      {children}
    </div>
  );
}
