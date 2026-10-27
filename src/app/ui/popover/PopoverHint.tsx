/** Le mot d'explication d'un panneau, en petit : en bas du panneau, ou sous une possibilité d'un choix. */
import type { ReactNode } from "react";

export function PopoverHint({ children }: { children: ReactNode }) {
  return <span className="block mt-0.5 mb-0 text-muted text-[0.85em] leading-[1.35] whitespace-normal">{children}</span>;
}
