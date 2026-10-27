import type { ReactNode } from "react";

/** Le contenu d'une page, entre son haut et son bas : à la largeur des pages, ses sections séparées d'un trait. */
export function Page({ className = "", children }: { className?: string; children: ReactNode }) {
  return <main className={`max-w-[1160px] mx-auto px-6 divide-y divide-line ${className}`}>{children}</main>;
}
