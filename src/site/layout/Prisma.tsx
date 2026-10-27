import type { ReactNode } from "react";

/** De l'écriture Prisma dans le texte (`7`, `10:m`, `A A B A`) : en chasse fixe, sur un fond gris. */
export function Prisma({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[0.9em] px-[5px] py-px bg-panel rounded">{children}</code>;
}
