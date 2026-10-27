/**
 * Un petit panneau ouvert depuis un bouton (le métronome, les parties, la mise en page) : son
 * titre, s'il en a un, puis son contenu. Il s'ouvre dans un DialogTrigger de React Aria, après son
 * bouton (un Button de React Aria), sous lui ou au-dessus ; il reste dans l'écran, et se ferme avec
 * Échap ou par un clic ailleurs, en rendant le focus au bouton.
 */
import type { ReactNode } from "react";
import { Dialog, Popover as Panel } from "react-aria-components";

export function Popover({ label, title, above = false, className = "", children }: { label: string; title?: string; above?: boolean; className?: string; children: ReactNode }) {
  return (
    <Panel className={`px-3 py-2.5 bg-white border border-line rounded-md shadow-[0_6px_20px_rgba(0,0,0,0.12)] outline-none ${className}`} placement={above ? "top end" : "bottom end"} offset={above ? 8 : 6}>
      <Dialog className="grid gap-1.5 outline-none" aria-label={label}>
        {title && <p className="mt-0 mb-0.5 font-semibold">{title}</p>}
        {children}
      </Dialog>
    </Panel>
  );
}
