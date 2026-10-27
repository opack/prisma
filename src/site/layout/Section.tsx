import type { ReactNode } from "react";

/** Une section d'une page, espacée ; la première, sous le haut de la page, moins espacée en haut. */
export function Section({ id, first = false, className = "", children }: { id?: string; first?: boolean; className?: string; children: ReactNode }) {
  return (
    <section className={`${first ? "pt-10 pb-14 narrow:pb-10" : "py-14 narrow:py-10"} ${className}`} id={id}>
      {children}
    </section>
  );
}
